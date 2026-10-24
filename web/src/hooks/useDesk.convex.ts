// ============================================================================================
//  MORNING WIRING STUB — NOT COMPILED YET (not imported anywhere).
//  When convex/ is ready: `npm i convex`, wrap <App/> in <ConvexProvider client={new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)}>,
//  then rename this file to useDesk.ts (keep the mock one as useDesk.mock.ts). Components do not change.
//  Expected convex/ exports (see design/architecture.md):
//    api.desk.listApplicants, api.desk.board (bundles/offers/notices/decisions for one applicant or all),
//    api.desk.auditEvents, api.eval.cases, api.eval.runs, api.market.rates,
//    api.desk.createApplicant (mutation → schedules runDesk), api.desk.approveOffer, api.desk.declineApplicant,
//    api.eval.runEval (action), api.personas.deck (query or a static import from personas/map.json).
//  The pipeline rail needs auditEvents with actions `step.<pull|guardrails|underwrite|compliance|human>.start|done`
//  (actor "desk"); keep those names in convex/desk.ts so timing renders for free.
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
  // const personas    = useQuery(api.personas.deck) ?? mock.DECK

  // --- live mutations / actions ---
  // const createApplicantMut  = useMutation(api.desk.createApplicant)   // args: IntakeInput & { name } → returns applicantId; schedules runDesk
  // const approveOfferMut     = useMutation(api.desk.approveOffer)      // args: { applicantId, offerId, note } → decisions row, status "approved", human audit event
  // const declineApplicantMut = useMutation(api.desk.declineApplicant)  // args: { applicantId, note }
  // const runEvalAction       = useAction(api.eval.runEval)             // no args → evalRuns row

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

  return useMemo<Desk>(() => {
    const live = {
      applicants: [], bundles: [], offers: [], notices: [], decisions: [], auditEvents: [], evalCases: [], evalRuns: [], marketRates: [],
      // applicants, bundles, offers, notices, decisions, auditEvents, evalCases, evalRuns, marketRates,
    }
    return {
      ...(replaying ? replayState : live),
      connection: replaying ? 'replay' : 'live',
      personas: mock.DECK, // or `personas`
      replaying,
      createApplicant,
      approveOffer,
      declineApplicant,
      runEval,
      startReplay: () => setReplaying(true),
      stopReplay: () => setReplaying(false),
    }
  }, [replaying, replayState, createApplicant, approveOffer, declineApplicant, runEval])
}
