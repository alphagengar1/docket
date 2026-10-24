// In-memory stand-in for the Convex tables. Every change goes through apply(op), so the same
// op stream can be produced live by the engine, recorded to a fixture, and replayed later.
import type {
  Applicant,
  AuditEvent,
  Bundle,
  Decision,
  EvalCase,
  EvalRun,
  MarketRate,
  Notice,
  Offer,
  ReasonCheck,
} from '../types'

export interface DeskState {
  applicants: Applicant[]
  bundles: Bundle[]
  offers: Offer[]
  notices: Notice[]
  decisions: Decision[]
  auditEvents: AuditEvent[]
  reasonChecks: ReasonCheck[]
  evalCases: EvalCase[]
  evalRuns: EvalRun[]
  marketRates: MarketRate[]
}

export type Op =
  | { kind: 'applicant.upsert'; row: Applicant }
  | { kind: 'applicant.status'; id: string; status: Applicant['status'] }
  | { kind: 'bundle.insert'; row: Bundle }
  | { kind: 'offer.upsert'; row: Offer }
  | { kind: 'notice.insert'; row: Notice }
  | { kind: 'decision.insert'; row: Decision }
  | { kind: 'audit.insert'; row: AuditEvent }
  | { kind: 'reasonCheck.insert'; row: ReasonCheck }
  | { kind: 'evalRun.upsert'; row: EvalRun }

/** An op plus the moment (ms after t0) it should land. */
export interface TimedOp {
  atMs: number
  op: Op
}

export function emptyState(seed: Partial<DeskState> = {}): DeskState {
  return {
    applicants: [],
    bundles: [],
    offers: [],
    notices: [],
    decisions: [],
    auditEvents: [],
    reasonChecks: [],
    evalCases: [],
    evalRuns: [],
    marketRates: [],
    ...seed,
  }
}

function upsert<T extends { _id: string }>(rows: T[], row: T): T[] {
  const i = rows.findIndex((r) => r._id === row._id)
  if (i < 0) return [...rows, row]
  const next = rows.slice()
  next[i] = row
  return next
}

export function reduce(state: DeskState, op: Op): DeskState {
  switch (op.kind) {
    case 'applicant.upsert':
      return { ...state, applicants: upsert(state.applicants, op.row) }
    case 'applicant.status':
      return {
        ...state,
        applicants: state.applicants.map((a) => (a._id === op.id ? { ...a, status: op.status } : a)),
      }
    case 'bundle.insert':
      return { ...state, bundles: upsert(state.bundles, op.row) }
    case 'offer.upsert':
      return { ...state, offers: upsert(state.offers, op.row) }
    case 'notice.insert':
      return { ...state, notices: upsert(state.notices, op.row) }
    case 'decision.insert':
      return { ...state, decisions: upsert(state.decisions, op.row) }
    case 'audit.insert':
      return { ...state, auditEvents: upsert(state.auditEvents, op.row) }
    case 'reasonCheck.insert':
      return { ...state, reasonChecks: upsert(state.reasonChecks, op.row) }
    case 'evalRun.upsert':
      return { ...state, evalRuns: upsert(state.evalRuns, op.row) }
  }
}

export class DeskStore {
  private state: DeskState
  private listeners = new Set<() => void>()
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private counter = 0

  constructor(seed: Partial<DeskState> = {}) {
    this.state = emptyState(seed)
  }

  getState = () => this.state

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  apply(op: Op) {
    this.state = reduce(this.state, op)
    this.listeners.forEach((l) => l())
  }

  /** Schedule a batch of timed ops relative to now. Returns a cancel function. */
  schedule(ops: TimedOp[], speed = 1) {
    // Ops due now land synchronously so callers can select the new row immediately.
    ops.filter((t) => t.atMs <= 0).forEach((t) => this.apply(t.op))
    const handles = ops.filter((t) => t.atMs > 0).map((t) => {
      const h = setTimeout(() => {
        this.timers.delete(h)
        this.apply(t.op)
      }, t.atMs / speed)
      this.timers.add(h)
      return h
    })
    return () => handles.forEach((h) => {
      clearTimeout(h)
      this.timers.delete(h)
    })
  }

  cancelAll() {
    this.timers.forEach((h) => clearTimeout(h))
    this.timers.clear()
  }

  nextId(prefix: string) {
    this.counter += 1
    return `${prefix}_${this.counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
  }

  reset(seed: Partial<DeskState> = {}) {
    this.cancelAll()
    this.state = emptyState(seed)
    this.listeners.forEach((l) => l())
  }
}
