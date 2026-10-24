import { useEffect, useRef, useState } from 'react'
import type { Applicant } from '../types'
import type { AssistantAnswer, AssistantApi, AssistantTurn } from '../hooks/useAssistant'

interface Props {
  api: AssistantApi
  applicant: Applicant | undefined
  /** Bumped by the drawer link: run "Summarize this applicant" for the current applicant. */
  summonKey: number
}

interface Msg extends AssistantTurn {
  id: number
  meta?: string
  pending?: boolean
  /** Set on answers: what to re-ask GPT, the history before it, and the scope it was asked in. */
  again?: { question: string; history: AssistantTurn[]; applicantId: string | null }
  second?: { pending: boolean; text?: string; meta?: string }
}

const metaOf = (r: AssistantAnswer) => `${r.model} · ${(r.latencyMs / 1000).toFixed(1)}s${r.stub ? ' · stub' : ''}`

const SUMMARY_SECOND_QUESTION = 'Summarize this applicant in four bullets: bureau, lenders, what verification withheld, next step'

const SUGGESTED = ['Why did the credit union decline?', 'What would flip this to an approval?', 'Is a notice required?']

/** Desk assistant: ask about the selected applicant (or the desk when none). Not streamed; read-only. */
export function Assistant({ api, applicant, summonKey }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)
  const end = useRef<HTMLDivElement>(null)
  const applicantId = applicant?._id ?? null

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [msgs])

  const run = async (label: string, call: (history: AssistantTurn[]) => ReturnType<AssistantApi['ask']>, secondQuestion: string = label) => {
    if (busy) return
    const history = msgs.filter((m) => !m.pending).map(({ role, content }) => ({ role, content }))
    const uid = ++seq.current
    const aid = ++seq.current
    setBusy(true)
    setMsgs((m) => [...m, { id: uid, role: 'user', content: label }, { id: aid, role: 'assistant', content: '', pending: true }])
    try {
      const r = await call(history)
      const again = { question: secondQuestion, history, applicantId }
      setMsgs((m) => m.map((x) => (x.id === aid ? { ...x, content: r.text, meta: metaOf(r), pending: false, again } : x)))
    } catch (e) {
      setMsgs((m) => m.map((x) => (x.id === aid ? { ...x, content: `Request failed: ${e instanceof Error ? e.message : 'unknown error'}`, pending: false } : x)))
    } finally {
      setBusy(false)
    }
  }

  const secondOpinion = async (id: number) => {
    const target = msgs.find((m) => m.id === id)
    if (!target?.again || target.second) return
    const { question, history, applicantId: scope } = target.again
    const set = (second: Msg['second']) => setMsgs((m) => m.map((x) => (x.id === id ? { ...x, second } : x)))
    set({ pending: true })
    try {
      const r = await api.askSecondOpinion(scope, question, history)
      set({ pending: false, text: r.text, meta: metaOf(r) })
    } catch (e) {
      set({ pending: false, text: `Request failed: ${e instanceof Error ? e.message : 'unknown error'}`, meta: 'error' })
    }
  }

  const send = (q: string) => {
    const question = q.trim()
    if (!question) return
    setInput('')
    void run(question, (history) => api.ask(applicantId, question, history))
  }
  const summarize = () => {
    if (applicantId) void run('Summarize this applicant', () => api.summarize(applicantId), SUMMARY_SECOND_QUESTION)
  }

  // The audit drawer's "Ask the assistant to summarize" link bumps summonKey.
  const lastKey = useRef(summonKey)
  useEffect(() => {
    if (summonKey !== lastKey.current) {
      lastKey.current = summonKey
      summarize()
    }
  })

  return (
    <aside className="pane assistant" aria-label="Assistant">
      <div className="pane-head">
        <span className="section-label">Assistant</span>
        <span className="mono muted ast-scope">{applicant ? applicant.name : 'whole desk'}</span>
      </div>
      {api.secondOpinionEnabled && <div className="ast-note mono">Second opinions are informational. A human approves every offer.</div>}
      <div className="pane-body ast-msgs">
        {msgs.length === 0 && (
          <div className="ast-empty">
            Ask about {applicant ? 'this applicant' : 'the desk'}. I explain what happened and never decide; a human approves every offer.
          </div>
        )}
        {msgs.map((m) => {
          const side = m.second && (m.second.pending || m.second.text !== undefined)
          return (
            <div key={m.id} className={`ast-msg ${m.role}${side ? ' ast-compare-wrap' : ''}`}>
              {side ? (
                <div className="ast-compare">
                  <div className="ast-col">
                    <div className="ast-col-head mono">{m.meta?.split(' · ')[0] ?? 'Claude'}</div>
                    <div className="ast-text">{m.content}</div>
                    {m.meta && <div className="ast-meta mono">{m.meta}</div>}
                  </div>
                  <div className="ast-col">
                    <div className="ast-col-head mono">{m.second?.meta?.split(' · ')[0] ?? 'GPT'}</div>
                    <div className="ast-text">{m.second?.pending ? <span className="skel" style={{ width: 160, height: 12 }} /> : m.second?.text}</div>
                    {m.second?.meta && <div className="ast-meta mono">{m.second.meta}</div>}
                  </div>
                </div>
              ) : (
                <>
                  <div className="ast-text">{m.pending ? <span className="skel" style={{ width: 160, height: 12 }} /> : m.content}</div>
                  {m.meta && <div className="ast-meta mono">{m.meta}</div>}
                </>
              )}
              {api.secondOpinionEnabled && m.again && !m.second && (
                <button type="button" className="ghost ast-second" disabled={busy} onClick={() => void secondOpinion(m.id)}>
                  Second opinion (GPT)
                </button>
              )}
            </div>
          )
        })}
        <div ref={end} />
      </div>
      <div className="ast-foot">
        <button type="button" onClick={summarize} disabled={!applicantId || busy}>
          Summarize this applicant
        </button>
        <div className="ast-chips">
          {SUGGESTED.map((q) => (
            <button key={q} type="button" className="ghost" disabled={busy} onClick={() => send(q)}>
              {q}
            </button>
          ))}
        </div>
        <form
          className="ast-form"
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
        >
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question" aria-label="Ask the assistant" />
          <button type="submit" disabled={busy || !input.trim()}>
            Ask
          </button>
        </form>
      </div>
    </aside>
  )
}
