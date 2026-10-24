// Mirrors design/contracts.md exactly. Do not add fields here without changing the contract.

export type ApplicantStatus =
  | 'intake'
  | 'pulling'
  | 'guardrails'
  | 'underwriting'
  | 'compliance'
  | 'awaiting_human'
  | 'approved'
  | 'declined'
  | 'hard_stop'

export interface Applicant {
  _id: string
  personaId: string
  name: string
  purpose: string
  amountRequested: number
  statedIncome: number
  consentAt: number
  status: ApplicantStatus
  createdAt: number
  /** Proposed addition (design/open.md): set on the re-run created by a tradeline dispute. */
  replayOf?: string | null
}

export interface Tradeline {
  type: string
  balance: number
  status: string
  openedAt: string
}

export interface Bundle {
  _id: string
  applicantId: string
  source: 'crs' | 'nessie' | 'mock'
  pulledAt: number
  credit: {
    fico9: number | null
    vantage4: number | null
    tradelines: Tradeline[]
    inquiries6mo: number
    utilization: number | null
  }
  identity: { verified: boolean; flags: string[] }
  fraud: { score: number | null; signals: string[] }
  flags: { deceased: boolean; frozen: boolean; bankruptcy: boolean; eviction: boolean }
  raw: unknown
}

export type Lender = 'cu' | 'fintech' | 'prime'
export type Provider = 'claude' | 'creao'
export type Tier = 'excellent' | 'good' | 'fair' | 'poor'

export interface Reason {
  text: string
  field: string
}

export interface MarketAnchor {
  tier: Tier
  aprLow: number
  aprHigh: number
}

export interface Offer {
  _id: string
  applicantId: string
  lender: Lender
  provider: Provider
  status: 'pending' | 'done' | 'failed'
  decision: 'approve' | 'decline' | null
  apr: number | null
  termMonths: number | null
  amount: number | null
  conditions: string[]
  reasons: Reason[]
  marketAnchor: MarketAnchor | null
  runId: string | null
  shareUrl: string | null
  latencyMs: number | null
  createdAt: number
  /** Proposed addition (design/open.md): code-derived from requested vs offered terms. */
  classification?: OfferClassification
}

export type OfferClassification = 'approve' | 'counteroffer' | 'deny'

/** Proposed table (design/open.md): counterfactual test of one decline reason. */
export interface ReasonCheck {
  _id: string
  offerId: string
  applicantId: string
  field: string
  original: unknown
  counterfactual: unknown
  flipped: boolean
  latencyMs: number
  createdAt: number
}

export interface Notice {
  _id: string
  applicantId: string
  text: string
  lendersDeclined: string[]
  createdAt: number
  /** Set by the backend compliance step (convex/schema.ts); absent in the mock. */
  required?: boolean
  requiredBecause?: string
  droppedReasons?: Array<{ lender: string; field: string; text: string }>
}

export interface Decision {
  _id: string
  applicantId: string
  chosenOfferId: string | null
  outcome: 'approved' | 'declined' | 'hard_stop'
  approvedBy: 'human'
  at: number
  note: string
}

export type Actor =
  | 'intake'
  | 'desk'
  | 'crs'
  | 'rules'
  | 'underwriter:cu'
  | 'underwriter:fintech'
  | 'underwriter:prime'
  | 'compliance'
  | 'human'
  | 'applicant'

export interface AuditEvent {
  _id: string
  applicantId: string
  at: number
  actor: Actor
  action: string
  ref: string | null
  note: string
}

export interface EvalCase {
  _id: string
  personaId: string
  expected: 'approve' | 'decline' | 'hard_stop'
  expectedReasonsIncludes: string[]
  note: string
}

export interface EvalFailure {
  personaId: string
  expected: string
  got: string
  why: string
}

export interface EvalRun {
  _id: string
  startedAt: number
  finishedAt: number | null
  cases: number
  agreement: number
  fraudZeroOffers: boolean
  avgReasonsPerDenial: number
  failures: EvalFailure[]
  /** Proposed addition (design/open.md): share of decline reasons whose counterfactual test flipped. */
  reasonsVerified?: number | null
}

export interface MarketRate {
  _id: string
  tier: Tier
  aprLow: number
  aprHigh: number
  source: string
  fetchedAt: number
}

// ---- UI-side helpers (not tables) ----

/** Persona card as printed in the judge deck. */
export interface PersonaCard {
  personaId: string
  name: string
  hint: string
}

export interface IntakeInput {
  personaId: string
  purpose: string
  amountRequested: number
  statedIncome: number
}

/** Pipeline steps shown on the rail, in order. Audit actions `step.<id>.start` / `step.<id>.done` drive the timing. */
export const PIPELINE_STEPS = [
  { id: 'pull', label: 'Pull' },
  { id: 'guardrails', label: 'Guardrails' },
  { id: 'underwrite', label: 'Underwrite' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'human', label: 'Human' },
] as const

export type StepId = (typeof PIPELINE_STEPS)[number]['id']

export const LENDERS: Array<{ id: Lender; label: string; name: string; policy: string }> = [
  { id: 'cu', label: 'Credit Union', name: 'Pacific Ridge Credit Union', policy: 'Conservative' },
  { id: 'fintech', label: 'Fintech', name: 'Northstar Lending', policy: 'Growth' },
  { id: 'prime', label: 'Prime', name: 'Meridian Bank Prime', policy: 'Prime bank' },
]
