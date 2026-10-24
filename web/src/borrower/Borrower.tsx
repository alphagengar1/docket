// Phone route (#/borrower): the judge holds this. Instrument Tag artboards Phone-Code / Phone-Offers / Phone-Notice.
// Backend names (convex/desk.ts): lookupCode, createApplicant({cardCode}), borrowerView, chooseOffer,
// attemptOverride, approveNotice, auditEvents({applicantId}). The phone never receives bureau data or reasons.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { anyApi } from 'convex/server'
import { PRODUCT_NAME } from '../config'
import { Mark } from '../components/Logo'
import { LENDERS } from '../types'
import './borrower.css'

const api = anyApi
const KEY = 'docket.borrower.applicantId'

interface Lookup {
  code: string
  personaId?: string
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
  costToBorrow?: number
}
interface BView {
  applicantId: string
  name: string
  cardCode?: string | null
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
const usd2 = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const cost = (o: BOffer) => Math.round(o.costToBorrow ?? o.monthlyPayment * o.termMonths - o.amount)
const first = (n: string) => n.split(' ')[0]

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

function Shell({ step, no, right, children, onReset }: { step?: number; no?: string | null; right?: string; children: ReactNode; onReset?: () => void }) {
  const r = right ?? (step ? `Step ${step} of 3${no ? ` · No. ${no}` : ''}` : '')
  return (
    <div className="itag bw">
      <div className="bw-in">
        <div className="bw-top">
          <div className="bw-word">
            <Mark size={16} className="mk" />
            <span className="disp">{PRODUCT_NAME}</span>
          </div>
          <span className="lbl">{r}</span>
        </div>
        {children}
        <div className="bw-foot">
          <span className="lbl">SANDBOX · test persona</span>
          {onReset && (
            <button type="button" className="bw-link" onClick={onReset}>
              Start over
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function CodeEntry({ onStarted }: { onStarted: (id: string) => void }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const found = useQuery(api.desk.lookupCode, code.length === 4 ? { code } : 'skip') as Lookup | null | undefined
  const create = useMutation(api.desk.createApplicant)
  const bad = code.length === 4 && found === null
  const no = found?.personaId ? found.personaId.replace(/^P/i, '') : null
  useEffect(() => input.current?.focus(), [])
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
  const left = 4 - code.length
  return (
    <Shell step={1} no={found ? no : null}>
      <div className="bw-head code">
        {found ? (
          <>
            <h1>Hi {first(found.displayName)}.</h1>
            <p>
              You need <b className="mono">{usd(found.amountRequested)}</b> for {found.purpose.toLowerCase()}.
            </p>
          </>
        ) : (
          <>
            <h1>Type the code on your card.</h1>
            <p>The four digits at the top right.</p>
          </>
        )}
      </div>
      <div className="bw-field">
        <label htmlFor="card-code" className="lbl ink">
          Card code
        </label>
        <div className="bw-wrap">
          <div className={`bw-cells ${bad ? 'bad' : ''}`} aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`c ${i === code.length ? 'cur' : ''}`}>
                {code[i] ?? ''}
              </span>
            ))}
          </div>
          <input
            id="card-code"
            ref={input}
            className="bw-hidden"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{4}"
            maxLength={4}
            value={code}
            onChange={(e) => {
              setErr('')
              setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))
            }}
          />
        </div>
        {bad && (
          <div className="bw-bad">
            <i /> No card with that code.
          </div>
        )}
      </div>
      <div className="bw-hint">
        <b />
        <p>Next, we pull your credit file and send it to {LENDERS.length} lenders at once. You pick the offer.</p>
      </div>
      <div className="bw-bottom">
        {found ? (
          <>
            <button type="button" className="bw-go" onClick={go} disabled={busy}>
              {busy ? 'Starting…' : 'Find my offers'}
            </button>
            <button
              type="button"
              className="bw-link center"
              onClick={() => {
                setCode('')
                input.current?.focus()
              }}
            >
              Not me
            </button>
          </>
        ) : (
          <button type="button" className="bw-wait" disabled>
            {left === 1 ? '1 more digit' : `${left} more digits`}
          </button>
        )}
        {err && <div className="bw-bad"><i /> {err}</div>}
        <span className="lbl center">Soft pull · your score does not change</span>
      </div>
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
function Progress({ applicantId }: { applicantId: string }) {
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
      <div className="bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="lbl ink">
        {Math.min(idx + 1, STEPS.length)}/{STEPS.length} · {STEPS[Math.min(idx, STEPS.length - 1)].label}
      </div>
    </div>
  )
}

function OfferRow({ o, selected, tag, onPick, disabled }: { o: BOffer; selected: boolean; tag?: string; onPick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={`bw-offer ${selected ? 'sel' : ''}`} onClick={onPick} disabled={disabled} aria-pressed={selected}>
      <span className="top">
        <span className="disp nm">{o.lenderName}</span>
        {tag && <span className={`disp tg ${selected ? 'on' : ''}`}>{tag}</span>}
      </span>
      <span className="mid">
        <span className="kv">
          <span className="lbl">APR</span>
          <span className="mono apr">{o.apr.toFixed(2)}%</span>
        </span>
        <span className="kv r">
          <span className="lbl">Monthly · {o.termMonths} mo</span>
          <span className="mono pay">{usd2(o.monthlyPayment)}</span>
        </span>
      </span>
      <span className="foot">
        <span className="kv">
          <span className="lbl">You get</span>
          <span className="v">{usd(o.amount)}</span>
        </span>
        <span className="kv">
          <span className="lbl">Cost to borrow</span>
          <span className="v">{usd(cost(o))}</span>
        </span>
      </span>
    </button>
  )
}

function Offers({ v, no, onReset }: { v: BView; no: string | null; onReset: () => void }) {
  const choose = useMutation(api.desk.chooseOffer)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const ranked = useMemo(() => v.offers.slice().sort((a, b) => cost(a) - cost(b)), [v.offers])
  const lowest = ranked[0]
  const lowPay = useMemo(() => v.offers.slice().sort((a, b) => a.monthlyPayment - b.monthlyPayment)[0], [v.offers])
  const [sel, setSel] = useState<string | null>(null)
  const cur = v.offers.find((o) => o.offerId === (sel ?? lowest?.offerId)) ?? lowest
  const term = v.offers[0]?.termMonths
  const missing = LENDERS.filter((l) => !v.offers.some((o) => o.lender === l.id))
  const n = v.offers.length
  const go = async () => {
    if (!cur) return
    setErr('')
    setBusy(true)
    try {
      await choose({ applicantId: v.applicantId, offerId: cur.offerId })
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e).slice(0, 120))
      setBusy(false)
    }
  }
  return (
    <Shell step={2} no={no} onReset={onReset}>
      <div className="bw-head">
        <h1 className="s26">
          {first(v.name)}, you have {n} offer{n === 1 ? '' : 's'}.
        </h1>
        <p className="s16">
          For <b className="mono">{usd(v.amountRequested)}</b>
          {term ? ` over ${term} months` : ''}. {missing.length === 0 ? `All ${LENDERS.length} lenders answered.` : 'More lenders may still answer.'}
        </p>
      </div>
      {ranked.map((o) => (
        <OfferRow
          key={o.offerId}
          o={o}
          selected={o.offerId === cur?.offerId}
          tag={n > 1 ? (o.offerId === lowest?.offerId ? 'Lowest cost' : o.offerId === lowPay?.offerId ? 'Lower payment' : undefined) : undefined}
          onPick={() => setSel(o.offerId)}
        />
      ))}
      {missing.length > 0 && (
        <div className="bw-none">
          {missing.map((l) => (
            <div key={l.id} className="row">
              <span className="disp">{l.name} · No offer</span>
              <span>Not matched to your file this time</span>
            </div>
          ))}
        </div>
      )}
      <p className="bw-note">Cost to borrow is everything you repay, minus the cash you get.</p>
      <div className="bw-bottom">
        <button type="button" className="bw-go" onClick={go} disabled={busy || !cur}>
          {cur ? `Choose ${cur.lenderName}` : 'Choose'}
        </button>
        {err && <div className="bw-bad"><i /> {err}</div>}
        <span className="lbl center">A person reviews your pick before it funds</span>
      </div>
    </Shell>
  )
}

/** Notice text from the backend: intro / "The reason:" bullets / steps / FCRA paragraph last. */
function parseNotice(text: string) {
  const blocks = text.split(/\n\n+/)
  const reasonIdx = blocks.findIndex((b) => /^the reason/i.test(b) || b.split('\n').some((l) => l.startsWith('- ')))
  const bullets = reasonIdx >= 0 ? blocks[reasonIdx].split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2)) : []
  const rest = blocks.filter((_, i) => i !== reasonIdx && i !== 0)
  const rights = rest.length > 1 ? rest[rest.length - 1] : ''
  const steps = rest.length > 1 ? rest.slice(0, -1) : rest
  return { intro: blocks[0] ?? '', bullets, steps, rights }
}
const WHY: Record<string, string> = {
  'flags.deceased': 'The credit file for this identity says the person has died.',
  'flags.frozen': 'Every bureau file for this identity is frozen.',
  'identity.verified': 'The bureau could not confirm this identity.',
  'fraud.score': 'The fraud check flagged this identity.',
}

function Reviewer({ v, sent }: { v: BView; sent: boolean }) {
  const [on, setOn] = useState(false)
  const [msg, setMsg] = useState<string | null>(v.overrideResult)
  const [at, setAt] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const override = useMutation(api.desk.attemptOverride)
  const approve = useMutation(api.desk.approveNotice)
  const stamp = () => new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
  const tryOverride = async () => {
    try {
      const r = (await override({ applicantId: v.applicantId })) as { reason: string }
      setMsg(r.reason)
      setAt(stamp())
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
    <div className="bw-rev">
      <div className="hd">
        <span className="lbl lt">Reviewer mode</span>
        {msg && on ? <span className="lbl lt">Logged {at ?? ''}</span> : null}
        <button type="button" className="bw-switch" aria-pressed={on} aria-label="Reviewer mode" onClick={() => setOn(!on)} />
      </div>
      {on && (
        <>
          {msg && (
            <div className="blocked">
              <i />
              <span>{msg.replace(/\.?$/, '')}. A fraud review must clear this file first.</span>
            </div>
          )}
          <div className="btns">
            <button type="button" className="send" onClick={sendNotice} disabled={sent}>
              {sent ? 'Notice sent' : 'Send notice'}
            </button>
            <button type="button" className="ovr" onClick={tryOverride}>
              Override
            </button>
          </div>
          {err && <div className="bw-bad lt"><i /> {err}</div>}
        </>
      )}
    </div>
  )
}

function Notice({ v, no, onReset }: { v: BView; no: string | null; onReset: () => void }) {
  const [rights, setRights] = useState(false)
  const n = parseNotice(v.noticeText ?? '')
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const why = n.bullets.map((b) => {
    const m = /^([\w.]+): (.*)$/.exec(b)
    return m ? (WHY[m[1]] ?? m[2]) : b
  })
  return (
    <Shell right={`${no ? `No. ${no} · ` : ''}${date}`} onReset={onReset}>
      <div className="bw-head tight">
        <span className="disp stamp sig">Application stopped</span>
        <h1 className="s26">We can’t offer you a loan right now.</h1>
      </div>
      {why.length > 0 && (
        <div className="bw-why">
          <span className="lbl">Why</span>
          {why.map((w, i) => (
            <p key={i} className={i === 0 ? 'p1' : 'p2'}>
              {w}
            </p>
          ))}
          <p className="p2">No lender saw your request.</p>
        </div>
      )}
      {n.steps.length > 0 && (
        <div className="bw-steps">
          <span className="lbl">What you can do</span>
          {n.steps.map((s, i) => (
            <div key={i} className="step">
              <span className="n mono">{i + 1}</span>
              <p>{s}</p>
            </div>
          ))}
        </div>
      )}
      {n.rights && (
        <>
          <button type="button" className="bw-rights" onClick={() => setRights(!rights)} aria-expanded={rights}>
            <span>Your rights under federal law</span>
            <span className="mono">ECOA · FCRA {rights ? '⌄' : '›'}</span>
          </button>
          {rights && <p className="bw-small">{n.rights}</p>}
        </>
      )}
      <span className="bw-small">Sent on behalf of the lenders that reviewed your file.</span>
      <div className="bw-bottom">
        <Reviewer v={v} sent />
      </div>
    </Shell>
  )
}

function Tracker({ id, onReset }: { id: string; onReset: () => void }) {
  const v = useQuery(api.desk.borrowerView, { applicantId: id }) as BView | null | undefined
  const look = useQuery(api.desk.lookupCode, v?.cardCode ? { code: v.cardCode } : 'skip') as Lookup | null | undefined
  const no = look?.personaId ? look.personaId.replace(/^P/i, '') : null
  if (v === undefined)
    return (
      <Shell step={2} onReset={onReset}>
        <div className="lbl ink">Connecting…</div>
      </Shell>
    )
  if (v === null)
    return (
      <Shell step={1} onReset={onReset}>
        <div className="bw-head">
          <h1>Application not found.</h1>
        </div>
      </Shell>
    )

  const chosen = v.offers.find((o) => o.offerId === v.chosenOfferId)

  if (v.noticeText) return <Notice v={v} no={no} onReset={onReset} />

  if (v.status === 'approved') {
    return (
      <Shell step={3} no={no} onReset={onReset}>
        <div className="bw-head tight">
          <span className="disp stamp go">Approved</span>
          <h1 className="s26">{first(v.name)}, you’re approved.</h1>
          <p className="s16">A person at {chosen?.lenderName ?? 'the lender'} signed off on your loan.</p>
        </div>
        {chosen && <OfferRow o={chosen} selected disabled />}
      </Shell>
    )
  }
  const stopped = v.status === 'stopped' || v.status === 'declined' || (v.status === 'waiting_for_underwriter' && v.offers.length === 0)
  if (stopped) {
    return (
      <Shell step={3} no={no} onReset={onReset}>
        <div className="bw-head tight">
          <span className="disp stamp sig">Application stopped</span>
          <h1 className="s26">We couldn’t approve your request.</h1>
        </div>
        <div className="bw-why">
          <span className="lbl">Why</span>
          <p className="p2">No offers are available for this application. No lender saw your request.</p>
        </div>
        <div className="bw-bottom">
          <Reviewer v={v} sent={false} />
        </div>
      </Shell>
    )
  }
  if (v.status === 'waiting_for_underwriter') {
    return (
      <Shell step={3} no={no} onReset={onReset}>
        <div className="bw-head tight">
          <span className="disp stamp wait">Waiting</span>
          <h1 className="s26">Waiting for underwriter.</h1>
          <p className="s16">A person reviews every offer before it funds.</p>
        </div>
        {chosen && <OfferRow o={chosen} selected disabled />}
      </Shell>
    )
  }
  if (v.status === 'offers') return <Offers v={v} no={no} onReset={onReset} />
  return (
    <Shell step={2} no={no} onReset={onReset}>
      <div className="bw-head">
        <h1 className="s26">Checking your offers.</h1>
        <p className="s16">
          {first(v.name)} · <b className="mono">{usd(v.amountRequested)}</b> · {v.purpose.toLowerCase()}
        </p>
      </div>
      <Progress applicantId={v.applicantId} />
      <div className="bw-bottom">
        <span className="lbl center">Soft pull · your score does not change</span>
      </div>
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
