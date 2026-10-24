// Pure selectors over the Desk state. Components use these instead of filtering inline.
import type { Applicant, AuditEvent, Decision, Lender, Offer, ReasonCheck, StepId } from '../types'
import { PIPELINE_STEPS } from '../types'

export type StepState = 'queued' | 'running' | 'done' | 'failed' | 'skipped'

export interface StepTiming {
  id: StepId
  label: string
  state: StepState
  startedAt: number | null
  finishedAt: number | null
}

const STEP_RE = /^step\.(pull|guardrails|underwrite|compliance|human)\.(start|done)$/

export function stepTimings(applicant: Applicant | undefined, events: AuditEvent[]): StepTiming[] {
  const map = new Map<StepId, { start: number | null; done: number | null }>()
  for (const s of PIPELINE_STEPS) map.set(s.id, { start: null, done: null })
  for (const e of events) {
    const m = STEP_RE.exec(e.action)
    if (!m) continue
    const t = map.get(m[1] as StepId)!
    if (m[2] === 'start') t.start = e.at
    else t.done = e.at
  }
  const hard = applicant?.status === 'hard_stop'
  const terminal = applicant && ['approved', 'declined', 'hard_stop'].includes(applicant.status)
  return PIPELINE_STEPS.map((s) => {
    const t = map.get(s.id)!
    let state: StepState = 'queued'
    if (t.start != null && t.done == null) state = 'running'
    else if (t.done != null) state = 'done'
    if (hard && s.id === 'guardrails' && t.done != null) state = 'failed'
    if (hard && t.start == null) state = 'skipped'
    if (terminal && !hard && s.id === 'human' && t.done == null && t.start != null) state = 'done'
    return { id: s.id, label: s.label, state, startedAt: t.start, finishedAt: t.done }
  })
}

export function offersFor(offers: Offer[], applicantId: string | null) {
  return applicantId ? offers.filter((o) => o.applicantId === applicantId) : []
}

export function offerByLender(offers: Offer[], lender: Lender) {
  return offers.find((o) => o.lender === lender)
}

export function eventsFor(events: AuditEvent[], applicantId: string | null) {
  return applicantId ? events.filter((e) => e.applicantId === applicantId) : events
}

export function hardStopEvent(events: AuditEvent[]) {
  return events.find((e) => e.action === 'rules.hard_stop' || e.action === 'hard_stop')
}

export type CheckState = 'verified' | 'unsupported' | 'pending' | 'none'

/** Verification state of one decline reason. 'none' = not a decline (approvals are not tested). */
export function checkFor(checks: ReasonCheck[], offer: Offer, field: string): { state: CheckState; check?: ReasonCheck } {
  if (offer.status !== 'done' || offer.decision !== 'decline') return { state: 'none' }
  const c = checks.find((x) => x.offerId === offer._id && x.field === field)
  if (!c) return { state: 'pending' }
  return { state: c.flipped ? 'verified' : 'unsupported', check: c }
}

export function verifiedReasons(checks: ReasonCheck[], offer: Offer) {
  return offer.reasons.filter((r) => checkFor(checks, offer, r.field).state === 'verified')
}

export interface NoticeRequirement {
  required: boolean
  why: string
}

/** ECOA: adverse action = denial of the amount/terms requested, absent an accepted counteroffer. */
export function noticeRequired(offers: Offer[], decision: Decision | undefined): NoticeRequirement {
  const done = offers.filter((o) => o.status === 'done')
  const cls = (o: Offer) => o.classification ?? (o.decision === 'approve' ? 'approve' : 'deny')
  const denials = done.filter((o) => cls(o) === 'deny')
  const counters = done.filter((o) => cls(o) === 'counteroffer')
  if (denials.length) return { required: true, why: `${denials.length} of ${done.length} lenders denied the requested terms` }
  if (counters.length) {
    const accepted = decision?.chosenOfferId && counters.some((o) => o._id === decision.chosenOfferId)
    if (accepted) return { required: false, why: 'counteroffer accepted' }
    return { required: true, why: 'counteroffer not accepted' }
  }
  if (done.length === 0) return { required: false, why: 'no lender responses yet' }
  return { required: false, why: 'every lender offered the requested terms' }
}

/** The original applicant a replay was created from, if any. */
export function originalOf(applicants: Applicant[], a: Applicant | undefined) {
  return a?.replayOf ? applicants.find((x) => x._id === a.replayOf) : undefined
}

export function newestFirst<T extends { at: number }>(rows: T[]) {
  return rows.slice().sort((a, b) => b.at - a.at)
}
