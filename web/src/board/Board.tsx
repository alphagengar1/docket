// Second screen (#/board): the "lender floor" the judges watch. Instrument Tag theme, read from 2 m.
// Follows the newest applicant (or ?applicant=<id>). Keys: E eval view, B board, R replay.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { PRODUCT_NAME } from '../config'
import { useApplicantSlice, useDesk, type Desk } from '../hooks/useDesk'
import { LENDERS, type Applicant, type AuditEvent, type Bundle, type Decision, type Notice, type Offer } from '../types'
import { clock, monthlyPayment, usd } from '../lib/format'
import { eventsFor, offersFor, stepTimings } from '../lib/select'
import { fieldLabel } from '../../../convex/labels'
import './board.css'

type Stage = 'done' | 'now' | 'next' | 'cancelled'

const SHORT: Record<string, string> = { cu: 'Pacific Ridge', fintech: 'Northstar', prime: 'Meridian Prime' }
const POLICY: Record<string, string> = {
  cu: 'Conservative. Needs a score of 660 or more and utilization at 50% or less.',
  fintech: 'Growth. Prices near-prime and thin files. Needs a score of 600 or more.',
  prime: 'Prime. Needs a score of 720 or more and utilization at 30% or less.',
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

function Strip({ stage }: { stage: Stage[] }) {
  const labels = ['Bureau', 'Lenders ×3', 'Compliance', 'Human']
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
      <i />
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

function Bureau({ b, compact }: { b?: Bundle; compact: boolean }) {
  const score = b ? (b.credit.fico9 ?? b.credit.vantage4) : null
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
    </section>
  )
}

function costOf(o: Offer): number | null {
  if (o.costToBorrow != null) return o.costToBorrow
  const m = payOf(o)
  return m != null && o.termMonths != null && o.amount != null ? m * o.termMonths - o.amount : null
}
function payOf(o: Offer): number | null {
  return o.monthlyPayment ?? monthlyPayment(o.amount, o.apr, o.termMonths)
}

function LenderCol({ lenderId, o, picked, lowest, lowPay }: { lenderId: string; o?: Offer; picked: boolean; lowest: boolean; lowPay: boolean }) {
  const name = SHORT[lenderId]
  const L = LENDERS.find((l) => l.id === lenderId)!
  const offered = o && o.status === 'done' && o.decision === 'approve'
  if (!o || o.status === 'pending') {
    return (
      <div className="col pending">
        <div className="ch">
          <span className="disp name">{name}</span>
          <span className="badge dash">Reading</span>
        </div>
        <p className="pol">{POLICY[lenderId] ?? L.policy}</p>
        <div className="lbl">Reading the file…</div>
      </div>
    )
  }
  if (!offered) {
    const failed = o.status === 'failed'
    const r = o.reasons[0]
    return (
      <div className="col none">
        <div className="ch">
          <span className="disp name mute">{name}</span>
          <span className="badge dash">No offer</span>
        </div>
        <p className="pol">{POLICY[lenderId] ?? L.policy}</p>
        <div className="why">
          <span className="lbl">Reason</span>
          <span className="reason">{failed ? 'Lender did not answer in time' : (r?.text.replace(/^the applicant['’]s /i, '') ?? 'Declined')}</span>
        </div>
        <span className="lbl rule">Rule {failed ? 'timeout' : fieldLabel(r?.field ?? 'policy')} · reason logged</span>
      </div>
    )
  }
  const pay = payOf(o)
  const cost = costOf(o)
  const tail = lowest ? 'lowest cost' : lowPay ? 'lower payment' : ''
  const rule = fieldLabel(o.reasons[0]?.field ?? 'policy')
  return (
    <div className={`col ${picked ? 'picked' : ''}`}>
      <div className="ch">
        <span className="disp name">{name}</span>
        <span className={`badge ${picked ? 'go' : 'outline'}`}>{picked ? 'Picked' : o.classification === 'counteroffer' ? 'Counter' : 'Offer'}</span>
      </div>
      <p className="pol">{POLICY[lenderId] ?? L.policy}</p>
      <div className="aprw">
        <span className="lbl">APR</span>
        <span className="apr">{o.apr!.toFixed(2)}%</span>
      </div>
      <div className="line">
        <span>Monthly</span>
        <span className="val">{pay != null ? usd(pay, 2) : '—'}</span>
      </div>
      <div className="line">
        <span>Cost to borrow</span>
        <span className="val">{cost != null ? usd(cost) : '—'}</span>
      </div>
      <span className="lbl rule">
        Rule {rule}
        {tail ? ` · ${tail}` : ''}
      </span>
    </div>
  )
}

function noticeCount(n?: Notice) {
  if (!n) return 0
  return NOTICE_ELEMENTS.filter((r) => r.test(n.text)).length
}

function HardStop({ events, offers, notice, decision }: { events: AuditEvent[]; offers: Offer[]; notice?: Notice; decision?: Decision }) {
  const stop = events.find((e) => e.action === 'rules.hard_stop' || e.action === 'hard_stop')
  const field = stop?.ref ?? 'policy'
  const sentence = HARD_SENTENCE[field] ?? 'A coded safety rule stopped this application before any lender saw it.'
  const isRule = (e: AuditEvent) => e.action.startsWith('rules.') || e.action === 'hard_stop'
  const visible = events.filter((e) => !e.action.startsWith('step.'))
  const ruleLines = visible.filter(isRule)
  const overrideLine = visible.filter((e) => e.action.startsWith('override.')).slice(-1)
  // Rule lines first, then the latest override attempt; cap at 8 (keep newest rule lines if over).
  const log = [...ruleLines.slice(-(8 - overrideLine.length)), ...overrideLine]
  const n = noticeCount(notice)
  return (
    <>
      <div className="bd-hard">
        <span className="disp huge">Hard stop</span>
        <span className="sent">{sentence}</span>
        <span className="mono rl">RULE {field} · DECIDED IN CODE, NOT BY THE MODEL</span>
      </div>
      <div className="bd-tiles">
        <div className="tile">
          <span className="lbl">Lenders contacted</span>
          <span className="big">{offers.length}</span>
        </div>
        <div className="tile">
          <span className="lbl">Offers</span>
          <span className="big">{offers.filter((o) => o.decision === 'approve').length}</span>
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
      <Log events={log} />
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
            {e.note || e.action}
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
  const stage = stages(a, desk, notice, decision)
  const months = offers.find((o) => o.termMonths)?.termMonths ?? null

  if (a.status === 'hard_stop' || decision?.outcome === 'hard_stop') {
    return (
      <Frame stage={stage}>
        <Header a={a} months={null} />
        <HardStop events={events} offers={offers} notice={notice} decision={decision} />
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

  return (
    <Frame stage={stage}>
      <Header a={a} months={months} />
      {!approved && <Bureau b={bundle} compact={showCols} />}
      {showCols && !approved && (
        <div className="bd-cols">
          {LENDERS.map((l) => {
            const o = offers.find((x) => x.lender === l.id)
            return <LenderCol key={l.id} lenderId={l.id} o={o} picked={!!o && o._id === chosenId} lowest={o?._id === lowestId && lowestId !== lowPayId} lowPay={o?._id === lowPayId && lowestId !== lowPayId} />
          })}
        </div>
      )}
      {approved && <Approved a={a} decision={decision} offer={chosen} />}
      {a.status === 'awaiting_human' && (
        <div className="bd-foot">
          <div className="l">
            <i />
            <span className="disp">Waiting for underwriter</span>
          </div>
          <span className="r">Nothing funds until a person approves</span>
        </div>
      )}
      {a.status === 'declined' && (
        <div className="bd-foot">
          <div className="l">
            <i />
            <span className="disp">Declined</span>
          </div>
          <span className="r">A person approved the notice</span>
        </div>
      )}
    </Frame>
  )
}

function EvalView({ desk }: { desk: Desk }) {
  const runs = desk.evalRuns.filter((r) => r.finishedAt).slice().sort((x, y) => y.startedAt - x.startedAt)
  const run = runs[0]
  const total = run?.cases || desk.evalCases.length || 20
  const fails = run?.failures ?? []
  const passed = run ? Math.round(run.agreement * run.cases) : null
  const name = (id: string) => desk.personas.find((p) => p.personaId === id)?.name ?? id
  const failIds = new Set(fails.map((f) => f.personaId))
  const rows = [
    ...fails.map((f) => ({ id: f.personaId, fail: true, left: `${f.expected} → ${f.got}`, why: f.why })),
    ...desk.evalCases
      .filter((c) => !failIds.has(c.personaId))
      .slice()
      .sort((x, y) => x.personaId.localeCompare(y.personaId))
      .map((c) => ({ id: c.personaId, fail: false, left: c.expected.replace('_', ' '), why: '' })),
  ]
  const half = Math.ceil(rows.length / 2)
  const secs = run?.finishedAt ? ((run.finishedAt - run.startedAt) / 1000).toFixed(1) : null
  const commit = desk.config?.commit
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
        <div className="bd-evalrows">
          {[rows.slice(0, half), rows.slice(half)].map((chunk, ci) => (
            <div key={ci} className="ecol">
              {chunk.map((r) => (
                <div key={r.id} className={`er ${r.fail ? 'fail' : ''}`}>
                  <span className="mono id">{r.id}</span>
                  <span className="nm">{name(r.id)}{r.fail ? ` · ${r.left}` : ''}</span>
                  <span className="mono lf">{r.fail ? 'FAIL' : 'PASS'}</span>
                </div>
              ))}
            </div>
          ))}
          {rows.length === 0 && <div className="er">No eval run yet. Press the eval button on the console.</div>}
        </div>
      </div>
    </div>
  )
}

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
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [desk])

  useEffect(() => {
    document.title = `${PRODUCT_NAME} board`
  }, [])

  return view === 'eval' ? <EvalView desk={desk} /> : <BoardMain desk={desk} applicantId={applicant} />
}
