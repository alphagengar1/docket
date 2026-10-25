// Second screen (#/board): the "lender floor" the judges watch. Instrument Tag theme, read from 2 m.
// Follows the newest applicant (or ?applicant=<id>). Keys: E eval view, B board, R replay,
// 1–5 open/close one lender's panel, A open/close every lender, D open/close the detail block
// (the hard-stop breakdown or the "More" block beside Waiting / Declined).
// Progressive disclosure: every block defaults to one plain-English glance line; the detail
// opens inline under it (Disclose primitive), never on a new page.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { PRODUCT_NAME } from '../config'
import { useApplicantSlice, useDesk, type Desk } from '../hooks/useDesk'
import { LENDERS, type Applicant, type AuditEvent, type Bundle, type Decision, type EvalFailure, type Notice, type Offer, type Reason, type ReasonCheck } from '../types'
import { clock, monthlyPayment, secs as fmtSecs, usd } from '../lib/format'
import { checkFor, eventsFor, offersFor, stepTimings, type CheckState } from '../lib/select'
import { describeIdentityFlag } from '../../../convex/labels'
import { actionWords, scrubModelText } from '../lib/auditWords'
import { reasonLabel } from '../components/ReasonList'
import { Mark } from '../components/Logo'
import { Disclose, DiscloseGroup, KV, Mono, type KVItem } from '../components/Disclose'
import './board.css'
import '../styles/board.css'

type Stage = 'done' | 'now' | 'next' | 'cancelled'

const SHORT: Record<string, string> = { cu: 'Pacific Ridge', fintech: 'Northstar', prime: 'Meridian Prime', regional: 'Cascade Regional', subprime: 'Harbor 2nd Chance' }
const POLICY: Record<string, string> = {
  cu: 'Conservative. Needs a score of 660 or more and utilization at 50% or less.',
  fintech: 'Growth. Prices near-prime and thin files. Needs a score of 600 or more.',
  prime: 'Prime. Needs a score of 720 or more and utilization at 30% or less.',
  regional: 'Relationship bank. Needs a score of 680 or more and utilization at 45% or less.',
  subprime: 'Second chance. Lends from a score of 560, small amounts, high APR.',
}
const HARD_SENTENCE: Record<string, string> = {
  'flags.deceased': 'The bureau says this person died. They just applied.',
  'flags.frozen': 'Every bureau file for this person is frozen. Nobody can read their credit.',
  'identity.verified': 'The bureau cannot confirm this person is who they say they are.',
  'fraud.score': 'The fraud score is over the line. This looks like someone else’s identity.',
}
const NOTICE_ELEMENTS: RegExp[] = [
  /reason/i,
  /equifax|experian|transunion/i,
  /\(?\d{3}\)?[-\s.]?\d{3}[-\s.]\d{4}|1-8\d\d-/,
  /free (copy|report|credit)/i,
  /dispute/i,
  /ECOA|equal credit/i,
  /FCRA|consumer (reporting|report)/i,
]
const SOURCE_WORD: Record<Bundle['source'], string> = { crs: 'CRS sandbox bureau', nessie: 'Nessie sandbox bureau', mock: 'Mock bureau data' }
const CHECK_WORD: Record<CheckState, string> = {
  verified: 'Verified: changing this fact flips the decision',
  unsupported: 'Unsupported: changing this fact did not flip the decision',
  pending: 'Check pending',
  none: '',
}

/** Stable ids so the board's keys can open a panel (Disclose has no controlled `open`; we click its button). */
const LENDER_DISCLOSE_ID = (lenderId: string) => `bd-lender-${lenderId}`
const DETAIL_DISCLOSE_ID = 'bd-detail'

function clickToggle(buttonId: string) {
  const el = document.getElementById(buttonId)
  if (el instanceof HTMLButtonElement) el.click()
}

function hashParams(): URLSearchParams {
  const h = window.location.hash
  const q = h.includes('?') ? h.slice(h.indexOf('?') + 1) : ''
  const p = new URLSearchParams(q)
  new URLSearchParams(window.location.search).forEach((v, k) => {
    if (!p.has(k)) p.set(k, v)
  })
  return p
}

function useHashParams() {
  const [p, setP] = useState(hashParams)
  useEffect(() => {
    const on = () => setP(hashParams())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return p
}

function setView(view: 'board' | 'eval') {
  const p = hashParams()
  if (view === 'eval') p.set('view', 'eval')
  else p.delete('view')
  p.delete('replay')
  const q = p.toString()
  window.location.hash = `#/board${q ? `?${q}` : ''}`
}

function stages(a: Applicant | undefined, desk: Desk, notice?: Notice, decision?: Decision): Stage[] {
  const events = eventsFor(desk.auditEvents, a?._id ?? null)
  const st = stepTimings(a, events)
  const get = (id: string) => st.find((s) => s.id === id)!
  if (!a) return ['next', 'next', 'next', 'next']
  const hard = a.status === 'hard_stop' || decision?.outcome === 'hard_stop' || events.some((e) => e.action === 'rules.hard_stop' || e.action === 'hard_stop')
  const finished = !hard && (a.status === 'approved' || a.status === 'declined')
  const bureauDone = ['done', 'failed'].includes(get('guardrails').state) || hard || finished || a.status === 'awaiting_human'
  const bureau: Stage = bureauDone ? 'done' : 'now'
  if (hard) return ['done', 'cancelled', notice ? 'done' : 'next', decision ? 'done' : 'now']
  const lenders: Stage = get('underwrite').state === 'done' || finished || a.status === 'awaiting_human' ? 'done' : bureauDone ? 'now' : 'next'
  const compliance: Stage = get('compliance').state === 'done' || finished || a.status === 'awaiting_human' ? 'done' : lenders === 'done' ? 'now' : 'next'
  const human: Stage = finished ? 'done' : a.status === 'awaiting_human' ? 'now' : 'next'
  return [bureau, lenders, compliance, human]
}

/* ---------------------------------------------------------------- plain-English helpers */

function sentence(s: string) {
  const t = s.trim()
  return /[.!?]$/.test(t) ? t : `${t}.`
}
function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1)
}
function upperFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
function reasonText(r: Reason) {
  return upperFirst(r.text.replace(/^the applicant['’]s /i, '').trim())
}
function scoreLabel(b: Bundle) {
  return b.credit.fico9 != null ? 'TransUnion score' : b.credit.vantage4 != null ? 'Vantage 4 score' : 'Score'
}
function scoreOf(b: Bundle) {
  return b.credit.fico9 ?? b.credit.vantage4
}
function flagWords(b: Bundle): string[] {
  const w: string[] = []
  if (b.flags.deceased) w.push('deceased indicator')
  if (b.flags.frozen) w.push('frozen file')
  if (b.flags.bankruptcy) w.push('bankruptcy')
  if (b.flags.eviction) w.push('eviction')
  return w
}
function noticeCount(n?: Notice) {
  if (!n) return 0
  return NOTICE_ELEMENTS.filter((r) => r.test(n.text)).length
}

/** "Bureau pulled 10:42:03, soft pull: TransUnion score 648, utilization 62%, identity verified." */
function bureauGlance(b: Bundle) {
  const score = scoreOf(b)
  const parts = [
    `${scoreLabel(b)} ${score != null ? score : 'not on file'}`,
    `utilization ${b.credit.utilization != null ? `${Math.round(b.credit.utilization * 100)}%` : 'not on file'}`,
    `identity ${b.identity.verified ? 'verified' : 'not verified'}`,
  ]
  const flags = flagWords(b)
  if (flags.length) parts.push(`flags: ${flags.join(', ')}`)
  if (b.fraud.signals.length) parts.push(`${b.fraud.signals.length} fraud ${b.fraud.signals.length === 1 ? 'signal' : 'signals'}`)
  return `Bureau pulled ${clock(b.pulledAt)}, soft pull: ${parts.join(', ')}.`
}

function bureauItems(b: Bundle): KVItem[] {
  const score = scoreOf(b)
  const flags = flagWords(b)
  return [
    { label: 'Source', value: `${SOURCE_WORD[b.source]} · soft pull at ${clock(b.pulledAt)}` },
    { label: scoreLabel(b), value: score != null ? <Mono>{score}</Mono> : 'Not on file' },
    { label: 'Utilization', value: b.credit.utilization != null ? <Mono>{Math.round(b.credit.utilization * 100)}%</Mono> : 'Not on file' },
    { label: 'Inquiries', value: `${b.credit.inquiries6mo} in the last 6 months` },
    {
      label: 'Tradelines',
      value: b.credit.tradelines.length ? (
        <ul className="bd-list">
          {b.credit.tradelines.map((t, i) => (
            <li key={i}>
              {upperFirst(t.type)} · <Mono>{usd(t.balance)}</Mono> · {t.status} · opened {t.openedAt}
            </li>
          ))}
        </ul>
      ) : (
        'None on file'
      ),
    },
    {
      label: 'Identity',
      value: `${b.identity.verified ? 'Verified' : 'Not verified'}${b.identity.flags.length ? ` · ${b.identity.flags.map(describeIdentityFlag).join('; ')}` : ' · no identity flags'}`,
    },
    {
      label: 'Fraud',
      value: `${b.fraud.score != null ? `Score ${b.fraud.score}` : 'No score'}${b.fraud.signals.length ? ` · ${b.fraud.signals.join('; ')}` : ' · no signals'}`,
    },
    { label: 'Flags', value: flags.length ? flags.join(', ') : 'None' },
  ]
}

function costOf(o: Offer): number | null {
  if (o.costToBorrow != null) return o.costToBorrow
  const m = payOf(o)
  return m != null && o.termMonths != null && o.amount != null ? m * o.termMonths - o.amount : null
}
function payOf(o: Offer): number | null {
  return o.monthlyPayment ?? monthlyPayment(o.amount, o.apr, o.termMonths)
}

interface Marks {
  picked: boolean
  lowest: boolean
  lowPay: boolean
}

/** One-line verdict for a lender, without the name: "No offer: utilization too high." */
function verdictLine(o: Offer | undefined, m: Marks): string {
  if (!o || o.status === 'pending') return 'Reading the file…'
  if (o.status === 'failed') return 'No offer: the lender did not answer in time.'
  if (o.decision !== 'approve') {
    const r = o.reasons[0]
    return sentence(`No offer: ${r ? lowerFirst(reasonText(r)) : 'declined'}`)
  }
  const pay = payOf(o)
  const bits = [`${o.apr != null ? o.apr.toFixed(2) : '—'}% APR`, pay != null ? `${usd(pay)} a month` : null]
  if (o.classification === 'counteroffer') bits.push('counteroffer')
  if (m.lowest) bits.push('lowest cost')
  else if (m.lowPay) bits.push('lower payment')
  if (m.picked) bits.push('picked by the borrower')
  return sentence(bits.filter(Boolean).join(', '))
}

function ReasonList({ o, checks }: { o: Offer; checks: ReasonCheck[] }) {
  if (!o.reasons.length) return <span>No reasons were recorded.</span>
  return (
    <ul className="bd-reasons">
      {o.reasons.map((r, i) => {
        const c = checkFor(checks, o, r.field)
        return (
          <li key={i}>
            <span className="rt">{sentence(reasonText(r))}</span>
            <span className="lbl">Rule {reasonLabel(r.field)}</span>
            {c.state !== 'none' && (
              <span className={`bd-vf ${c.state}`}>
                {c.state === 'unsupported' && <i aria-hidden="true" />}
                {CHECK_WORD[c.state]}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function LenderDetail({ o, lenderId, requested, checks, m }: { o?: Offer; lenderId: string; requested: number; checks: ReasonCheck[]; m: Marks }) {
  const L = LENDERS.find((l) => l.id === lenderId)!
  const items: KVItem[] = [{ label: 'Policy', value: POLICY[lenderId] ?? L.policy }]
  if (!o || o.status === 'pending') {
    items.push({ label: 'Status', value: 'Still reading the file. Nothing decided yet.' })
    return <KV items={items} />
  }
  if (o.status === 'failed') {
    items.push({ label: 'Verdict', value: 'No offer. The lender did not answer before the timeout, so the file moved on without it.' })
    items.push({ label: 'Rule', value: reasonLabel('timeout') })
    return <KV items={items} />
  }
  if (o.decision !== 'approve') {
    items.push({ label: 'Verdict', value: 'No offer. Every reason below is logged for the notice.' })
    items.push({ label: 'Reasons', value: <ReasonList o={o} checks={checks} /> })
    if (o.latencyMs != null) items.push({ label: 'Answered in', value: fmtSecs(o.latencyMs) })
    return <KV items={items} />
  }
  const pay = payOf(o)
  const cost = costOf(o)
  const counter = o.classification === 'counteroffer' || (o.amount != null && o.amount !== requested)
  items.push({ label: 'Verdict', value: counter ? 'Counteroffer: different terms than the borrower asked for.' : 'Offer on the terms the borrower asked for.' })
  items.push({ label: 'APR', value: <Mono>{o.apr != null ? `${o.apr.toFixed(2)}%` : '—'}</Mono> })
  items.push({
    label: 'Amount',
    value: counter ? (
      <>
        <Mono>{usd(o.amount)}</Mono> offered against <Mono>{usd(requested)}</Mono> requested
      </>
    ) : (
      <Mono>{usd(o.amount)}</Mono>
    ),
  })
  items.push({ label: 'Term', value: o.termMonths != null ? `${o.termMonths} months` : '—' })
  items.push({ label: 'Monthly', value: <Mono>{pay != null ? usd(pay, 2) : '—'}</Mono> })
  items.push({
    label: 'Cost to borrow',
    value:
      cost != null && pay != null && o.termMonths != null && o.amount != null ? (
        <>
          <Mono>{usd(pay, 2)}</Mono> × {o.termMonths} months − <Mono>{usd(o.amount)}</Mono> = <Mono>{usd(cost)}</Mono>
          {m.lowest ? ' · lowest cost on the board' : m.lowPay ? ' · lowest monthly payment on the board' : ''}
        </>
      ) : (
        '—'
      ),
  })
  if (o.conditions.length) items.push({ label: 'Conditions', value: o.conditions.join('; ') })
  if (o.reasons.length) items.push({ label: 'Pricing reasons', value: <ReasonList o={o} checks={checks} /> })
  items.push({ label: 'Borrower', value: m.picked ? 'Picked this offer on the phone.' : 'Has not picked this offer.' })
  if (o.latencyMs != null) items.push({ label: 'Answered in', value: fmtSecs(o.latencyMs) })
  return <KV items={items} />
}

/* ---------------------------------------------------------------- chrome */

function Strip({ stage }: { stage: Stage[] }) {
  const labels = ['Bureau', `Lenders ×${LENDERS.length}`, 'Compliance', 'Human']
  return (
    <div className="bd-strip" aria-label="Pipeline">
      {labels.map((l, i) => (
        <span key={l} className={`bd-seg ${stage[i]}`}>
          {l}
        </span>
      ))}
    </div>
  )
}

function Wordmark({ big }: { big?: boolean }) {
  return (
    <div className={`bd-word ${big ? 'big' : ''}`}>
      <Mark size={big ? 64 : 24} className="mk" />
      <span className="disp">{PRODUCT_NAME}</span>
    </div>
  )
}

function Frame({ stage, children }: { stage: Stage[]; children: ReactNode }) {
  return (
    <div className="itag bd">
      <div className="bd-in">
        <div className="bd-top">
          <Wordmark />
          <Strip stage={stage} />
        </div>
        {children}
      </div>
    </div>
  )
}

function Title() {
  return (
    <div className="itag bd bd-title">
      <div className="bd-in">
        <Wordmark big />
        <Strip stage={['next', 'next', 'next', 'next']} />
        <div className="bd-cursor" aria-hidden="true" />
      </div>
    </div>
  )
}

function Header({ a, months }: { a: Applicant; months: number | null }) {
  const no = a.personaId.replace(/^P/i, '')
  return (
    <div className="bd-head">
      <span className="lbl">No. {no}</span>
      <h1>{a.name}</h1>
      <span className="want">
        wants <b className="mono">{usd(a.amountRequested)}</b> for {a.purpose.toLowerCase() === 'personal' ? 'personal use' : a.purpose.toLowerCase()}
        {months ? ` · ${months} months` : ''}
      </span>
      <span className="bd-tag">SANDBOX</span>
    </div>
  )
}

/* ---------------------------------------------------------------- bureau */

function Bureau({ b, compact }: { b?: Bundle; compact: boolean }) {
  const score = b ? scoreOf(b) : null
  const cells: Array<[string, string | null]> = [
    ['Score', b ? (score != null ? String(score) : 'None') : null],
    ['Tradelines', b ? String(b.credit.tradelines.length) : null],
    ['Utilization', b ? (b.credit.utilization != null ? `${Math.round(b.credit.utilization * 100)}%` : 'None') : null],
    ['Inquiries', b ? String(b.credit.inquiries6mo) : null],
    ['Identity', b ? (b.identity.verified ? 'Verified' : 'Failed') : null],
    ['Fraud', b ? (b.fraud.score != null ? String(b.fraud.score) : 'None') : null],
  ]
  return (
    <section className={`bd-bureau ${compact ? 'compact' : ''}`}>
      <div className="bh">
        <span className="disp">Bureau</span>
        <span className="bd-tag">SANDBOX</span>
        {!compact && <span className="lbl">{b ? `Pulled ${clock(b.pulledAt)} · soft pull` : 'Pulling the file…'}</span>}
      </div>
      <div className="cells">
        {cells.map(([k, v], i) => (
          <div key={k} className={`cell ${v == null ? 'empty' : ''}`} style={{ animationDelay: `${i * 140}ms` }}>
            <span className="lbl">{k}</span>
            <span className="mono val">{v ?? '—'}</span>
          </div>
        ))}
      </div>
      {b && (
        <Disclose
          id="bd-bureau"
          className="bd-bureau-more"
          tone={b.identity.verified && !flagWords(b).length ? 'info' : 'bad'}
          summary={bureauGlance(b)}
          meta="Bureau facts"
          detail={<KV items={bureauItems(b)} />}
        />
      )}
    </section>
  )
}

/* ---------------------------------------------------------------- lenders */

function LenderCol({ lenderId, o, m, requested, checks }: { lenderId: string; o?: Offer; m: Marks; requested: number; checks: ReasonCheck[] }) {
  const name = SHORT[lenderId]
  const offered = o && o.status === 'done' && o.decision === 'approve'
  const pending = !o || o.status === 'pending'
  const cls = pending ? 'pending' : !offered ? 'none' : m.picked ? 'picked' : ''
  const badge = pending ? 'Reading' : !offered ? 'No offer' : m.picked ? 'Picked' : o.classification === 'counteroffer' ? 'Counter' : 'Offer'
  const badgeCls = pending || !offered ? 'dash' : m.picked ? 'go' : 'outline'
  const tone = pending ? 'muted' : !offered ? 'bad' : m.picked ? 'good' : 'info'
  return (
    <div className={`col ${cls}`}>
      <div className="ch">
        <span className={`disp name ${!pending && !offered ? 'mute' : ''}`}>{name}</span>
        <span className={`badge ${badgeCls}`}>{badge}</span>
      </div>
      {offered && (
        <div className="aprw">
          <span className="lbl">APR</span>
          <span className="apr">{o.apr!.toFixed(2)}%</span>
        </div>
      )}
      <Disclose
        id={LENDER_DISCLOSE_ID(lenderId)}
        className="bd-lender-more"
        tone={tone}
        summary={verdictLine(o, m)}
        detail={<LenderDetail o={o} lenderId={lenderId} requested={requested} checks={checks} m={m} />}
      />
    </div>
  )
}

/* ---------------------------------------------------------------- shared detail blocks */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bd-sec">
      <span className="lbl">{title}</span>
      {children}
    </div>
  )
}

function NoticeText({ notice }: { notice?: Notice }) {
  if (!notice) return <span>No notice has been drafted yet.</span>
  const n = noticeCount(notice)
  return (
    <>
      <span className="bd-notice-meta">
        {n} of {NOTICE_ELEMENTS.length} required elements found · drafted {clock(notice.createdAt)}
        {notice.required === false ? ' · not required for this outcome' : ''}
      </span>
      <pre className="bd-notice">{notice.text}</pre>
    </>
  )
}

function LenderVerdicts({ offers, marks, checks }: { offers: Offer[]; marks: (o: Offer | undefined) => Marks; checks: ReasonCheck[] }) {
  return (
    <ul className="bd-verdicts">
      {LENDERS.map((l) => {
        const o = offers.find((x) => x.lender === l.id)
        return (
          <li key={l.id}>
            <span className="vd">
              <b>{SHORT[l.id]}:</b> {lowerFirst(verdictLine(o, marks(o)))}
            </span>
            {o && o.status === 'done' && o.reasons.length > 0 && <ReasonList o={o} checks={checks} />}
          </li>
        )
      })}
    </ul>
  )
}

/* ---------------------------------------------------------------- hard stop */

function HardStop({ events, offers, notice, decision, bundle }: { events: AuditEvent[]; offers: Offer[]; notice?: Notice; decision?: Decision; bundle?: Bundle }) {
  const stop = events.find((e) => e.action === 'rules.hard_stop' || e.action === 'hard_stop')
  const field = stop?.ref ?? 'policy'
  const sentenceText = HARD_SENTENCE[field] ?? 'A coded safety rule stopped this application before any lender saw it.'
  const isRule = (e: AuditEvent) => e.action.startsWith('rules.') || e.action === 'hard_stop'
  const visible = events.filter((e) => !e.action.startsWith('step.'))
  const ruleLines = visible.filter(isRule)
  const overrideLines = visible.filter((e) => e.action.startsWith('override.'))
  const log = [...ruleLines, ...overrideLines]
  const n = noticeCount(notice)
  const approvedCount = offers.filter((o) => o.decision === 'approve').length
  const glance = `${offers.length} ${offers.length === 1 ? 'lender' : 'lenders'} contacted, ${approvedCount} ${approvedCount === 1 ? 'offer' : 'offers'}, notice has ${n} of ${NOTICE_ELEMENTS.length} required elements, ${decision ? 'a person approved and sent the notice' : 'waiting for a person to approve the notice'}.`
  return (
    <>
      <div className="bd-hard">
        <span className="disp huge">Hard stop</span>
        <span className="sent">{sentenceText}</span>
        <span className="mono rl">RULE: {reasonLabel(field).toUpperCase()} · DECIDED IN CODE, NOT BY THE MODEL</span>
      </div>
      <Disclose
        id={DETAIL_DISCLOSE_ID}
        className="bd-detail"
        density="card"
        tone="bad"
        summary={glance}
        meta="Press D"
        detail={
          <>
            <div className="bd-tiles">
              <div className="tile">
                <span className="lbl">Lenders contacted</span>
                <span className="big">{offers.length}</span>
              </div>
              <div className="tile">
                <span className="lbl">Offers</span>
                <span className="big">{approvedCount}</span>
              </div>
              <div className="tile">
                <span className="lbl">Notice elements</span>
                <span className="big">
                  {n}/{NOTICE_ELEMENTS.length}
                </span>
              </div>
              <div className="tile human">
                <span className="lbl ink">Human approval</span>
                <span className="disp state">{decision ? 'Notice sent' : 'Waiting'}</span>
              </div>
            </div>
            <Section title={`Rule and override log · ${log.length} ${log.length === 1 ? 'line' : 'lines'}`}>
              {log.length ? <Log events={log} /> : <span>No rule lines recorded yet.</span>}
            </Section>
            {bundle && (
              <Section title="Bureau facts">
                <KV items={bureauItems(bundle)} />
              </Section>
            )}
            <Section title="Notice text">
              <NoticeText notice={notice} />
            </Section>
          </>
        }
      />
    </>
  )
}

function Log({ events }: { events: AuditEvent[] }) {
  return (
    <div className="bd-log">
      {events.map((e) => (
        <div key={e._id} className="ev">
          <span className="t">{clock(e.at)}</span>
          <span className="tx">
            {e.action === 'override.blocked' && <i className="sq" />}
            {scrubModelText(e.note ?? '') || actionWords(e.action)}
          </span>
        </div>
      ))}
    </div>
  )
}

function Approved({ a, decision, offer }: { a: Applicant; decision?: Decision; offer?: Offer }) {
  const at = decision?.at ?? Date.now()
  return (
    <div className="bd-stamp">
      <span className="disp huge">Approved</span>
      <span className="who">
        {a.name}
        {offer ? ` · ${SHORT[offer.lender]} · ${offer.apr!.toFixed(2)}% · ${usd(offer.amount)}` : ''}
      </span>
      <span className="mono tm">
        Signed by a person · {clock(at)}
      </span>
    </div>
  )
}

/* ---------------------------------------------------------------- footer + More */

interface FootProps {
  kind: 'waiting' | 'declined'
  a: Applicant
  offers: Offer[]
  events: AuditEvent[]
  bundle?: Bundle
  notice?: Notice
  decision?: Decision
  chosen?: Offer
  marks: (o: Offer | undefined) => Marks
  checks: ReasonCheck[]
}

function Foot({ kind, a, offers, events, bundle, notice, decision, chosen, marks, checks }: FootProps) {
  const waiting = kind === 'waiting'
  const humanStart = events.find((e) => e.action === 'step.human.start') ?? events.find((e) => e.action === 'step.compliance.done') ?? events[events.length - 1]
  const since = humanStart ? clock(humanStart.at) : null
  const n = noticeCount(notice)
  const offered = offers.filter((o) => o.status === 'done' && o.decision === 'approve').length
  const glance = waiting
    ? `A person at the console must approve before anything funds: ${offered} ${offered === 1 ? 'offer' : 'offers'} on the table, ${chosen ? `borrower picked ${SHORT[chosen.lender]}` : 'borrower has not picked yet'}, ${notice ? `notice drafted with ${n} of ${NOTICE_ELEMENTS.length} elements` : 'no notice drafted'}.`
    : `A person declined this application${decision ? ` at ${clock(decision.at)}` : ''} and approved the notice${notice ? ` (${n} of ${NOTICE_ELEMENTS.length} required elements)` : ''}.`
  const status: KVItem[] = waiting
    ? [
        { label: 'Waiting on', value: 'A human underwriter at the console. Nothing funds until they sign.' },
        { label: 'Since', value: since ? <Mono>{since}</Mono> : 'Just now' },
        { label: 'Borrower picked', value: chosen ? `${SHORT[chosen.lender]} · ${chosen.apr != null ? chosen.apr.toFixed(2) : '—'}% APR · ${usd(chosen.amount)}` : 'No offer picked yet' },
        { label: 'Notice', value: notice ? `Drafted · ${n} of ${NOTICE_ELEMENTS.length} required elements` : 'Not drafted' },
      ]
    : [
        { label: 'Decided by', value: decision ? `A person (${decision.approvedBy}) at ${clock(decision.at)}` : 'A person' },
        { label: 'Note', value: decision?.note ? scrubModelText(decision.note) : 'No note left' },
        { label: 'Borrower picked', value: chosen ? `${SHORT[chosen.lender]} · ${chosen.apr != null ? chosen.apr.toFixed(2) : '—'}% APR · ${usd(chosen.amount)}` : 'No offer picked' },
        { label: 'Notice', value: notice ? `Approved · ${n} of ${NOTICE_ELEMENTS.length} required elements` : 'No notice on file' },
      ]
  return (
    <div className="bd-footwrap">
      <div className="bd-foot">
        <div className="l">
          <i />
          <span className="disp">{waiting ? 'Waiting for underwriter' : 'Declined'}</span>
        </div>
        <span className="r">{waiting ? 'Nothing funds until a person approves' : 'A person approved the notice'}</span>
      </div>
      <Disclose
        id={DETAIL_DISCLOSE_ID}
        className="bd-detail"
        density="card"
        tone="human"
        summary={glance}
        meta="More · press D"
        detail={
          <>
            <Section title={waiting ? 'Who is waiting' : 'Decision'}>
              <KV items={status} />
            </Section>
            <Section title="Lender verdicts">
              <LenderVerdicts offers={offers} marks={marks} checks={checks} />
            </Section>
            <Section title="Bureau facts">{bundle ? <KV items={bureauItems(bundle)} /> : <span>The bureau file has not been pulled.</span>}</Section>
            <Section title="Notice text">
              <NoticeText notice={notice} />
            </Section>
            <span className="lbl">Applicant {a.name} · persona {a.personaId}</span>
          </>
        }
      />
    </div>
  )
}

/* ---------------------------------------------------------------- main */

function BoardMain({ desk: globalDesk, applicantId }: { desk: Desk; applicantId: string | null }) {
  const picked = useMemo(() => {
    if (applicantId) return globalDesk.applicants.find((x) => x._id === applicantId)
    return globalDesk.applicants.slice().sort((x, y) => y.createdAt - x.createdAt)[0]
  }, [globalDesk.applicants, applicantId])
  // Per-applicant query (desk:getApplicantView) so the global caps (200/600/300) never hide this applicant's rows.
  const slice = useApplicantSlice(applicantId ?? picked?._id ?? null, globalDesk.replaying)
  const desk = useMemo<Desk>(
    () =>
      slice
        ? { ...globalDesk, applicants: slice.applicant ? [slice.applicant, ...globalDesk.applicants.filter((x) => x._id !== slice.applicant!._id)] : globalDesk.applicants, offers: slice.offers, auditEvents: slice.auditEvents, bundles: slice.bundles, notices: slice.notices, decisions: slice.decisions }
        : globalDesk,
    [globalDesk, slice],
  )
  const a = slice?.applicant ?? picked
  if (!a) return <Title />
  const offers = offersFor(desk.offers, a._id)
  const events = eventsFor(desk.auditEvents, a._id).slice().sort((x, y) => x.at - y.at)
  const bundle = desk.bundles.find((b) => b.applicantId === a._id)
  const notice = desk.notices.find((n) => n.applicantId === a._id)
  const decision = desk.decisions.find((d) => d.applicantId === a._id)
  const checks = desk.reasonChecks.filter((c) => c.applicantId === a._id)
  const stage = stages(a, desk, notice, decision)
  const months = offers.find((o) => o.termMonths)?.termMonths ?? null

  if (a.status === 'hard_stop' || decision?.outcome === 'hard_stop') {
    return (
      <Frame stage={stage}>
        <Header a={a} months={null} />
        <HardStop events={events} offers={offers} notice={notice} decision={decision} bundle={bundle} />
      </Frame>
    )
  }

  const done = offers.filter((o) => o.status === 'done' && o.decision === 'approve' && o.apr != null)
  const costs = done.map((o) => ({ id: o._id, c: costOf(o) ?? Infinity, p: payOf(o) ?? Infinity }))
  const lowestId = done.length > 1 ? costs.slice().sort((x, y) => x.c - y.c)[0]?.id : done.length === 1 ? done[0]._id : undefined
  const lowPayId = done.length > 1 ? costs.slice().sort((x, y) => x.p - y.p)[0]?.id : undefined
  const chosenId = a.chosenOfferId ?? decision?.chosenOfferId ?? null
  const showCols = offers.length > 0 || stage[1] !== 'next'
  const approved = a.status === 'approved'
  const chosen = offers.find((o) => o._id === chosenId)
  const marks = (o: Offer | undefined): Marks => ({
    picked: !!o && o._id === chosenId,
    lowest: !!o && o._id === lowestId && lowestId !== lowPayId,
    lowPay: !!o && o._id === lowPayId && lowestId !== lowPayId,
  })
  const footProps = { a, offers, events, bundle, notice, decision, chosen, marks, checks }

  return (
    <Frame stage={stage}>
      <Header a={a} months={months} />
      {!approved && <Bureau b={bundle} compact={showCols} />}
      {showCols && !approved && (
        <DiscloseGroup className="bd-lenders" title="Lenders · one line each, press 1–5 or A for the full panel">
          <div className="bd-cols" style={{ ['--lenders' as string]: LENDERS.length }}>
            {LENDERS.map((l) => {
              const o = offers.find((x) => x.lender === l.id)
              return <LenderCol key={l.id} lenderId={l.id} o={o} m={marks(o)} requested={a.amountRequested} checks={checks} />
            })}
          </div>
        </DiscloseGroup>
      )}
      {approved && <Approved a={a} decision={decision} offer={chosen} />}
      {a.status === 'awaiting_human' && <Foot kind="waiting" {...footProps} />}
      {a.status === 'declined' && <Foot kind="declined" {...footProps} />}
    </Frame>
  )
}

/* ---------------------------------------------------------------- eval */

function outcomeWord(s: string) {
  return s.replace(/_/g, ' ')
}

function EvalView({ desk }: { desk: Desk }) {
  const runs = desk.evalRuns.filter((r) => r.finishedAt).slice().sort((x, y) => y.startedAt - x.startedAt)
  const run = runs[0]
  const total = run?.cases || desk.evalCases.length || 20
  const fails: EvalFailure[] = run?.failures ?? []
  const passed = run ? Math.round(run.agreement * run.cases) : null
  const name = (id: string) => desk.personas.find((p) => p.personaId === id)?.name ?? id
  const failIds = new Set(fails.map((f) => f.personaId))
  const rows = [
    ...fails.map((f) => ({ id: f.personaId, fail: true, left: `expected ${outcomeWord(f.expected)}, got ${outcomeWord(f.got)}`, why: f.why, f })),
    ...desk.evalCases
      .filter((c) => !failIds.has(c.personaId))
      .slice()
      .sort((x, y) => x.personaId.localeCompare(y.personaId))
      .map((c) => ({ id: c.personaId, fail: false, left: outcomeWord(c.expected), why: '', f: undefined as EvalFailure | undefined })),
  ]
  const half = Math.ceil(rows.length / 2)
  const secs = run?.finishedAt ? ((run.finishedAt - run.startedAt) / 1000).toFixed(1) : null
  const commit = desk.config?.commit
  const glance = !run
    ? 'No eval run on record yet. Press the eval button on the console to run every persona.'
    : fails.length === 0
      ? `All ${total} personas agree with the expected outcome. Nothing is failing.`
      : `${passed} of ${total} personas agree with the expected outcome; ${fails.length} failing: ${fails.map((f) => `${f.personaId} expected ${outcomeWord(f.expected)}, got ${outcomeWord(f.got)}`).join('; ')}.`
  return (
    <div className="itag bd">
      <div className="bd-in">
        <div className="bd-top">
          <Wordmark />
          <span className="disp" style={{ fontSize: 28 }}>
            Eval · every build
          </span>
        </div>
        <div className="bd-evalhead">
          <div className="score">
            <span className="mono n">{passed ?? '—'}</span>
            <span className="mono d">/{total}</span>
          </div>
          <div className="meta">
            <div>
              <span className="lbl">Run time</span>
              <span className="mono v">{secs ? `${secs}s` : '—'}</span>
            </div>
            <div>
              <span className="lbl">Commit</span>
              <span className="mono v">{commit ? commit.slice(0, 7) : 'dev'}</span>
            </div>
            <div>
              <span className="lbl">Failing</span>
              <span className={`mono v ${fails.length ? 'sig' : ''}`}>{run ? fails.length : '—'}</span>
            </div>
          </div>
        </div>
        <p className="bd-glance">{glance}</p>
        <div className="bd-evalrows">
          {[rows.slice(0, half), rows.slice(half)].map((chunk, ci) => (
            <div key={ci} className="ecol">
              {chunk.map((r) =>
                r.fail && r.f ? (
                  <Disclose
                    key={r.id}
                    id={`bd-eval-${r.id}`}
                    className="bd-evalfail"
                    tone="bad"
                    summary={`${name(r.id)} failed: ${r.left}.`}
                    meta={`FAIL · ${r.id}`}
                    detail={
                      <KV
                        items={[
                          { label: 'Persona', value: `${name(r.id)} (${r.id})` },
                          { label: 'Expected', value: outcomeWord(r.f.expected) },
                          { label: 'Got', value: outcomeWord(r.f.got) },
                          { label: 'Why', value: r.why ? r.why : 'No explanation was recorded for this case.' },
                          { label: 'Run time', value: secs ? `${secs}s` : '—' },
                          { label: 'Commit', value: <Mono>{commit ? commit.slice(0, 7) : 'dev'}</Mono> },
                        ]}
                      />
                    }
                  />
                ) : (
                  <div key={r.id} className="er">
                    <span className="mono id">{r.id}</span>
                    <span className="nm">{name(r.id)}</span>
                    <span className="mono lf">PASS</span>
                  </div>
                ),
              )}
            </div>
          ))}
          {rows.length === 0 && <div className="er">No eval run yet. Press the eval button on the console.</div>}
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- root */

export default function Board() {
  const desk = useDesk()
  const params = useHashParams()
  const view = params.get('view') === 'eval' ? 'eval' : 'board'
  const applicant = params.get('applicant')

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && /input|textarea|select/i.test(t.tagName)) return
      const k = e.key.toLowerCase()
      if (k === 'e') setView('eval')
      else if (k === 'b') setView('board')
      else if (k === 'r') {
        setView('board')
        if (desk.replaying) {
          desk.stopReplay()
          setTimeout(desk.startReplay, 80)
        } else desk.startReplay()
      } else if (/^[1-9]$/.test(k)) {
        const L = LENDERS[Number(k) - 1]
        if (L) clickToggle(`${LENDER_DISCLOSE_ID(L.id)}-summary`)
      } else if (k === 'a') {
        const btn = document.querySelector<HTMLButtonElement>('.bd-lenders .disclose-group__toggle')
        btn?.click()
      } else if (k === 'd') clickToggle(`${DETAIL_DISCLOSE_ID}-summary`)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [desk])

  useEffect(() => {
    document.title = `${PRODUCT_NAME} board`
  }, [])

  return view === 'eval' ? <EvalView desk={desk} /> : <BoardMain desk={desk} applicantId={applicant} />
}
