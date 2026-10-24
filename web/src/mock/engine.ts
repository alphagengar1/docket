// simulateDesk: a pure function from (applicant, bundle) to the timed op stream that convex/desk.ts
// would produce. The store schedules it live; the replay fixture is one recorded output of it.
// Audit action names follow convex/desk.ts + convex/agents.ts so the UI reads both the same way.
import type { Applicant, AuditEvent, Bundle, Lender, Offer, Reason, ReasonCheck } from '../types'
import { LENDERS } from '../types'
import type { PersonaBundle } from './personas'
import { adverseActionNotice, hardStop, underwrite, verifyReason } from './rules'
import type { TimedOp } from './store'

export interface SimulateOptions {
  t0: number
  ids: { bundle: string; offers: Record<Lender, string>; notice: string; audit: () => string; check: () => string }
  /** Bundle to pull (defaults to the persona's). Disputes pass a modified one. */
  bundle: PersonaBundle
}

function hash(s: string) {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

export function simulateDesk(applicant: Applicant, o: SimulateOptions): TimedOp[] {
  const ops: TimedOp[] = []
  const t0 = o.t0
  const audit = (atMs: number, e: Omit<AuditEvent, '_id' | 'applicantId' | 'at'>) =>
    ops.push({ atMs, op: { kind: 'audit.insert', row: { _id: o.ids.audit(), applicantId: applicant._id, at: t0 + atMs, ...e } } })
  const status = (atMs: number, s: Applicant['status']) => ops.push({ atMs, op: { kind: 'applicant.status', id: applicant._id, status: s } })

  // 0 — intake
  ops.push({ atMs: 0, op: { kind: 'applicant.upsert', row: applicant } })
  audit(0, { actor: 'intake', action: 'consent.recorded', ref: 'applicant.consentAt', note: 'Applicant accepted the soft-pull consent text.' })
  audit(0, {
    actor: 'intake',
    action: applicant.replayOf ? 'intake.replay' : 'intake.submitted',
    ref: applicant.replayOf ? `applicants.${applicant.replayOf}` : `persona:${applicant.personaId}`,
    note: `${applicant.purpose}, $${applicant.amountRequested.toLocaleString('en-US')}, stated income $${applicant.statedIncome.toLocaleString('en-US')}.`,
  })

  // 250 — pull
  status(250, 'pulling')
  audit(250, { actor: 'desk', action: 'step.pull.start', ref: null, note: 'Requesting prequal, identity and fraud products.' })

  const pulledAt = 1700
  const bundle: Bundle = { ...o.bundle, _id: o.ids.bundle, applicantId: applicant._id, pulledAt: t0 + pulledAt }
  ops.push({ atMs: pulledAt, op: { kind: 'bundle.insert', row: bundle } })
  audit(pulledAt, {
    actor: 'crs',
    action: 'crs.pulled',
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
    audit(gDone, { actor: 'rules', action: 'rules.hard_stop', ref: stop.field, note: stop.reason })
    audit(gDone, { actor: 'desk', action: 'step.guardrails.done', ref: null, note: 'Hard stop. Zero offers. Underwriters never ran.' })
    status(gDone, 'hard_stop')
    return ops
  }
  audit(gDone, { actor: 'rules', action: 'rules.pass', ref: null, note: 'No hard-stop rule fired.' })
  audit(gDone, { actor: 'desk', action: 'step.guardrails.done', ref: null, note: `${gDone - pulledAt} ms.` })

  // 2300 — underwrite x3 in parallel
  status(gDone, 'underwriting')
  audit(gDone, { actor: 'desk', action: 'step.underwrite.start', ref: null, note: `${LENDERS.length} underwriters, one policy each, in parallel.` })
  const seed = hash(applicant.personaId + (applicant.replayOf ?? ''))
  const order: Lender[] = LENDERS.map((l) => l.id)
  const latencies: Record<Lender, number> = {
    cu: 1100 + (seed % 5) * 120,
    fintech: 2600 + ((seed >> 3) % 5) * 140,
    prime: 1900 + ((seed >> 6) % 5) * 130,
    regional: 2200 + ((seed >> 9) % 5) * 125,
    subprime: 1500 + ((seed >> 12) % 5) * 135,
  }
  const input = { bundle, statedIncome: applicant.statedIncome, amountRequested: applicant.amountRequested, purpose: applicant.purpose }
  const notices: Array<{ lender: Lender; classification: 'deny' | 'counteroffer'; reasons: Reason[] }> = []
  const checksByOffer: ReasonCheck[] = []
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
    audit(gDone, { actor: `underwriter:${lender}`, action: 'underwrite.started', ref: `offers.${lender}`, note: `Policy: ${LENDERS.find((l) => l.id === lender)?.name}.` })
    const result = underwrite(lender, input)
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
      classification: result.classification,
    }
    ops.push({ atMs: doneAt, op: { kind: 'offer.upsert', row: done } })
    audit(doneAt, {
      actor: `underwriter:${lender}`,
      action: `underwrite.${result.decision}`,
      ref: `offers.${lender}`,
      note:
        result.decision === 'approve'
          ? `${result.classification}: ${result.apr}% APR, ${result.termMonths} mo, $${(result.amount ?? 0).toLocaleString('en-US')}. ${latencies[lender]} ms.`
          : `${result.reasons.length} reasons: ${result.reasons.map((r) => r.field).join(', ')}. ${latencies[lender]} ms.`,
    })
    if (result.decision === 'decline') {
      // Counterfactual reason test: one check per reason, landing 0.8-1.6 s after the decline.
      result.reasons.forEach((r, i) => {
        const v = verifyReason(lender, input, result.reasons, r.field)
        const latency = 800 + ((seed >> (i * 2)) % 5) * 160 + i * 140
        const row: ReasonCheck = {
          _id: o.ids.check(),
          offerId: pending._id,
          applicantId: applicant._id,
          field: r.field,
          original: v.original,
          counterfactual: v.counterfactual,
          flipped: v.flipped,
          latencyMs: latency,
          createdAt: t0 + doneAt + latency,
        }
        checksByOffer.push(row)
        ops.push({ atMs: doneAt + latency, op: { kind: 'reasonCheck.insert', row } })
        audit(doneAt + latency, {
          actor: 'rules',
          action: v.flipped ? 'reason.verified' : 'reason.unsupported',
          ref: `offers.${lender}/${r.field}`,
          note: v.flipped
            ? `Set ${r.field} ${String(v.original)} → ${String(v.counterfactual)}: decision flips.`
            : `Set ${r.field} ${String(v.original)} → ${String(v.counterfactual)}: decision does not flip. Dropped from the notice.`,
        })
      })
      notices.push({ lender, classification: 'deny', reasons: result.reasons })
    } else if (result.classification === 'counteroffer') {
      notices.push({ lender, classification: 'counteroffer', reasons: [] })
    }
  }
  const lastCheck = checksByOffer.reduce((m, c) => Math.max(m, c.createdAt - t0), lastDone)
  audit(lastDone, { actor: 'desk', action: 'step.underwrite.done', ref: null, note: `${lastDone - gDone} ms wall clock.` })

  // compliance
  status(lastDone, 'compliance')
  const cStart = Math.max(lastDone, lastCheck)
  if (notices.length) {
    audit(lastDone, { actor: 'desk', action: 'step.compliance.start', ref: null, note: `${notices.filter((n) => n.classification === 'deny').length} denial(s), ${notices.filter((n) => n.classification === 'counteroffer').length} counteroffer(s). Waiting for reason checks.` })
    const cDone = cStart + 1400
    const verified = notices.map((n) => ({
      ...n,
      reasons: n.reasons.filter((r) => checksByOffer.some((c) => c.offerId === o.ids.offers[n.lender] && c.field === r.field && c.flipped)),
    }))
    ops.push({
      atMs: cDone,
      op: {
        kind: 'notice.insert',
        row: {
          _id: o.ids.notice,
          applicantId: applicant._id,
          text: adverseActionNotice(applicant.name, verified, { name: bundle.source === 'mock' ? 'the CRS sandbox (mock)' : 'CRS', pulledAt: bundle.pulledAt }),
          lendersDeclined: notices.map((d) => d.lender),
          createdAt: t0 + cDone,
        },
      },
    })
    const total = notices.reduce((n, d) => n + d.reasons.length, 0)
    const kept = verified.reduce((n, d) => n + d.reasons.length, 0)
    audit(cDone, { actor: 'compliance', action: 'compliance.notice', ref: 'notices', note: `${kept} of ${total} reasons verified by counterfactual test; FCRA source statement included.` })
    audit(cDone, { actor: 'desk', action: 'step.compliance.done', ref: null, note: `${cDone - lastDone} ms.` })
    status(cDone + 500, 'awaiting_human')
    audit(cDone + 500, { actor: 'desk', action: 'step.human.start', ref: null, note: 'Board is ready. Waiting for the loan officer.' })
  } else {
    audit(lastDone, { actor: 'desk', action: 'step.compliance.start', ref: null, note: 'No denials or counteroffers.' })
    audit(lastDone + 400, { actor: 'desk', action: 'step.compliance.skipped', ref: null, note: 'No notice required.' })
    audit(lastDone + 400, { actor: 'desk', action: 'step.compliance.done', ref: null, note: 'Skipped.' })
    status(lastDone + 900, 'awaiting_human')
    audit(lastDone + 900, { actor: 'desk', action: 'step.human.start', ref: null, note: 'Board is ready. Waiting for the loan officer.' })
  }
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
