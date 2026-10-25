// Desk assistant client. Convex mode calls assistant:ask / assistant:summarize; mock mode answers with a stub.
import { useAction, useQuery } from 'convex/react'
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
  /** Same question, history and applicant scope as ask, answered by an OpenAI model. Informational only. */
  askSecondOpinion: (applicantId: string | null, question: string, history: AssistantTurn[]) => Promise<AssistantAnswer>
  /** desk:config.secondOpinionEnabled: true when the deployment has OPENAI_API_KEY. */
  secondOpinionEnabled: boolean
}

function useConvexAssistant(): AssistantApi {
  const ask = useAction(anyApi.assistant.ask)
  const summarize = useAction(anyApi.assistant.summarize)
  const second = useAction(anyApi.assistant.askSecondOpinion)
  const config = useQuery(anyApi.desk.config, {}) as { secondOpinionEnabled?: boolean } | undefined
  return {
    secondOpinionEnabled: config?.secondOpinionEnabled === true,
    askSecondOpinion: (applicantId, question, history) => second({ applicantId, question, history }) as Promise<AssistantAnswer>,
    ask: (applicantId, question, history) => ask({ applicantId, question, history }) as Promise<AssistantAnswer>,
    summarize: (applicantId) => summarize({ applicantId }) as Promise<AssistantAnswer>,
  }
}

const mockAnswer = async (): Promise<AssistantAnswer> => ({
  text: 'Stub answer: the mock desk has no backend, so the assistant is offline. A human approves every offer.',
  model: 'stub',
  latencyMs: 0,
  scope: 'desk',
  stub: true,
})
const mockAssistant: AssistantApi = { ask: mockAnswer, summarize: mockAnswer, askSecondOpinion: mockAnswer, secondOpinionEnabled: false }
function useMockAssistant(): AssistantApi {
  return mockAssistant
}

export const useAssistant: () => AssistantApi = DATA_SOURCE === 'convex' ? useConvexAssistant : useMockAssistant
