// Pure selectors over the Desk state. Components use these instead of filtering inline.
import type { Applicant, AuditEvent, Lender, Offer, StepId } from '../types'
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
  return events.find((e) => e.action === 'hard_stop')
}

export function newestFirst<T extends { at: number }>(rows: T[]) {
  return rows.slice().sort((a, b) => b.at - a.at)
}
