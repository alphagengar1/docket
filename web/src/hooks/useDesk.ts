// The ONLY module in web/ that touches data. Components import useDesk and nothing else.
// Implementation is chosen once at load time (so hook order is stable):
//   VITE_DATA=mock    -> in-memory mock (useDesk.mock.ts); also the offline demo insurance
//   VITE_DATA=convex  -> live Convex backend (useDesk.convex.ts)
//   unset             -> convex when VITE_CONVEX_URL is set, else mock
// Replay mode (?replay=1) is local in both implementations.
import type { Applicant, AuditEvent, Bundle, Decision, IntakeInput, Notice, Offer, PersonaCard } from '../types'
import type { DeskState } from '../mock/store'
import { useConvexApplicantSlice, useConvexDesk } from './useDesk.convex'
import { useMockDesk } from './useDesk.mock'

export type Connection = 'mock' | 'replay' | 'live'

export interface DeskPersona extends PersonaCard {
  defaults: { purpose: string; amountRequested: number; statedIncome: number }
}

/** Backend `desk:config` (undefined for mock). */
export interface DeskConfig {
  productName?: string
  commit?: string | null
  lenderTimeoutSeconds?: number
  crsProvider?: string
}

export interface Desk extends DeskState {
  connection: Connection
  personas: DeskPersona[]
  replaying: boolean
  createApplicant: (input: IntakeInput) => Promise<string>
  approveOffer: (applicantId: string, offerId: string, note?: string) => Promise<void>
  declineApplicant: (applicantId: string, note?: string) => Promise<void>
  /** Applicant disputes a tradeline: re-pull + re-run as a linked replay applicant. Returns the replay's id. */
  disputeTradeline: (applicantId: string, tradelineIndex: number) => Promise<string>
  runEval: () => Promise<void>
  /** Delete every applicant (operator Reset). Undefined when the backend has no such verb (mock). */
  resetBoard?: () => Promise<void>
  /** Backend config chrome: SANDBOX tag. Undefined for mock. */
  sandbox?: boolean
  config?: DeskConfig
  startReplay: () => void
  stopReplay: () => void
}

const wanted = import.meta.env.VITE_DATA as string | undefined
export const DATA_SOURCE: 'mock' | 'convex' =
  wanted === 'mock' || wanted === 'convex' ? wanted : import.meta.env.VITE_CONVEX_URL ? 'convex' : 'mock'

export const useDesk: () => Desk = DATA_SOURCE === 'convex' ? useConvexDesk : useMockDesk

/** One applicant's rows from a per-applicant query. Undefined while loading, in mock/replay mode, or when no id. */
export interface ApplicantSlice {
  applicant: Applicant | null
  offers: Offer[]
  auditEvents: AuditEvent[]
  bundles: Bundle[]
  notices: Notice[]
  decisions: Decision[]
}
const noSlice = (_id: string | null, _replaying: boolean): ApplicantSlice | undefined => undefined
export const useApplicantSlice: (id: string | null, replaying: boolean) => ApplicantSlice | undefined =
  DATA_SOURCE === 'convex' ? useConvexApplicantSlice : noSlice
