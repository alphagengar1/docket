// ============================================================================================
//  MORNING WIRING STUB — NOT COMPILED YET (not imported anywhere).
//  When convex/ is ready: `npm i convex`, wrap <App/> in <ConvexProvider client={new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)}>,
//  then rename this file to useDesk.ts (keep the mock one as useDesk.mock.ts). Components do not change.
//  convex/ exports as of Sat 02:30 (convex/desk.ts, eval.ts, market.ts, personas.ts):
//    queries   api.desk.listApplicants, api.desk.bundles, api.desk.offers, api.desk.notices, api.desk.decisions,
//              api.desk.auditEvents({limit?, applicantId?}), api.eval.cases, api.eval.runs, api.market.rates, api.personas.deck
//    mutations api.desk.createApplicant({personaId, purpose, amountRequested, statedIncome, name?}) → applicantId
//              api.desk.approveOffer({applicantId, offerId, note?}), api.desk.declineApplicant({applicantId, note})
//    actions   api.eval.runEval()
//  Differentiators (design/differentiators.md) still to land in convex/ — the UI already reads these shapes:
//    offers.classification: "approve"|"counteroffer"|"deny"       (status word on the card, notice-required line)
//    applicants.replayOf: Id<"applicants"> | null                 (dispute replay; before/after columns)
//    reasonChecks table {offerId, applicantId, field, original, counterfactual, flipped, latencyMs, createdAt}
//              query api.desk.reasonChecks (or include in board); action api.desk.verifyReasons({offerId})
//    mutation  api.desk.disputeTradeline({applicantId, tradelineIndex}) → replay applicantId; audit actor "applicant"
//    evalRuns.reasonsVerified: number | null                     (eval tile)
//  The pipeline rail reads audit actions `step.<pull|guardrails|underwrite|compliance|human>.start|done` (actor "desk"),
//  the hard-stop card reads `rules.hard_stop` (ref = triggering field). Both already match convex/desk.ts.
// ============================================================================================
/* eslint-disable */
// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react'
// import { useQuery, useMutation, useAction } from 'convex/react'
// import { api } from '../../../convex/_generated/api'
import type { IntakeInput } from '../types'
import type { Desk } from './useDesk'
import * as mock from '../mock/desk'
import { useSyncExternalStore } from 'react'

export function useDesk(): Desk {
  // Replay mode stays local even when live: it is the demo insurance if Convex is unreachable.
  const [replaying, setReplaying] = useState(() => new URLSearchParams(location.search).get('replay') === '1')
  const replayState = useSyncExternalStore(mock.replayStore.subscribe, mock.replayStore.getState, mock.replayStore.getState)
  useEffect(() => (replaying ? mock.startReplay() : undefined), [replaying])

  // --- live queries (each returns undefined while loading; useDesk normalizes to []) ---
  // const applicants  = useQuery(api.desk.listApplicants) ?? []
  // const bundles     = useQuery(api.desk.bundles) ?? []
  // const offers      = useQuery(api.desk.offers) ?? []
  // const notices     = useQuery(api.desk.notices) ?? []
  // const decisions   = useQuery(api.desk.decisions) ?? []
  // const auditEvents = useQuery(api.desk.auditEvents, { limit: 500 }) ?? []
  // const evalCases   = useQuery(api.eval.cases) ?? []
  // const evalRuns    = useQuery(api.eval.runs) ?? []
  // const marketRates = useQuery(api.market.rates) ?? []
  // const reasonChecks = useQuery(api.desk.reasonChecks) ?? []
  // const personas    = useQuery(api.personas.deck) ?? mock.DECK   // deck rows lack `defaults`; merge from mock.DECK by personaId

  // --- live mutations / actions ---
  // const createApplicantMut  = useMutation(api.desk.createApplicant)   // args: IntakeInput & { name } → returns applicantId; schedules runDesk
  // const approveOfferMut     = useMutation(api.desk.approveOffer)      // args: { applicantId, offerId, note } → decisions row, status "approved", human audit event
  // const declineApplicantMut = useMutation(api.desk.declineApplicant)  // args: { applicantId, note }
  // const runEvalAction       = useAction(api.eval.runEval)             // no args → evalRuns row
  // const disputeMut          = useMutation(api.desk.disputeTradeline)  // args: { applicantId, tradelineIndex } → replay applicantId

  const createApplicant = useCallback(async (input: IntakeInput) => {
    // return await createApplicantMut(input)
    return ''
  }, [])
  const approveOffer = useCallback(async (applicantId: string, offerId: string, note = '') => {
    if (replaying) return mock.approveOffer(mock.replayStore, applicantId, offerId, note)
    // await approveOfferMut({ applicantId, offerId, note })
  }, [replaying])
  const declineApplicant = useCallback(async (applicantId: string, note = '') => {
    if (replaying) return mock.declineApplicant(mock.replayStore, applicantId, note)
    // await declineApplicantMut({ applicantId, note })
  }, [replaying])
  const runEval = useCallback(async () => {
    if (replaying) return mock.runEval(mock.replayStore)
    // await runEvalAction()
  }, [replaying])
  const disputeTradeline = useCallback(async (applicantId: string, tradelineIndex: number) => {
    if (replaying) return mock.disputeTradeline(mock.replayStore, applicantId, tradelineIndex)
    // return await disputeMut({ applicantId, tradelineIndex })
    return ''
  }, [replaying])

  return useMemo<Desk>(() => {
    const live = {
      applicants: [], bundles: [], offers: [], notices: [], decisions: [], auditEvents: [], reasonChecks: [], evalCases: [], evalRuns: [], marketRates: [],
      // applicants, bundles, offers, notices, decisions, auditEvents, reasonChecks, evalCases, evalRuns, marketRates,
    }
    return {
      ...(replaying ? replayState : live),
      connection: replaying ? 'replay' : 'live',
      personas: mock.DECK, // or `personas`
      replaying,
      createApplicant,
      approveOffer,
      declineApplicant,
      disputeTradeline,
      runEval,
      startReplay: () => setReplaying(true),
      stopReplay: () => setReplaying(false),
    }
  }, [replaying, replayState, createApplicant, approveOffer, declineApplicant, disputeTradeline, runEval])
}
