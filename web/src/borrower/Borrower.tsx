// Mobile borrower route (#/borrower): the judge holds this on a phone. Live via Convex.
// Backend names (convex/desk.ts): lookupCode, createApplicant({cardCode}), borrowerView, chooseOffer,
// attemptOverride, approveNotice, auditEvents({applicantId}). The phone never receives bureau data.
import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { anyApi } from 'convex/server'
import './borrower.css'

const api = anyApi
const KEY = 'docket.borrower.applicantId'

interface Lookup {
  code: string
  displayName: string
  purpose: string
  amountRequested: number
}
interface BOffer {
  offerId: string
  lender: string
  lenderName: string
  apr: number
  monthlyPayment: number
  termMonths: number
  amount: number
}
interface BView {
  applicantId: string
  name: string
  purpose: string
  amountRequested: number
  status: 'checking' | 'offers' | 'waiting_for_underwriter' | 'approved' | 'declined' | 'stopped'
  offers: BOffer[]
  chosenOfferId: string | null
  noticeText: string | null
  noticeReady: boolean
  overrideResult: string | null
}
interface Audit {
  action: string
}

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')

function load(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}
function save(id: string | null) {
  try {
    if (id) sessionStorage.setItem(KEY, id)
    else sessionStorage.removeItem(KEY)
  } catch {
    /* storage unavailable: fine */
  }
}

function Shell({ children, onReset }: { children: React.ReactNode; onReset?: () => void }) {
  return (
    <div className="bw">
      <div className="bw-top">
        <span className="bw-mark" />
        <span className="bw-brand">Docket</span>
        <span className="bw-spacer" />
        {onReset && (
          <button type="button" className="bw-link" onClick={onReset}>
            Start over
          </button>
        )}
      </div>
      <div className="bw-main">{children}</div>
      <div className="bw-foot">SANDBOX · test persona</div>
    </div>
  )
}

function CodeEntry({ onStarted }: { onStarted: (id: string) => void }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const found = useQuery(api.desk.lookupCode, code.length === 4 ? { code } : 'skip') as Lookup | null | undefined
  const create = useMutation(api.desk.createApplicant)
  const bad = code.length === 4 && found === null
  const press = (k: string) => {
    setErr('')
    setCode((c) => (c.length < 4 ? c + k : c))
  }
  const go = async () => {
    setBusy(true)
    try {
      const id = String(await create({ cardCode: code }))
      save(id)
      onStarted(id)
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e).slice(0, 120))
      setBusy(false)
    }
  }
  return (
    <Shell>
      {found ? (
        <>
          <h1>Hi {found.displayName.split(' ')[0]}.</h1>
          <p>
            You need <b className="mono">{usd(found.amountRequested)}</b> for {found.purpose}.
          </p>
          <button type="button" className="bw-btn" onClick={go} disabled={busy}>
            {busy ? 'Starting…' : 'Find my offers'}
          </button>
          <button type="button" className="bw-btn alt" onClick={() => setCode('')}>
            Not me
          </button>
          {err && <div className="bw-err">{err}</div>}
        </>
      ) : (
        <>
          <h1>Enter the code on your card</h1>
          <div className="bw-code" aria-live="polite">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={bad ? 'bad' : i === code.length ? 'on' : ''}>
                {code[i] ?? ''}
              </div>
            ))}
          </div>
          {bad && <div className="bw-err">No card with that code.</div>}
          <div className="bw-keys">
            {KEYS.map((k) => (
              <button key={k} type="button" className="bw-key" onClick={() => press(k)}>
                {k}
              </button>
            ))}
            <button type="button" className="bw-key wide" onClick={() => setCode((c) => c.slice(0, -1))}>
              DEL
            </button>
            <button type="button" className="bw-key wide" onClick={() => setCode('')}>
              CLEAR
            </button>
          </div>
        </>
      )}
    </Shell>
  )
}

const STEPS = [
  { id: 'pull', label: 'Pulling your credit file' },
  { id: 'guardrails', label: 'Running safety checks' },
  { id: 'underwrite', label: 'Lenders are bidding' },
  { id: 'compliance', label: 'Preparing your paperwork' },
  { id: 'human', label: 'Waiting for a person' },
]

/** Progress line that follows the desk pipeline (audit step.<id>.start|done). */
function Progress({ applicantId, hard }: { applicantId: string; hard?: boolean }) {
  const events = (useQuery(api.desk.auditEvents, { applicantId, limit: 200 }) ?? []) as Audit[]
  let idx = 0
  let done = -1
  for (const e of events) {
    const m = /^step\.(pull|guardrails|underwrite|compliance|human)\.(start|done)$/.exec(e.action)
    if (!m) continue
    const i = STEPS.findIndex((s) => s.id === m[1])
    if (m[2] === 'start') idx = Math.max(idx, i)
    else done = Math.max(done, i)
  }
  const pct = Math.min(100, ((Math.max(idx, done + 1) + 0.4) / STEPS.length) * 100)
  return (
    <div className="bw-progress">
      <div className={`bw-bar ${hard ? 'hard' : ''}`}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="bw-step mono">
        {Math.min(idx + 1, STEPS.length)}/{STEPS.length} · {STEPS[Math.min(idx, STEPS.length - 1)].label}
      </div>
    </div>
  )
}

function OfferCard({ o, onPick, chosen, disabled }: { o: BOffer; onPick?: () => void; chosen?: boolean; disabled?: boolean }) {
  return (
    <button type="button" className={`bw-offer ${chosen ? 'chosen' : ''}`} onClick={onPick} disabled={disabled}>
      <div className="lender">{o.lenderName}</div>
      <div className="apr">
        {o.apr.toFixed(2)}
        <small> % APR</small>
      </div>
      <div className="row">
        <span>Monthly</span>
        <b>${o.monthlyPayment.toFixed(2)}</b>
      </div>
      <div className="row">
        <span>Term</span>
        <b>{o.termMonths} mo</b>
      </div>
      <div className="row">
        <span>Amount</span>
        <b>{usd(o.amount)}</b>
      </div>
    </button>
  )
}

function NoticeDoc({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/)
  return (
    <div className="bw-doc">
      <div className="bw-step mono">Notice of adverse action</div>
      {blocks.map((b, i) => {
        const lines = b.split('\n')
        const head = lines.filter((l) => !l.startsWith('- '))
        const items = lines.filter((l) => l.startsWith('- '))
        return (
          <div key={i}>
            {head.length > 0 && <p>{head.join('\n')}</p>}
            {items.length > 0 && (
              <ul>
                {items.map((l, j) => (
                  <li key={j}>{l.slice(2)}</li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Reviewer({ v }: { v: BView }) {
  const [on, setOn] = useState(false)
  const [msg, setMsg] = useState<string | null>(v.overrideResult)
  const [err, setErr] = useState('')
  const override = useMutation(api.desk.attemptOverride)
  const approve = useMutation(api.desk.approveNotice)
  const tryOverride = async () => {
    try {
      const r = (await override({ applicantId: v.applicantId })) as { reason: string }
      setMsg(r.reason)
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e).slice(0, 120))
    }
  }
  const sendNotice = async () => {
    try {
      await approve({ applicantId: v.applicantId })
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e).slice(0, 120))
    }
  }
  return (
    <>
      <div className="bw-toggle">
        <span>Reviewer mode</span>
        <button type="button" className="bw-switch" aria-pressed={on} aria-label="Reviewer mode" onClick={() => setOn(!on)} />
      </div>
      {on && (
        <div className="bw-reviewer">
          <button type="button" className="bw-btn orange" onClick={tryOverride}>
            Override and fund
          </button>
          {msg && <div className="bw-blocked">{msg.replace(/\.?$/, '')}. Logged.</div>}
          <button type="button" className="bw-btn" onClick={sendNotice}>
            Approve notice
          </button>
          {err && <div className="bw-err">{err}</div>}
        </div>
      )}
    </>
  )
}

function Tracker({ id, onReset }: { id: string; onReset: () => void }) {
  const v = useQuery(api.desk.borrowerView, { applicantId: id }) as BView | null | undefined
  const choose = useMutation(api.desk.chooseOffer)
  const [err, setErr] = useState('')
  if (v === undefined) return <Shell onReset={onReset}><div className="bw-step mono">Connecting…</div></Shell>
  if (v === null) return <Shell onReset={onReset}><h1>Application not found</h1></Shell>

  const chosen = v.offers.find((o) => o.offerId === v.chosenOfferId)
  const pick = async (o: BOffer) => {
    setErr('')
    try {
      await choose({ applicantId: v.applicantId, offerId: o.offerId })
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e).slice(0, 120))
    }
  }

  // Notice approved by a human: show the letter.
  if (v.noticeText) {
    return (
      <Shell onReset={onReset}>
        <h1 className="hard">Your notice</h1>
        <NoticeDoc text={v.noticeText} />
      </Shell>
    )
  }
  if (v.status === 'approved') {
    return (
      <Shell onReset={onReset}>
        <h1 className="ok">Approved</h1>
        <p>A person at {chosen?.lenderName ?? 'the lender'} signed off on your loan.</p>
        {chosen && <OfferCard o={chosen} chosen disabled />}
      </Shell>
    )
  }
  const stopped = v.status === 'stopped' || v.status === 'declined' || (v.status === 'waiting_for_underwriter' && v.offers.length === 0)
  if (stopped) {
    return (
      <Shell onReset={onReset}>
        <h1 className="hard">We couldn’t approve your request</h1>
        <p className="bw-sub">No offers are available for this application.</p>
        <Reviewer v={v} />
      </Shell>
    )
  }
  if (v.status === 'waiting_for_underwriter') {
    return (
      <Shell onReset={onReset}>
        <h1>Waiting for underwriter</h1>
        <p className="bw-sub">A person reviews every offer before it funds.</p>
        {chosen && <OfferCard o={chosen} chosen disabled />}
      </Shell>
    )
  }
  if (v.status === 'offers') {
    return (
      <Shell onReset={onReset}>
        <h1>Your offers</h1>
        <p className="bw-sub">Tap the one you want.</p>
        {v.offers.map((o) => (
          <OfferCard key={o.offerId} o={o} onPick={() => pick(o)} />
        ))}
        <Progress applicantId={v.applicantId} />
        {err && <div className="bw-err">{err}</div>}
      </Shell>
    )
  }
  return (
    <Shell onReset={onReset}>
      <h1>Checking your offers</h1>
      <p className="bw-sub">
        {v.name} · {usd(v.amountRequested)} · {v.purpose}
      </p>
      <Progress applicantId={v.applicantId} />
    </Shell>
  )
}

export default function Borrower() {
  const [id, setId] = useState<string | null>(load)
  const reset = () => {
    save(null)
    setId(null)
  }
  return id ? <Tracker id={id} onReset={reset} /> : <CodeEntry onStarted={setId} />
}
