// simulateDesk: a pure function from (applicant, persona) to the timed op stream that convex/desk.ts
// would produce. The store schedules it live; the replay fixture is one recorded output of it.
import type { Applicant, AuditEvent, Bundle, Lender, Offer, Reason } from '../types'
import { LENDERS } from '../types'
import type { Persona } from './personas'
import { adverseActionNotice, hardStop, underwrite } from './rules'
import type { TimedOp } from './store'

export interface SimulateOptions {
  t0: number
  ids: { bundle: string; offers: Record<Lender, string>; notice: string; audit: () => string }
}

function hash(s: string) {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

export function simulateDesk(applicant: Applicant, persona: Persona, o: SimulateOptions): TimedOp[] {
  const ops: TimedOp[] = []
  const t0 = o.t0
  const audit = (atMs: number, e: Omit<AuditEvent, '_id' | 'applicantId' | 'at'>) =>
    ops.push({ atMs, op: { kind: 'audit.insert', row: { _id: o.ids.audit(), applicantId: applicant._id, at: t0 + atMs, ...e } } })
  const status = (atMs: number, s: Applicant['status']) => ops.push({ atMs, op: { kind: 'applicant.status', id: applicant._id, status: s } })

  // 0 — intake
  ops.push({ atMs: 0, op: { kind: 'applicant.upsert', row: applicant } })
  audit(0, { actor: 'intake', action: 'consent.recorded', ref: 'applicant.consentAt', note: 'Applicant accepted the soft-pull consent text.' })
  audit(0, { actor: 'intake', action: 'application.submitted', ref: `persona:${applicant.personaId}`, note: `${applicant.purpose}, $${applicant.amountRequested.toLocaleString('en-US')}, stated income $${applicant.statedIncome.toLocaleString('en-US')}.` })

  // 250 — pull
  status(250, 'pulling')
  audit(250, { actor: 'desk', action: 'step.pull.start', ref: null, note: 'Requesting prequal, identity and fraud products.' })

  const pulledAt = 1700
  const bundle: Bundle = {
    _id: o.ids.bundle,
    applicantId: applicant._id,
    pulledAt: t0 + pulledAt,
    ...persona.bundle,
  }
  ops.push({ atMs: pulledAt, op: { kind: 'bundle.insert', row: bundle } })
  audit(pulledAt, {
    actor: 'crs',
    action: 'bundle.pulled',
    ref: `bundles.source=${bundle.source}`,
    note: `FICO 9 ${bundle.credit.fico9 ?? 'n/a'}, Vantage 4 ${bundle.credit.vantage4 ?? 'n/a'}, ${bundle.credit.tradelines.length} tradelines, fraud ${bundle.fraud.score ?? 'n/a'}.`,
  })
  audit(pulledAt, { actor: 'desk', action: 'step.pull.done', ref: null, note: `${pulledAt - 250} ms.` })

  // 1700 — guardrails
  status(pulledAt, 'guardrails')
  audit(pulledAt, { actor: 'desk', action: 'step.guardrails.start', ref: null, note: 'Deterministic rules, no model involved.' })
  const stop = hardStop(bundle)
  const gDone = 2300
  if (stop) {
    audit(gDone, { actor: 'rules', action: 'hard_stop', ref: stop.field, note: stop.reason })
    audit(gDone, { actor: 'desk', action: 'step.guardrails.done', ref: null, note: 'Hard stop. Zero offers. Underwriters never ran.' })
    status(gDone, 'hard_stop')
    return ops
  }
  audit(gDone, { actor: 'rules', action: 'guardrails.passed', ref: null, note: 'No deceased, frozen, IDV or fraud-threshold hit.' })
  audit(gDone, { actor: 'desk', action: 'step.guardrails.done', ref: null, note: `${gDone - pulledAt} ms.` })

  // 2300 — underwrite x3 in parallel
  status(gDone, 'underwriting')
  audit(gDone, { actor: 'desk', action: 'step.underwrite.start', ref: null, note: 'Three underwriters, one policy each, in parallel.' })
  const seed = hash(applicant.personaId)
  const order: Lender[] = ['cu', 'fintech', 'prime']
  const latencies: Record<Lender, number> = {
    cu: 1100 + (seed % 5) * 120,
    fintech: 2600 + ((seed >> 3) % 5) * 140,
    prime: 1900 + ((seed >> 6) % 5) * 130,
  }
  const declines: Array<{ lender: Lender; reasons: Reason[] }> = []
  let lastDone = gDone
  for (const lender of order) {
    const pending: Offer = {
      _id: o.ids.offers[lender],
      applicantId: applicant._id,
      lender,
      provider: 'claude',
      status: 'pending',
      decision: null,
      apr: null,
      termMonths: null,
      amount: null,
      conditions: [],
      reasons: [],
      marketAnchor: null,
      runId: `run_${lender}_${(seed % 9999).toString(16)}`,
      shareUrl: null,
      latencyMs: null,
      createdAt: t0 + gDone,
    }
    ops.push({ atMs: gDone, op: { kind: 'offer.upsert', row: pending } })
    const result = underwrite(lender, {
      bundle,
      statedIncome: applicant.statedIncome,
      amountRequested: applicant.amountRequested,
      purpose: applicant.purpose,
    })
    const doneAt = gDone + latencies[lender]
    lastDone = Math.max(lastDone, doneAt)
    const done: Offer = {
      ...pending,
      status: 'done',
      decision: result.decision,
      apr: result.apr,
      termMonths: result.termMonths,
      amount: result.amount,
      conditions: result.conditions,
      reasons: result.reasons,
      marketAnchor: result.marketAnchor,
      latencyMs: latencies[lender],
    }
    ops.push({ atMs: doneAt, op: { kind: 'offer.upsert', row: done } })
    audit(doneAt, {
      actor: `underwriter:${lender}`,
      action: result.decision === 'approve' ? 'offer.approve' : 'offer.decline',
      ref: `offers.${lender}`,
      note:
        result.decision === 'approve'
          ? `${result.apr}% APR, ${result.termMonths} mo, $${(result.amount ?? 0).toLocaleString('en-US')}. ${latencies[lender]} ms.`
          : `${result.reasons.length} reasons: ${result.reasons.map((r) => r.field).join(', ')}. ${latencies[lender]} ms.`,
    })
    if (result.decision === 'decline') declines.push({ lender, reasons: result.reasons })
  }
  audit(lastDone, { actor: 'desk', action: 'step.underwrite.done', ref: null, note: `${lastDone - gDone} ms wall clock.` })

  // compliance
  status(lastDone, 'compliance')
  audit(lastDone, { actor: 'desk', action: 'step.compliance.start', ref: null, note: declines.length ? `${declines.length} decline(s) need an adverse-action notice.` : 'No declines; nothing to write.' })
  const cDone = lastDone + (declines.length ? 1400 : 400)
  if (declines.length) {
    ops.push({
      atMs: cDone,
      op: {
        kind: 'notice.insert',
        row: {
          _id: o.ids.notice,
          applicantId: applicant._id,
          text: adverseActionNotice(applicant.name, declines),
          lendersDeclined: declines.map((d) => d.lender),
          createdAt: t0 + cDone,
        },
      },
    })
    audit(cDone, { actor: 'compliance', action: 'notice.written', ref: 'notices', note: `Names ${declines.reduce((n, d) => n + d.reasons.length, 0)} reasons across ${declines.map((d) => LENDERS.find((l) => l.id === d.lender)?.label).join(', ')}.` })
  }
  audit(cDone, { actor: 'desk', action: 'step.compliance.done', ref: null, note: `${cDone - lastDone} ms.` })

  // awaiting human
  const hAt = cDone + 500
  status(hAt, 'awaiting_human')
  audit(hAt, { actor: 'desk', action: 'step.human.start', ref: null, note: 'Board is ready. Waiting for the loan officer.' })
  return ops
}

/** Outcome label the eval compares against the answer key. */
export function outcomeOf(ops: TimedOp[]): 'approve' | 'decline' | 'hard_stop' {
  let hard = false
  let approved = false
  for (const t of ops) {
    if (t.op.kind === 'applicant.status' && t.op.status === 'hard_stop') hard = true
    if (t.op.kind === 'offer.upsert' && t.op.row.decision === 'approve') approved = true
  }
  return hard ? 'hard_stop' : approved ? 'approve' : 'decline'
}
