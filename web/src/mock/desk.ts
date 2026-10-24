// The mock backend. Same verbs convex/desk.ts will expose as mutations/actions.
import type { Applicant, Decision, EvalFailure, EvalRun, IntakeInput, Lender } from '../types'
import { outcomeOf, simulateDesk } from './engine'
import { EVAL_CASES, MARKET_RATES, PERSONAS, personaById } from './personas'
import { DeskStore, type TimedOp } from './store'
import { FIXTURE } from './fixture'

export const liveStore = new DeskStore({ evalCases: EVAL_CASES, marketRates: MARKET_RATES })
export const replayStore = new DeskStore({ evalCases: EVAL_CASES, marketRates: MARKET_RATES })

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
  }
  const ops = simulateDesk(applicant, persona, {
    t0: now,
    ids: {
      bundle: liveStore.nextId('bun'),
      offers: {
        cu: liveStore.nextId('off'),
        fintech: liveStore.nextId('off'),
        prime: liveStore.nextId('off'),
      } as Record<Lender, string>,
      notice: liveStore.nextId('not'),
      audit: () => liveStore.nextId('aud'),
    },
  })
  liveStore.schedule(ops)
  return applicant._id
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
      action: d.outcome === 'approved' ? 'offer.approved' : 'application.declined',
      ref: d.chosenOfferId ? `offers.${d.chosenOfferId}` : null,
      note: d.note,
    },
  })
  store.apply({
    kind: 'audit.insert',
    row: { _id: store.nextId('aud'), applicantId: d.applicantId, at, actor: 'desk', action: 'step.human.done', ref: null, note: 'Decision recorded.' },
  })
}

export function approveOffer(store: DeskStore, applicantId: string, offerId: string, note = '') {
  const offer = store.getState().offers.find((o) => o._id === offerId)
  if (!offer || offer.decision !== 'approve') throw new Error('Offer is not approvable')
  recordDecision(store, {
    applicantId,
    chosenOfferId: offerId,
    outcome: 'approved',
    note: note || `Approved ${offer.lender} offer: ${offer.apr}% APR, ${offer.termMonths} mo, $${offer.amount?.toLocaleString('en-US')}.`,
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
  const pending: EvalRun = { _id: id, startedAt, finishedAt: null, cases: cases.length, agreement: 0, fraudZeroOffers: true, avgReasonsPerDenial: 0, failures: [] }
  store.apply({ kind: 'evalRun.upsert', row: pending })

  const failures: EvalFailure[] = []
  let agree = 0
  let denialReasons = 0
  let denials = 0
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
    }
    let n = 0
    const ops = simulateDesk(applicant, persona, {
      t0: startedAt,
      ids: { bundle: 'b', offers: { cu: 'cu', fintech: 'fintech', prime: 'prime' }, notice: 'n', audit: () => `a${n++}` },
    })
    const got = outcomeOf(ops)
    const offers = ops.filter((t) => t.op.kind === 'offer.upsert' && t.op.row.status === 'done').map((t) => (t.op as { row: { decision: string | null; reasons: unknown[] } }).row)
    for (const o of offers) {
      if (o.decision === 'decline') {
        denials += 1
        denialReasons += o.reasons.length
      }
    }
    const isFraudish = persona.bundle.fraud.score != null && persona.bundle.fraud.score >= 80
    if (isFraudish && offers.length > 0) fraudZeroOffers = false

    const fieldsSeen = new Set<string>()
    for (const t of ops) {
      if (t.op.kind === 'offer.upsert') t.op.row.reasons.forEach((r) => fieldsSeen.add(r.field))
      if (t.op.kind === 'audit.insert' && t.op.row.action === 'hard_stop' && t.op.row.ref) fieldsSeen.add(t.op.row.ref)
    }
    const missing = c.expectedReasonsIncludes.filter((f) => !fieldsSeen.has(f))

    if (got !== c.expected) failures.push({ personaId: c.personaId, expected: c.expected, got, why: `Outcome mismatch. ${c.note}` })
    else if (missing.length) failures.push({ personaId: c.personaId, expected: c.expected, got, why: `Expected reason fields missing: ${missing.join(', ')}.` })
    else agree += 1
  }

  const finished: EvalRun = {
    ...pending,
    finishedAt: startedAt + 1800,
    agreement: cases.length ? agree / cases.length : 0,
    fraudZeroOffers,
    avgReasonsPerDenial: denials ? Math.round((denialReasons / denials) * 100) / 100 : 0,
    failures,
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
