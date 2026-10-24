// Phone route (#/borrower): the judge holds this. Instrument Tag artboards Phone-Code / Phone-Offers / Phone-Notice.
// Backend names (convex/desk.ts): lookupCode, createApplicant({cardCode}), borrowerView, chooseOffer,
// attemptOverride, approveNotice, auditEvents({applicantId}), notices. The phone never receives bureau data or reasons.
// Progressive disclosure: every block is one plain-English glance line (Disclose summary) with the detail
// folded underneath. The reviewer strip reads the drafted notice only while reviewer mode is switched on.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { anyApi } from 'convex/server'
import { PRODUCT_NAME } from '../config'
import { Mark } from '../components/Logo'
import { Disclose, KV, Mono } from '../components/Disclose'
import { LENDERS } from '../types'
import { fieldLabel, stopLabel } from '../../../convex/labels'
import './borrower.css'
import '../styles/borrower.css'

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
  at?: number
  actor?: string
  ref?: string | null
  note?: string
}
interface NoticeRow {
  applicantId: string
  text: string
  approvedAt?: number
}

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const usd2 = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const cost = (o: BOffer) => Math.round(o.costToBorrow ?? o.monthlyPayment * o.termMonths - o.amount)
const first = (n: string) => n.split(' ')[0]
/** "Northstar Lending" -> "Northstar"; "Pacific Ridge Credit Union" -> "Pacific Ridge". */
const shortName = (n: string) => n.replace(/\s+(Lending|Credit Union|Bank Prime|Regional Bank|Second Chance Finance|Bank|Finance)$/i, '')
const clock = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
const secs = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return s === 1 ? '1 second' : `${s} seconds`
}
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

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
  { id: 'pull', label: 'Pulling your credit file', glance: 'we are pulling your credit file' },
  { id: 'guardrails', label: 'Running safety checks', glance: 'we are running safety checks' },
  { id: 'underwrite', label: 'Lenders are bidding', glance: 'lenders are bidding' },
  { id: 'compliance', label: 'Preparing your paperwork', glance: 'we are preparing your paperwork' },
  { id: 'human', label: 'Waiting for a person', glance: 'we are waiting for a person' },
]
type StepTimes = { start?: number; done?: number; skipped?: boolean }

/** Progress line that follows the desk pipeline (audit step.<id>.start|done|skipped). */
function Progress({ applicantId }: { applicantId: string }) {
  const events = (useQuery(api.desk.auditEvents, { applicantId, limit: 200 }) ?? []) as Audit[]
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  let idx = 0
  let done = -1
  const times: StepTimes[] = STEPS.map(() => ({}))
  for (const e of events) {
    const m = /^step\.(pull|guardrails|underwrite|compliance|human)\.(start|done|skipped)$/.exec(e.action)
    if (!m) continue
    const i = STEPS.findIndex((s) => s.id === m[1])
    if (m[2] === 'start') {
      idx = Math.max(idx, i)
      if (e.at != null && times[i].start == null) times[i].start = e.at
    } else {
      done = Math.max(done, i)
      if (e.at != null) times[i].done = e.at
      if (m[2] === 'skipped') times[i].skipped = true
    }
  }
  const pct = Math.min(100, ((Math.max(idx, done + 1) + 0.4) / STEPS.length) * 100)
  const cur = Math.min(idx, STEPS.length - 1)
  const curStart = times[cur].start
  const elapsed = curStart != null ? ` (${secs(now - curStart)} so far)` : ''
  const summary = `${cur + 1} of ${STEPS.length}: ${STEPS[cur].glance}${elapsed}.`
  const items = STEPS.map((s, i) => {
    const t = times[i]
    let value: ReactNode
    if (t.start == null && t.done == null) value = <>Not started</>
    else if (t.done != null && t.skipped)
      value = (
        <>
          Skipped · <Mono>{clock(t.done)}</Mono> · nothing to prepare
        </>
      )
    else if (t.done != null)
      value = (
        <>
          Done · <Mono>{clock(t.start ?? t.done)}</Mono> to <Mono>{clock(t.done)}</Mono>
          {t.start != null ? ` · ${secs(t.done - t.start)}` : ''}
        </>
      )
    else
      value = (
        <>
          Running · started <Mono>{clock(t.start as number)}</Mono> · {secs(now - (t.start as number))} so far
        </>
      )
    return { label: s.label, value }
  })
  return (
    <div className="bw-progress">
      <div className="bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <Disclose
        id="bw-progress-steps"
        tone="info"
        summary={summary}
        meta={`${cur + 1}/${STEPS.length}`}
        detail={<KV items={items} />}
      />
    </div>
  )
}

function OfferRow({
  o,
  selected,
  tag,
  onPick,
  disabled,
  asked,
  count,
  next,
}: {
  o: BOffer
  selected: boolean
  tag?: string
  onPick?: () => void
  disabled?: boolean
  /** Amount the borrower asked for; the detail compares it with what this offer gives. */
  asked?: number
  /** How many offers this one was ranked against (for the tag explanation). */
  count?: number
  /** What happens after this offer is chosen. */
  next?: string
}) {
  const total = o.monthlyPayment * o.termMonths
  const sn = shortName(o.lenderName)
  const summary = `${sn}: ${o.apr.toFixed(2)}% APR, ${usd(o.monthlyPayment)} a month for ${o.termMonths} months.${tag ? ` ${tag}.` : ''}`
  const items: { label: ReactNode; value: ReactNode }[] = [
    {
      label: 'Total you repay',
      value: (
        <>
          <Mono>{usd2(total)}</Mono> over {o.termMonths} months
        </>
      ),
    },
    {
      label: 'Cost to borrow',
      value: (
        <>
          <Mono>{usd(cost(o))}</Mono>. That is everything you repay, minus the cash you get.
        </>
      ),
    },
    {
      label: 'You get',
      value: (
        <>
          <Mono>{usd(o.amount)}</Mono>
          {asked != null
            ? Math.round(o.amount) === Math.round(asked)
              ? ', the full amount you asked for.'
              : `, of the ${usd(asked)} you asked for.`
            : ''}
        </>
      ),
    },
    {
      label: 'Term',
      value: (
        <>
          {o.termMonths} months at <Mono>{o.apr.toFixed(2)}%</Mono> APR, fixed.
        </>
      ),
    },
  ]
  const ofThe = count ? `of the ${count} offers` : 'of the offers'
  if (tag === 'Lowest cost') items.push({ label: 'Lowest cost', value: `Lowest total cost to borrow ${ofThe}.` })
  if (tag === 'Lower payment') items.push({ label: 'Lower payment', value: `Smallest monthly payment ${ofThe}; it costs more in total.` })
  items.push({ label: 'After you choose', value: next ?? `A person at ${o.lenderName} reviews your pick before any money moves.` })
  return (
    <div className={`bw-offer-wrap ${selected ? 'sel' : ''}`}>
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
      </button>
      <Disclose
        id={`bw-offer-${o.lender}`}
        tone={selected ? 'good' : 'info'}
        summary={summary}
        meta={selected ? 'Selected' : 'More'}
        detail={<KV items={items} />}
      />
    </div>
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
          asked={v.amountRequested}
          count={n}
        />
      ))}
      {missing.length > 0 && (
        <div className="bw-none">
          {missing.map((l) => (
            <Disclose
              key={l.id}
              id={`bw-none-${l.id}`}
              tone="muted"
              summary={`${shortName(l.name)}: no offer this time.`}
              meta="Why"
              detail={
                <>
                  <p>{l.name} did not match an offer to your file.</p>
                  <p>Lenders do not share their reasons on this phone, and nothing from your credit file is sent here.</p>
                  <p>If a written notice is owed to you, it comes separately. The person reviewing your application can see each lender's reasons.</p>
                </>
              }
            />
          ))}
        </div>
      )}
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
/** Plain sentence for one notice bullet ("field: text" or prose). */
const whyLine = (b: string) => {
  const m = /^([\w.]+): (.*)$/.exec(b)
  return m ? (WHY[m[1]] ?? m[2]) : b
}
const lower1 = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s)

function Reviewer({ v, sent }: { v: BView; sent: boolean }) {
  const [on, setOn] = useState(false)
  const [msg, setMsg] = useState<string | null>(v.overrideResult)
  const [at, setAt] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const override = useMutation(api.desk.attemptOverride)
  const approve = useMutation(api.desk.approveNotice)
  // Reviewer-only reads: the drafted notice and the audit trail load only while the switch is on.
  const notices = useQuery(api.desk.notices, on ? {} : 'skip') as NoticeRow[] | undefined
  const events = (useQuery(api.desk.auditEvents, on ? { applicantId: v.applicantId, limit: 300 } : 'skip') ?? []) as Audit[]
  const draft = notices?.find((x) => String(x.applicantId) === String(v.applicantId))
  const text = v.noticeText ?? draft?.text ?? null
  const parsed = text ? parseNotice(text) : null
  const stops = events.filter((e) => e.actor === 'rules' && e.action === 'rules.hard_stop')
  const blocked = events.filter((e) => e.action === 'override.blocked')
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
  const action = sent ? 'It has been sent.' : 'Send it, or try an override (it will be logged and blocked).'
  const summary = parsed
    ? `Reviewer: notice drafted with ${plural(parsed.bullets.length, 'reason')}${parsed.rights ? ' and the rights paragraph' : ''}. ${action}`
    : notices === undefined && on
      ? 'Reviewer: loading the drafted notice.'
      : `Reviewer: no notice drafted yet. Send notice writes one from the rule that stopped this file; an override will be logged and blocked.`
  const stopItems = stops.map((e) => ({
    label: e.ref ? fieldLabel(e.ref) : 'rule',
    value: e.ref ? stopLabel(e.ref) : 'An automated safety check stopped the file.',
  }))
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
          <Disclose
            id="bw-reviewer-more"
            tone="info"
            summary={summary}
            meta="More"
            detail={
              <div className="bw-rev-detail">
                <span className="lbl lt">Notice to send</span>
                {text ? <pre className="bw-notice-text">{text}</pre> : <p>No notice drafted yet. Send notice drafts it from the rule below and sends it in one step.</p>}
                <span className="lbl lt">Rule that stopped the file</span>
                {stopItems.length > 0 ? <KV items={stopItems} /> : <p>{stops.length === 0 && events.length === 0 ? 'Loading the audit trail.' : 'No hard-stop rule fired; the file stopped because no lender made an offer.'}</p>}
                <span className="lbl lt">Override attempts</span>
                {blocked.length > 0 ? (
                  <ul className="bw-audit">
                    {blocked.map((e, i) => (
                      <li key={i}>
                        <Mono>{e.at != null ? clock(e.at) : '—'}</Mono> · Override blocked, attempt {i + 1}
                        {e.ref ? ` · rule: ${lower1(stopLabel(e.ref))}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>None yet. Every attempt is written to the audit log with the time and the rule it hit.</p>
                )}
                <span className="lbl lt">Why a fraud review must clear the file</span>
                <p>A hard stop is a coded rule, not a judgment call. No person or model can override it from this screen; a fraud review has to clear the file before any lender sees it.</p>
              </div>
            }
          />
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
  const n = parseNotice(v.noticeText ?? '')
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const why = n.bullets.map(whyLine)
  const lead = why[0]
  return (
    <Shell right={`${no ? `No. ${no} · ` : ''}${date}`} onReset={onReset}>
      <div className="bw-head tight">
        <span className="disp stamp sig">Application stopped</span>
        <h1 className="s26">We can’t offer you a loan right now.</h1>
        {lead && <p className="s16 lead">The reason: {lower1(lead)}</p>}
      </div>
      <div className="bw-notice">
        {why.length > 0 && (
          <Disclose
            id="bw-notice-why"
            tone="bad"
            summary={why.length > 1 ? `Why, in full: ${plural(why.length, 'reason')} stopped your application.` : 'Why, in full: the one reason, and what it means.'}
            meta={plural(why.length, 'reason')}
            detail={
              <div className="bw-why">
                {why.map((w, i) => (
                  <p key={i} className={i === 0 ? 'p1' : 'p2'}>
                    {w}
                  </p>
                ))}
                <p className="p2">No lender saw your request.</p>
              </div>
            }
          />
        )}
        {n.steps.length > 0 && (
          <Disclose
            id="bw-notice-steps"
            tone="info"
            summary={`What you can do: ${plural(n.steps.length, 'step')} to fix the file and apply again.`}
            meta={plural(n.steps.length, 'step')}
            detail={
              <div className="bw-steps">
                {n.steps.map((s, i) => (
                  <div key={i} className="step">
                    <span className="n mono">{i + 1}</span>
                    <p>{s}</p>
                  </div>
                ))}
              </div>
            }
          />
        )}
        {n.rights && (
          <Disclose
            id="bw-notice-rights"
            tone="muted"
            summary="Your rights under federal law: the notice is required and you may dispute it."
            meta="ECOA · FCRA"
            detail={
              <>
                <p>{n.rights}</p>
                <p className="bw-small">Sent on behalf of the lenders that reviewed your file.</p>
              </>
            }
          />
        )}
      </div>
      {!n.rights && <span className="bw-small">Sent on behalf of the lenders that reviewed your file.</span>}
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
        {chosen && <OfferRow o={chosen} selected disabled asked={v.amountRequested} next={`A person at ${chosen.lenderName} signed off on this loan. The lender contacts you about funding.`} />}
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
        {chosen && <OfferRow o={chosen} selected disabled asked={v.amountRequested} next={`A person at ${chosen.lenderName} is reviewing your pick now. Nothing funds until they sign off.`} />}
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
