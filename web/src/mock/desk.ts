// The mock backend. Same verbs convex/desk.ts exposes as mutations/actions.
import type { Applicant, Decision, EvalFailure, EvalRun, IntakeInput, Lender } from '../types'
import { outcomeOf, simulateDesk } from './engine'
import { EVAL_CASES, MARKET_RATES, PERSONAS, personaById, type PersonaBundle } from './personas'
import { bundleAfterDispute } from './rules'
import { DeskStore, type TimedOp } from './store'
import { FIXTURE } from './fixture'

export const liveStore = new DeskStore({ evalCases: EVAL_CASES, marketRates: MARKET_RATES })
export const replayStore = new DeskStore({ evalCases: EVAL_CASES, marketRates: MARKET_RATES })

function ids(store: DeskStore) {
  return {
    bundle: store.nextId('bun'),
    offers: { cu: store.nextId('off'), fintech: store.nextId('off'), prime: store.nextId('off') } as Record<Lender, string>,
    notice: store.nextId('not'),
    audit: () => store.nextId('aud'),
    check: () => store.nextId('chk'),
  }
}

export function createApplicant(input: IntakeInput): string {
  const persona = personaById(input.personaId)
  if (!persona) throw new Error(`Unknown persona ${input.personaId}`)
  const now = Date.now()
  const applicant: Applicant = {
    _id: liveStore.nextId('app'),
    personaId: persona.personaId,
    name: persona.name,
    purpose: input.purpose,
    amountRequested: input.amountRequested,
    statedIncome: input.statedIncome,
    consentAt: now,
    status: 'intake',
    createdAt: now,
    replayOf: null,
  }
  liveStore.schedule(simulateDesk(applicant, { t0: now, ids: ids(liveStore), bundle: persona.bundle }))
  return applicant._id
}

/** Dispute one tradeline: re-pull (mock: line removed) and re-run the desk as a linked replay applicant. */
export function disputeTradeline(store: DeskStore, applicantId: string, index: number): string {
  const s = store.getState()
  const original = s.applicants.find((a) => a._id === applicantId)
  const bundle = s.bundles.filter((b) => b.applicantId === applicantId).sort((a, b) => b.pulledAt - a.pulledAt)[0]
  if (!original || !bundle) throw new Error('Nothing to dispute')
  const line = bundle.credit.tradelines[index]
  if (!line) throw new Error('No such tradeline')
  const now = Date.now()
  store.apply({
    kind: 'audit.insert',
    row: {
      _id: store.nextId('aud'),
      applicantId,
      at: now,
      actor: 'applicant',
      action: 'dispute.tradeline',
      ref: `credit.tradelines[${index}]`,
      note: `Disputed ${line.type.replace('_', ' ')} (${line.status}, opened ${line.openedAt}). Re-pull and replay requested.`,
    },
  })
  const replay: Applicant = {
    _id: store.nextId('app'),
    personaId: original.personaId,
    name: original.name,
    purpose: original.purpose,
    amountRequested: original.amountRequested,
    statedIncome: original.statedIncome,
    consentAt: original.consentAt,
    status: 'intake',
    createdAt: now,
    replayOf: original._id,
  }
  const next: PersonaBundle = { ...bundleAfterDispute(bundle, index), source: bundle.source, raw: { ...(bundle.raw as object), dispute: index } }
  const ops = simulateDesk(replay, { t0: now, ids: ids(store), bundle: next })
  ops.push({
    atMs: 0,
    op: {
      kind: 'audit.insert',
      row: { _id: store.nextId('aud'), applicantId: replay._id, at: now, actor: 'desk', action: 'desk.replay', ref: `applicants.${original._id}`, note: `Replay after dispute of credit.tradelines[${index}].` },
    },
  })
  store.schedule(ops)
  return replay._id
}

function recordDecision(store: DeskStore, d: Omit<Decision, '_id' | 'approvedBy' | 'at'>) {
  const at = Date.now()
  store.apply({ kind: 'decision.insert', row: { _id: store.nextId('dec'), approvedBy: 'human', at, ...d } })
  store.apply({ kind: 'applicant.status', id: d.applicantId, status: d.outcome })
  store.apply({
    kind: 'audit.insert',
    row: {
      _id: store.nextId('aud'),
      applicantId: d.applicantId,
      at,
      actor: 'human',
      action: 'step.human.done',
      ref: d.chosenOfferId ? `offers.${d.chosenOfferId}` : null,
      note: d.note,
    },
  })
}

export function approveOffer(store: DeskStore, applicantId: string, offerId: string, note = '') {
  const offer = store.getState().offers.find((o) => o._id === offerId)
  if (!offer || offer.decision !== 'approve') throw new Error('Offer is not approvable')
  recordDecision(store, {
    applicantId,
    chosenOfferId: offerId,
    outcome: 'approved',
    note: note || `approved ${offer.lender} ${offer.classification ?? 'offer'}: $${offer.amount?.toLocaleString('en-US')} at ${offer.apr}% for ${offer.termMonths} months`,
  })
}

export function declineApplicant(store: DeskStore, applicantId: string, note = '') {
  recordDecision(store, { applicantId, chosenOfferId: null, outcome: 'declined', note: note || 'Loan officer declined all offers.' })
}

/** Runs every eval case through the engine (no timers) and compares with the answer key. */
export function runEval(store: DeskStore): Promise<void> {
  const startedAt = Date.now()
  const id = store.nextId('run')
  const cases = store.getState().evalCases
  const pending: EvalRun = {
    _id: id,
    startedAt,
    finishedAt: null,
    cases: cases.length,
    agreement: 0,
    fraudZeroOffers: true,
    avgReasonsPerDenial: 0,
    failures: [],
    reasonsVerified: null,
  }
  store.apply({ kind: 'evalRun.upsert', row: pending })

  const failures: EvalFailure[] = []
  let agree = 0
  let denialReasons = 0
  let denials = 0
  let checks = 0
  let flipped = 0
  let fraudZeroOffers = true
  for (const c of cases) {
    const persona = personaById(c.personaId)
    if (!persona) {
      failures.push({ personaId: c.personaId, expected: c.expected, got: 'missing', why: 'Persona not in deck.' })
      continue
    }
    const applicant: Applicant = {
      _id: `eval_${c.personaId}`,
      personaId: persona.personaId,
      name: persona.name,
      ...persona.defaults,
      consentAt: startedAt,
      status: 'intake',
      createdAt: startedAt,
      replayOf: null,
    }
    let n = 0
    const ops = simulateDesk(applicant, {
      t0: startedAt,
      bundle: persona.bundle,
      ids: { bundle: 'b', offers: { cu: 'cu', fintech: 'fintech', prime: 'prime' }, notice: 'n', audit: () => `a${n++}`, check: () => `c${n++}` },
    })
    const got = outcomeOf(ops)
    const fieldsSeen = new Set<string>()
    let offersSeen = 0
    for (const t of ops) {
      if (t.op.kind === 'offer.upsert' && t.op.row.status === 'done') {
        offersSeen += 1
        t.op.row.reasons.forEach((r) => fieldsSeen.add(r.field))
        if (t.op.row.decision === 'decline') {
          denials += 1
          denialReasons += t.op.row.reasons.length
        }
      }
      if (t.op.kind === 'reasonCheck.insert') {
        checks += 1
        if (t.op.row.flipped) flipped += 1
      }
      if (t.op.kind === 'audit.insert' && t.op.row.action === 'rules.hard_stop' && t.op.row.ref) fieldsSeen.add(t.op.row.ref)
    }
    const isFraudish = persona.bundle.fraud.score != null && persona.bundle.fraud.score >= 80
    if (isFraudish && offersSeen > 0) fraudZeroOffers = false

    const missing = c.expectedReasonsIncludes.filter((f) => ![...fieldsSeen].some((seen) => seen === f || seen.startsWith(f + '[') || seen.startsWith(f + '.')))
    if (got !== c.expected) failures.push({ personaId: c.personaId, expected: c.expected, got, why: `Outcome mismatch. ${c.note}` })
    else if (missing.length) failures.push({ personaId: c.personaId, expected: c.expected, got, why: `Expected reason fields missing: ${missing.join(', ')}. ${c.note}` })
    else agree += 1
  }

  const finished: EvalRun = {
    ...pending,
    finishedAt: startedAt + 1800,
    agreement: cases.length ? agree / cases.length : 0,
    fraudZeroOffers,
    avgReasonsPerDenial: denials ? Math.round((denialReasons / denials) * 100) / 100 : 0,
    failures,
    reasonsVerified: checks ? flipped / checks : null,
  }
  return new Promise((resolve) => {
    store.schedule([{ atMs: 1800, op: { kind: 'evalRun.upsert', row: finished } }])
    setTimeout(resolve, 1800)
  })
}

/** Replay: rebase the recorded fixture onto "now" and schedule it. */
export function startReplay(): () => void {
  replayStore.reset({ evalCases: EVAL_CASES, marketRates: MARKET_RATES })
  const delta = Date.now() - FIXTURE.t0
  const ops: TimedOp[] = FIXTURE.ops.map((t) => ({ atMs: t.atMs, op: rebase(t.op, delta) }))
  return replayStore.schedule(ops)
}

function rebase(op: TimedOp['op'], d: number): TimedOp['op'] {
  switch (op.kind) {
    case 'applicant.upsert':
      return { ...op, row: { ...op.row, consentAt: op.row.consentAt + d, createdAt: op.row.createdAt + d } }
    case 'bundle.insert':
      return { ...op, row: { ...op.row, pulledAt: op.row.pulledAt + d } }
    case 'offer.upsert':
    case 'notice.insert':
    case 'reasonCheck.insert':
      return { ...op, row: { ...op.row, createdAt: op.row.createdAt + d } } as TimedOp['op']
    case 'decision.insert':
    case 'audit.insert':
      return { ...op, row: { ...op.row, at: op.row.at + d } } as TimedOp['op']
    case 'evalRun.upsert':
      return { ...op, row: { ...op.row, startedAt: op.row.startedAt + d, finishedAt: op.row.finishedAt == null ? null : op.row.finishedAt + d } }
    default:
      return op
  }
}

export const DECK = PERSONAS.map(({ personaId, name, hint, defaults }) => ({ personaId, name, hint, defaults }))
