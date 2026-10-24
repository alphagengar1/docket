// Mock-backed Desk (in-memory store + scripted replay). Selected by useDesk.ts when VITE_DATA=mock.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { IntakeInput } from '../types'
import * as mock from '../mock/desk'

import type { Desk } from './useDesk'

export function replayFlagFromUrl() {
  if (typeof window === 'undefined') return false
  const q = new URLSearchParams(window.location.search)
  return q.get('replay') === '1' || import.meta.env.VITE_REPLAY === '1'
}

export function useMockDesk(): Desk {
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
