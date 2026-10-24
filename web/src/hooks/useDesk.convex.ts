// Convex-backed Desk. Same shape as the mock; components do not know the difference.
// Replay mode (?replay=1) stays local (mock replayStore) so it works with the backend down: demo insurance.
//
// Backend -> UI adaptations (all done here, none in components):
//   evalRuns.reasonsVerifiedPct  -> EvalRun.reasonsVerified (both are fractions 0..1)
//   bundles (raw stripped)       -> Bundle.raw = null
//   reasonChecks                 -> one row per (offer, field): backend writes several rows per field
//                                   (single / leave_one_out / all_fixed); the UI wants a single `flipped`.
//                                   `flipped` := offers.reasons[].verified (the backend's final verdict, which is
//                                   also what the compliance agent used to drop reasons from the notice).
//   personas.deck                -> PersonaCard + `defaults` merged from the mock deck (same values as
//                                   crs.mock.ts defaultIntake); unknown ids get generic defaults.
//   audit action names           -> identical to the UI's expectations (step.<id>.start|done, rules.hard_stop).
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { anyApi } from 'convex/server'
import type {
  Applicant,
  AuditEvent,
  Bundle,
  Decision,
  EvalCase,
  EvalRun,
  IntakeInput,
  MarketRate,
  Notice,
  Offer,
  ReasonCheck,
} from '../types'
import type { Desk, DeskPersona } from './useDesk'
import * as mock from '../mock/desk'
import { replayFlagFromUrl } from './useDesk.mock'

// Untyped on purpose: importing convex/_generated/api would make web's stricter tsconfig type-check convex/*.ts.
// Function names below are the real exports of convex/desk.ts, verify.ts, eval.ts, market.ts, personas.ts.
const api = anyApi

const EMPTY: never[] = []
const FALLBACK_DEFAULTS = { purpose: 'Debt consolidation', amountRequested: 15000, statedIncome: 60000 }

function adaptChecks(offers: Offer[], raw: Array<Record<string, unknown>>): ReasonCheck[] {
  const out: ReasonCheck[] = []
  for (const o of offers) {
    if (o.status !== 'done' || o.decision !== 'decline') continue
    const mine = raw.filter((c) => c.offerId === o._id)
    if (mine.length === 0) continue // tests not run yet: UI shows "pending"
    for (const r of o.reasons) {
      const rows = mine.filter((c) => c.field === r.field)
      const base = (rows.find((c) => c.method === 'single') ?? rows[0]) as Record<string, unknown> | undefined
      const verdict = (r as { verified?: boolean | null }).verified
      if (!base && verdict == null) continue
      out.push({
        _id: String(base?._id ?? `${o._id}:${r.field}`),
        offerId: o._id,
        applicantId: o.applicantId,
        field: r.field,
        original: base?.original ?? null,
        counterfactual: base?.counterfactual ?? null,
        flipped: verdict === true,
        latencyMs: Number(base?.latencyMs ?? 0),
        createdAt: Number(base?.createdAt ?? o.createdAt),
      })
    }
  }
  return out
}

export function useConvexDesk(): Desk {
  const [replaying, setReplaying] = useState<boolean>(replayFlagFromUrl)
  const replayState = useSyncExternalStore(mock.replayStore.subscribe, mock.replayStore.getState, mock.replayStore.getState)
  useEffect(() => (replaying ? mock.startReplay() : undefined), [replaying])

  const skip = replaying ? ('skip' as const) : undefined
  const applicantsQ = useQuery(api.desk.listApplicants, skip ?? {})
  const bundlesQ = useQuery(api.desk.bundles, skip ?? {})
  const offersQ = useQuery(api.desk.offers, skip ?? {})
  const noticesQ = useQuery(api.desk.notices, skip ?? {})
  const decisionsQ = useQuery(api.desk.decisions, skip ?? {})
  const auditQ = useQuery(api.desk.auditEvents, skip ?? { limit: 300 })
  const checksQ = useQuery(api.verify.reasonChecks, skip ?? {})
  const casesQ = useQuery(api.eval.cases, skip ?? {})
  const runsQ = useQuery(api.eval.runs, skip ?? {})
  const ratesQ = useQuery(api.market.rates, skip ?? {})
  const deckQ = useQuery(api.personas.deck, skip ?? {})

  const createM = useMutation(api.desk.createApplicant)
  const approveM = useMutation(api.desk.approveOffer)
  const declineM = useMutation(api.desk.declineApplicant)
  const disputeM = useMutation(api.desk.disputeTradeline)
  const evalA = useAction(api.eval.runEvalNow)

  const createApplicant = useCallback(
    async (input: IntakeInput) => {
      if (replaying) return mock.createApplicant(input)
      return String(await createM(input))
    },
    [replaying, createM],
  )
  const approveOffer = useCallback(
    async (applicantId: string, offerId: string, note = '') => {
      if (replaying) return mock.approveOffer(mock.replayStore, applicantId, offerId, note)
      await approveM({ applicantId: applicantId, offerId: offerId, note })
    },
    [replaying, approveM],
  )
  const declineApplicant = useCallback(
    async (applicantId: string, note = '') => {
      if (replaying) return mock.declineApplicant(mock.replayStore, applicantId, note)
      await declineM({ applicantId: applicantId, note })
    },
    [replaying, declineM],
  )
  const disputeTradeline = useCallback(
    async (applicantId: string, tradelineIndex: number) => {
      if (replaying) return mock.disputeTradeline(mock.replayStore, applicantId, tradelineIndex)
      return String(await disputeM({ applicantId: applicantId, tradelineIndex }))
    },
    [replaying, disputeM],
  )
  const runEval = useCallback(async () => {
    if (replaying) return mock.runEval(mock.replayStore)
    await evalA({})
  }, [replaying, evalA])

  const personas = useMemo<DeskPersona[]>(() => {
    if (!deckQ) return mock.DECK
    return (deckQ as Array<{ personaId: string; name: string; hint: string }>).map((p) => {
      const m = mock.DECK.find((d) => d.personaId === p.personaId)
      return { personaId: p.personaId, name: p.name, hint: p.hint, defaults: m?.defaults ?? FALLBACK_DEFAULTS }
    })
  }, [deckQ])

  const live = useMemo(() => {
    const offers = (offersQ ?? EMPTY) as unknown as Offer[]
    return {
      applicants: (applicantsQ ?? EMPTY) as unknown as Applicant[],
      bundles: ((bundlesQ ?? EMPTY) as unknown as Bundle[]).map((b) => ({ ...b, raw: null })),
      offers,
      notices: (noticesQ ?? EMPTY) as unknown as Notice[],
      decisions: (decisionsQ ?? EMPTY) as unknown as Decision[],
      auditEvents: (auditQ ?? EMPTY) as unknown as AuditEvent[],
      reasonChecks: adaptChecks(offers, (checksQ ?? EMPTY) as unknown as Array<Record<string, unknown>>),
      evalCases: (casesQ ?? EMPTY) as unknown as EvalCase[],
      evalRuns: ((runsQ ?? EMPTY) as unknown as Array<EvalRun & { reasonsVerifiedPct?: number }>).map((r) => ({
        ...r,
        reasonsVerified: r.reasonsVerifiedPct ?? r.reasonsVerified ?? null,
      })),
      marketRates: (ratesQ ?? EMPTY) as unknown as MarketRate[],
    }
  }, [applicantsQ, bundlesQ, offersQ, noticesQ, decisionsQ, auditQ, checksQ, casesQ, runsQ, ratesQ])

  return useMemo<Desk>(
    () => ({
      ...(replaying ? replayState : live),
      connection: replaying ? 'replay' : 'live',
      personas,
      replaying,
      createApplicant,
      approveOffer,
      declineApplicant,
      disputeTradeline,
      runEval,
      startReplay: () => setReplaying(true),
      stopReplay: () => setReplaying(false),
    }),
    [replaying, replayState, live, personas, createApplicant, approveOffer, declineApplicant, disputeTradeline, runEval],
  )
}
