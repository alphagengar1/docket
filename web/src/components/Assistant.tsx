import { useEffect, useRef, useState } from 'react'
import type { Applicant } from '../types'
import type { AssistantApi, AssistantTurn } from '../hooks/useAssistant'

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
}

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

  const run = async (label: string, call: (history: AssistantTurn[]) => ReturnType<AssistantApi['ask']>) => {
    if (busy) return
    const history = msgs.filter((m) => !m.pending).map(({ role, content }) => ({ role, content }))
    const uid = ++seq.current
    const aid = ++seq.current
    setBusy(true)
    setMsgs((m) => [...m, { id: uid, role: 'user', content: label }, { id: aid, role: 'assistant', content: '', pending: true }])
    try {
      const r = await call(history)
      const meta = `${r.model} · ${(r.latencyMs / 1000).toFixed(1)}s${r.stub ? ' · stub' : ''}`
      setMsgs((m) => m.map((x) => (x.id === aid ? { ...x, content: r.text, meta, pending: false } : x)))
    } catch (e) {
      setMsgs((m) => m.map((x) => (x.id === aid ? { ...x, content: `Request failed: ${e instanceof Error ? e.message : 'unknown error'}`, pending: false } : x)))
    } finally {
      setBusy(false)
    }
  }

  const send = (q: string) => {
    const question = q.trim()
    if (!question) return
    setInput('')
    void run(question, (history) => api.ask(applicantId, question, history))
  }
  const summarize = () => {
    if (applicantId) void run('Summarize this applicant', () => api.summarize(applicantId))
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
      <div className="pane-body ast-msgs">
        {msgs.length === 0 && (
          <div className="ast-empty">
            Ask about {applicant ? 'this applicant' : 'the desk'}. I explain what happened and never decide; a human approves every offer.
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={`ast-msg ${m.role}`}>
            <div className="ast-text">{m.pending ? <span className="skel" style={{ width: 160, height: 12 }} /> : m.content}</div>
            {m.meta && <div className="ast-meta mono">{m.meta}</div>}
          </div>
        ))}
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
