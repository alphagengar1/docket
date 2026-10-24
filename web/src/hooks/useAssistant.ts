// Desk assistant client. Convex mode calls assistant:ask / assistant:summarize; mock mode answers with a stub.
import { useAction } from 'convex/react'
import { anyApi } from 'convex/server'
import { DATA_SOURCE } from './useDesk'

export interface AssistantAnswer {
  text: string
  model: string
  latencyMs: number
  scope: 'applicant' | 'desk'
  stub: boolean
}
export interface AssistantTurn {
  role: 'user' | 'assistant'
  content: string
}
export interface AssistantApi {
  ask: (applicantId: string | null, question: string, history: AssistantTurn[]) => Promise<AssistantAnswer>
  summarize: (applicantId: string) => Promise<AssistantAnswer>
}

function useConvexAssistant(): AssistantApi {
  const ask = useAction(anyApi.assistant.ask)
  const summarize = useAction(anyApi.assistant.summarize)
  return {
    ask: (applicantId, question, history) => ask({ applicantId, question, history }) as Promise<AssistantAnswer>,
    summarize: (applicantId) => summarize({ applicantId }) as Promise<AssistantAnswer>,
  }
}

const mockAnswer = async (): Promise<AssistantAnswer> => ({
  text: 'Stub answer: the mock desk has no backend, so the assistant cannot call Claude. A human approves every offer.',
  model: 'stub',
  latencyMs: 0,
  scope: 'desk',
  stub: true,
})
const mockAssistant: AssistantApi = { ask: mockAnswer, summarize: mockAnswer }
function useMockAssistant(): AssistantApi {
  return mockAssistant
}

export const useAssistant: () => AssistantApi = DATA_SOURCE === 'convex' ? useConvexAssistant : useMockAssistant
