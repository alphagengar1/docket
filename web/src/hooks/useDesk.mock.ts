// The ONLY module in web/ that touches data. Components import useDesk and nothing else.
// Today it is backed by the mock layer in src/mock/. Tomorrow it is backed by Convex: see useDesk.convex.ts.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { IntakeInput, PersonaCard } from '../types'
import * as mock from '../mock/desk'
import type { DeskState } from '../mock/store'

export type Connection = 'mock' | 'replay' | 'live'

export interface DeskPersona extends PersonaCard {
  defaults: { purpose: string; amountRequested: number; statedIncome: number }
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
  startReplay: () => void
  stopReplay: () => void
}

function replayFlagFromUrl() {
  if (typeof window === 'undefined') return false
  const q = new URLSearchParams(window.location.search)
  return q.get('replay') === '1' || import.meta.env.VITE_REPLAY === '1'
}

export function useDesk(): Desk {
  const [replaying, setReplaying] = useState<boolean>(replayFlagFromUrl)
  const store = replaying ? mock.replayStore : mock.liveStore
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState)

  useEffect(() => {
    if (!replaying) return
    const cancel = mock.startReplay()
    return cancel
  }, [replaying])

  const createApplicant = useCallback(async (input: IntakeInput) => mock.createApplicant(input), [])
  const approveOffer = useCallback(
    async (applicantId: string, offerId: string, note?: string) => mock.approveOffer(store, applicantId, offerId, note),
    [store],
  )
  const declineApplicant = useCallback(
    async (applicantId: string, note?: string) => mock.declineApplicant(store, applicantId, note),
    [store],
  )
  const disputeTradeline = useCallback(
    async (applicantId: string, tradelineIndex: number) => mock.disputeTradeline(store, applicantId, tradelineIndex),
    [store],
  )
  const runEval = useCallback(() => mock.runEval(store), [store])
  const startReplay = useCallback(() => setReplaying(true), [])
  const stopReplay = useCallback(() => setReplaying(false), [])

  return useMemo(
    () => ({
      ...state,
      connection: replaying ? 'replay' : 'mock',
      personas: mock.DECK,
      replaying,
      createApplicant,
      approveOffer,
      declineApplicant,
      disputeTradeline,
      runEval,
      startReplay,
      stopReplay,
    }),
    [state, replaying, createApplicant, approveOffer, declineApplicant, disputeTradeline, runEval, startReplay, stopReplay],
  )
}
