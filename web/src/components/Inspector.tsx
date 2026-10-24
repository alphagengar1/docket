import { useState, type ReactNode } from 'react'
import type { Applicant, AuditEvent, Bundle, Decision, Notice, Offer, ReasonCheck } from '../types'
import { LENDERS } from '../types'
import { clock, monthlyPayment, num, pct, secs, usd } from '../lib/format'
import { STATUS_TONE, STATUS_WORD, IN_FLIGHT } from '../lib/status'
import { noticeRequired, verifiedReasons } from '../lib/select'
import { ReasonList } from './ReasonList'
import { Num } from './OfferCard'
import { fieldLabel } from '../../../convex/labels'

export type InspectorTab = 'offer' | 'trace' | 'notice'

interface Props {
  applicant: Applicant | undefined
  original: Applicant | undefined
  bundle: Bundle | undefined
  offers: Offer[]
  notice: Notice | undefined
  decision: Decision | undefined
  events: AuditEvent[]
  checks: ReasonCheck[]
  selectedOffer: Offer | undefined
  tab: InspectorTab
  onTab: (t: InspectorTab) => void
  onApprove: () => Promise<void>
  onDecline: (note: string) => Promise<void>
  onDispute: (index: number) => Promise<void>
}

export const ACTOR_COLOR: Record<string, string> = {
  intake: 'var(--actor-applicant)',
  applicant: 'var(--actor-applicant)',
  desk: 'var(--actor-desk)',
  crs: 'var(--actor-crs)',
  rules: 'var(--actor-rules)',
  'underwriter:cu': 'var(--actor-underwriter)',
  'underwriter:fintech': 'var(--actor-underwriter)',
  'underwriter:prime': 'var(--actor-underwriter)',
  compliance: 'var(--actor-compliance)',
  human: 'var(--actor-human)',
}

export function Inspector(p: Props) {
  const { applicant, bundle, offers, notice, decision, events, checks, selectedOffer, tab, onTab, original } = p
  const [declining, setDeclining] = useState(false)
  const [rationale, setRationale] = useState('')
  const [busy, setBusy] = useState(false)

  const canApprove = !!applicant && applicant.status === 'awaiting_human' && !!selectedOffer && selectedOffer.decision === 'approve' && !busy
  const canDecline = !!applicant && applicant.status === 'awaiting_human' && !busy
  const declined = offers.filter((o) => o.status === 'done' && o.decision === 'decline')

  const act = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      setDeclining(false)
      setRationale('')
    } finally {
      setBusy(false)
    }
  }

  if (!applicant) {
    return (
      <aside className="pane" aria-label="Inspector">
        <div className="inspector-head">
          <div className="name">Inspector</div>
          <div className="idrow">select an applicant from the queue</div>
        </div>
        <div className="empty">Credit snapshot, trace and the adverse-action notice appear here.</div>
      </aside>
    )
  }

  return (
    <aside className="pane" aria-label="Inspector">
      {/* Method entity header: name, mono id, status pill */}
      <div className="inspector-head">
        <div className="name">{applicant.name}</div>
        <div className="idrow">
          <span>{applicant._id}</span>
          <span className={`pill ${STATUS_TONE[applicant.status]} ${IN_FLIGHT.includes(applicant.status) ? 'live' : ''}`}>{STATUS_WORD[applicant.status]}</span>
          {original && <span className="pill accent">replay</span>}
        </div>
      </div>

      <Overview applicant={applicant} bundle={bundle} />
      <Tradelines bundle={bundle} canDispute={!!bundle && !IN_FLIGHT.includes(applicant.status) && !applicant.replayOf} onDispute={p.onDispute} />

      <div className="tabs" role="tablist">
        {(['offer', 'trace', 'notice'] as InspectorTab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className="tab" onClick={() => onTab(t)}>
            {t === 'offer' ? 'Offer' : t === 'trace' ? `Trace ${events.length}` : 'Notice'}
          </button>
        ))}
      </div>

      <div className="inspector-body" role="tabpanel">
        {tab === 'offer' && <OfferTab applicant={applicant} offer={selectedOffer} decision={decision} offers={offers} checks={checks} />}
        {tab === 'trace' && <TraceTab applicant={applicant} events={events} />}
        {tab === 'notice' && <NoticeTab applicant={applicant} bundle={bundle} notice={notice} declined={declined} offers={offers} decision={decision} checks={checks} />}
      </div>

      <div className="inspector-foot">
        {declining && (
          <div className="field">
            <label className="label" htmlFor="rationale">
              Decline rationale (required, goes to the audit log)
            </label>
            <textarea id="rationale" value={rationale} onChange={(e) => setRationale(e.target.value)} autoFocus />
          </div>
        )}
        <div className="row">
          {declining ? (
            <>
              <button type="button" className="ghost" onClick={() => setDeclining(false)}>
                Cancel
              </button>
              <button type="button" className="decline-pill" disabled={!canDecline || rationale.trim().length < 4} onClick={() => act(() => p.onDecline(rationale.trim()))}>
                Record decline
              </button>
            </>
          ) : (
            <>
              <button type="button" className="ghost" disabled={!canDecline} onClick={() => setDeclining(true)}>
                Decline…
              </button>
              <button type="button" className="approve-pill" disabled={!canApprove} onClick={() => act(p.onApprove)}>
                {selectedOffer && canApprove
                  ? `Approve ${LENDERS.find((l) => l.id === selectedOffer.lender)?.label} offer`
                  : applicant.status === 'approved'
                    ? 'Approved'
                    : 'Approve offer'}
              </button>
            </>
          )}
        </div>
        <span className="label">
          {applicant.status === 'awaiting_human' && !selectedOffer
            ? 'Select an offer card to enable approval.'
            : applicant.status === 'awaiting_human'
              ? 'Approval is recorded with approvedBy: human.'
              : IN_FLIGHT.includes(applicant.status)
                ? 'Desk is still running.'
                : 'No action available in this state.'}
        </span>
      </div>
    </aside>
  )
}

/** Hyperexpense tick meter: 2x12px ticks at 4px pitch, lit up to the value. */
function Meter({ value, max = 1, warn, bad, n = 20 }: { value: number | null; max?: number; warn?: number; bad?: number; n?: number }) {
  if (value == null) return null
  const k = Math.round(Math.min(1, value / max) * n)
  const color = bad != null && value >= bad ? 'var(--hard)' : warn != null && value >= warn ? 'var(--decline)' : 'var(--approve)'
  return (
    <span className="meter" aria-hidden="true" style={{ ['--meter' as string]: color }}>
      {Array.from({ length: n }, (_, i) => (
        <i key={i} className={i < k ? 'on' : ''} />
      ))}
    </span>
  )
}

/** Method "Overview": ruled key/value rows; numbers mono right-aligned. */
function Overview({ applicant, bundle }: { applicant: Applicant; bundle: Bundle | undefined }) {
  const sk = <span className="skel" style={{ width: 48, height: 12 }} />
  const c = bundle?.credit
  return (
    <div className="kvgrid" aria-label="Credit snapshot" aria-busy={!bundle}>
      <span className="k">Requested</span>
      <span className="v">
        {applicant.purpose} · <Num value={applicant.amountRequested} digits={0} prefix="$" />
      </span>
      <span className="k">Stated income</span>
      <span className="v">
        <Num value={applicant.statedIncome} digits={0} prefix="$" />
      </span>
      <span className="k">Score (TU)</span>
      <span className="v">{bundle ? num(c!.fico9) : sk}</span>
      <span className="k">Vantage 4</span>
      <span className="v">{bundle ? num(c!.vantage4) : sk}</span>
      <span className="k">Utilization</span>
      <span className="v">
        {bundle ? (
          <>
            <Meter value={c!.utilization} warn={0.5} bad={0.8} />
            {pct(c!.utilization)}
          </>
        ) : (
          sk
        )}
      </span>
      <span className="k">Inquiries 6mo</span>
      <span className="v">{bundle ? String(c!.inquiries6mo) : sk}</span>
      <span className="k">Identity</span>
      <span className="v">
        {bundle ? <span className={`pill ${bundle.identity.verified ? 'approve' : 'hard'}`}>{bundle.identity.verified ? 'Verified' : 'Failed'}</span> : sk}
      </span>
      <span className="k">Fraud score</span>
      <span className="v">
        {bundle ? (
          <>
            <Meter value={bundle.fraud.score} max={100} warn={40} bad={80} />
            <span className={bundle.fraud.score != null && bundle.fraud.score >= 80 ? 'tone-hard' : ''}>{num(bundle.fraud.score)}</span>
          </>
        ) : (
          sk
        )}
      </span>
    </div>
  )
}

function Tradelines({ bundle, canDispute, onDispute }: { bundle: Bundle | undefined; canDispute: boolean; onDispute: (i: number) => Promise<void> }) {
  const [open, setOpen] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  if (!bundle) return null
  const rows = bundle.credit.tradelines
  return (
    <div className="tradelines">
      <div className="tl-head">
        <span className="section-label">
          Tradelines <span className="mono">{rows.length}</span>
        </span>
        <button type="button" className="ghost tab" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && rows.length > 0 && (
        <table className="grid tl">
          <tbody>
            {rows.map((t, i) => {
              const derog = /dpd|late|collection|chargeoff|bk/.test(t.status)
              return (
                <tr key={i}>
                  <td>[{i}]</td>
                  <td className="t">{t.type.replace('_', ' ')}</td>
                  <td className="t" style={{ textAlign: 'right' }}>
                    {usd(t.balance)}
                  </td>
                  <td className={derog ? 'tone-decline' : ''}>{t.status}</td>
                  <td>{t.openedAt.slice(0, 7)}</td>
                  <td style={{ textAlign: 'right', paddingRight: 'var(--sp-3)' }}>
                    <button
                      type="button"
                      className="link"
                      disabled={!canDispute || busy != null}
                      title={canDispute ? 'Applicant disputes this line: re-pull and replay the desk' : 'Available once the run finishes (not on a replay)'}
                      onClick={async () => {
                        setBusy(i)
                        try {
                          await onDispute(i)
                        } finally {
                          setBusy(null)
                        }
                      }}
                    >
                      {busy === i ? 'Replaying…' : 'Dispute'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {open && rows.length === 0 && <div className="muted" style={{ padding: '0 16px 8px' }}>No tradelines on file.</div>}
    </div>
  )
}

function OfferTab({ applicant, offer, decision, offers, checks }: { applicant: Applicant; offer: Offer | undefined; decision: Decision | undefined; offers: Offer[]; checks: ReasonCheck[] }) {
  const chosen = decision?.chosenOfferId ? offers.find((o) => o._id === decision.chosenOfferId) : undefined
  const show = offer ?? chosen
  return (
    <>
      {decision && (
        <div className={`decision-record ${decision.outcome === 'declined' ? 'declined' : ''}`}>
          <div className={`status nodot tone-${decision.outcome === 'approved' ? 'approve' : decision.outcome === 'declined' ? 'decline' : 'hard'}`}>
            {decision.outcome} · by {decision.approvedBy}
          </div>
          <div className="chip">{clock(decision.at)}</div>
          <div>{decision.note}</div>
        </div>
      )}
      {applicant.status === 'hard_stop' && <div className="muted">Hard stop: no offers exist for this file. See the Trace tab for the triggering field.</div>}
      {!show && applicant.status !== 'hard_stop' && (
        <div className="muted">{offers.some((o) => o.decision === 'approve') ? 'Click an offer card on the board to inspect it.' : 'No approvable offer yet.'}</div>
      )}
      {show && (
        <>
          <div className="summary">
            <span className="section-label">{LENDERS.find((l) => l.id === show.lender)?.name}</span>
            <span className="big mono">
              <Num value={show.apr ?? 0} />
              <span className="muted" style={{ fontSize: 'var(--fs-body)', fontWeight: 400 }}>
                {' '}
                % APR
              </span>
            </span>
            <span className="chips">
              <span className="chip">{usd(monthlyPayment(show.amount, show.apr, show.termMonths))} / mo</span>
              <span className="chip">{show.termMonths} mo</span>
              <span className="chip">{usd(show.amount)}</span>
            </span>
          </div>
          <div className="kvgrid" style={{ padding: 0, borderBottom: 'none' }}>
            <span className="k">Provider</span>
            <span className="v">{show.provider}</span>
            <span className="k">Run</span>
            <span className="v">{show.runId ?? '—'}</span>
            <span className="k">Latency</span>
            <span className="v">{secs(show.latencyMs, 2)}</span>
            <span className="k">Classification</span>
            <span className="v">{show.classification ?? '—'}</span>
          </div>
          {show.conditions.length > 0 && (
            <div className="block">
              <span className="label">Conditions</span>
              <ul className="conds">
                {show.conditions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="block">
            <span className="label">Reasons</span>
            <ReasonList offer={show} checks={checks} numbered />
          </div>
        </>
      )}
    </>
  )
}

/** Trace: pipeline steps as section rows, events beneath them in plain words. */
const STEP_TITLE: Record<string, string> = {
  pull: 'Bureau pull',
  guardrails: 'Hard-stop rules',
  underwrite: 'Three lenders',
  verify: 'Reason verification',
  compliance: 'Adverse-action notice',
  human: 'Human review',
}
const ACTION_TITLE: Record<string, string> = {
  'intake.submitted': 'Application received',
  'intake.replay': 'Replay started',
  'replay.started': 'Replay started',
  'rules.pass': 'All hard-stop rules passed',
  'rules.hard_stop': 'Hard stop',
  'crs.error': 'Bureau pull failed',
  'desk.error': 'Desk error',
  'underwrite.started': 'Started reading the file',
  'underwrite.start': 'Started reading the file',
  'underwrite.done': 'Decision returned',
  'underwrite.failed': 'Lender did not answer',
  'verify.requested': 'Verification requested',
  'verify.supported': 'Reason holds up',
  'verify.unsupported': 'Reason does not hold up',
  'verify.inconclusive': 'Reason inconclusive',
  'verify.sanity': 'Sanity check',
  'compliance.notice': 'Notice drafted',
  'compliance.failed': 'Notice failed',
  'compliance.unverified_reasons_used': 'Unverified reasons kept',
  'notice.approved': 'Notice signed',
  'offer.chosen': 'Borrower chose an offer',
  'override.blocked': 'Override refused',
  'dispute.tradeline': 'Tradeline disputed',
  'step.compliance.skipped': 'Notice not required',
}
const BAD = /hard_stop|failed|blocked|unsupported|error|unverified/
const GOOD = /rules\.pass|verify\.supported|compliance\.notice|notice\.approved|offer\.chosen|\.done$/
const CONVEX_ID = /^[a-z0-9]{30,34}$/
const ACTOR_WORD: Record<string, string> = {
  'underwriter:cu': 'Credit union',
  'underwriter:fintech': 'Fintech',
  'underwriter:prime': 'Prime bank',
  compliance: 'Compliance',
  human: 'Reviewer',
  applicant: 'Borrower',
}
function titleOf(e: AuditEvent): string {
  if (ACTION_TITLE[e.action]) return ACTION_TITLE[e.action]
  const m = e.action.match(/^step\.([a-z]+)\.(start|done)$/)
  if (m) return `${STEP_TITLE[m[1]] ?? m[1]} ${m[2] === 'start' ? 'started' : 'finished'}`
  return e.action.replace(/[._]/g, ' ')
}
function refOf(e: AuditEvent): string | null {
  if (!e.ref || CONVEX_ID.test(e.ref)) return null
  if (e.action === 'rules.hard_stop') return fieldLabel(e.ref)
  return e.ref
}
function noteOf(e: AuditEvent): string | null {
  const n = (e.note ?? '').trim()
  if (!n) return null
  if (e.action === 'step.pull.done') return n.replace(/^source=\w+;\s*/, '')
  return n
}
const tsec = (ms: number) => `${(ms / 1000).toFixed(1)}s`

function TraceTab({ applicant, events }: { applicant: Applicant; events: AuditEvent[] }) {
  const rows = events.slice().sort((a, b) => a.at - b.at)
  const starts = new Map<string, number>()
  const out: ReactNode[] = []
  for (const e of rows) {
    const m = e.action.match(/^step\.([a-z]+)\.(start|done)$/)
    if (m && m[2] === 'start') {
      starts.set(m[1], e.at)
      out.push(
        <li key={e._id} className="step">
          <span className="d" style={{ ['--actor' as string]: ACTOR_COLOR[e.actor] }} />
          <span className="body"><div className="title">{STEP_TITLE[m[1]] ?? m[1]}</div></span>
          <span className="t">+{tsec(e.at - applicant.createdAt)}</span>
        </li>,
      )
      continue
    }
    if (m && m[2] === 'done') {
      const s = starts.get(m[1])
      const note = noteOf(e)
      const stopped = /hard stop/i.test(note ?? '')
      out.push(
        <li key={e._id} className={`done${stopped ? ' bad' : ''}`}>
          <span className="d" />
          <span className="body">
            <div className="title">{stopped ? note : `Done${note ? ` · ${note}` : ''}`}</div>
          </span>
          <span className="t">{s != null ? tsec(e.at - s) : `+${tsec(e.at - applicant.createdAt)}`}</span>
        </li>,
      )
      continue
    }
    const tone = BAD.test(e.action) ? ' bad' : GOOD.test(e.action) ? ' good' : ''
    const ref = refOf(e)
    const note = noteOf(e)
    const who = ACTOR_WORD[e.actor]
    out.push(
      <li key={e._id} className={`ev${tone}`}>
        <span className="d" style={{ ['--actor' as string]: ACTOR_COLOR[e.actor] }} />
        <span className="body">
          <div className="title">
            {titleOf(e)}
            {ref && <span className="chip">{ref}</span>}
            {who && <span className="who">{who}</span>}
          </div>
          {note && <div className="actor">{note}</div>}
        </span>
        <span className="t">+{tsec(e.at - applicant.createdAt)}</span>
      </li>,
    )
  }
  return (
    <ol className="timeline" aria-label="Trace">
      {out}
      {rows.length === 0 && <li className="muted">No events yet.</li>}
    </ol>
  )
}

/** Evidence document: sans headings, serif body, Method key/value header, reason codes as Label: value bullets. */
function NoticeTab({ applicant, bundle, notice, declined, offers, decision, checks }: { applicant: Applicant; bundle: Bundle | undefined; notice: Notice | undefined; declined: Offer[]; offers: Offer[]; decision: Decision | undefined; checks: ReasonCheck[] }) {
  const [reviewed, setReviewed] = useState(false)
  const [copied, setCopied] = useState(false)
  const req = notice?.required != null ? { required: notice.required, why: notice.requiredBecause ?? '' } : noticeRequired(offers, decision)
  const total = declined.reduce((n, o) => n + o.reasons.length, 0)
  const verified = declined.reduce((n, o) => n + verifiedReasons(checks, o).length, 0)
  const requiredLine = (
    <div className="notice-req">
      <span className="label">Notice required</span>
      <span>
        <b className={req.required ? 'tone-decline' : 'tone-approve'}>{req.required ? 'Yes' : 'No'}</b> <span className="muted">({req.why})</span>
      </span>
    </div>
  )
  if (!notice) {
    return (
      <>
        {requiredLine}
        <div className="muted">
          {applicant.status === 'compliance'
            ? 'Compliance agent is waiting for the counterfactual tests, then writing the notice…'
            : !req.required
              ? 'No adverse-action notice is required for this file.'
              : 'Notice not written yet.'}
        </div>
      </>
    )
  }
  const paras = notice.text.split(/\n\n+/)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(notice.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  return (
    <>
      {requiredLine}
      <article className="doc" aria-label="Adverse action notice">
        <h1 id="n-decision">Notice of adverse action</h1>
        <span className="dateline">
          {new Date(notice.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · {reviewed ? 'reviewed' : 'draft'}
        </span>
        <div className="toc">
          <button type="button" onClick={() => jump('n-decision')}>
            Decision
          </button>
          <button type="button" onClick={() => jump('n-reasons')}>
            Principal reasons
          </button>
          <button type="button" onClick={() => jump('n-rights')}>
            Your rights
          </button>
        </div>
        <div className="kv">
          <span className="k">Applicant</span>
          <span className="v">{applicant.name}</span>
          <span className="k">Application</span>
          <span className="v">
            <span className="mono">{applicant._id}</span>
          </span>
          <span className="k">Report</span>
          <span className="v">
            {bundle?.source ?? 'mock'} · {bundle ? clock(bundle.pulledAt) : '—'}
          </span>
          <span className="k">Decision</span>
          <span className="v">
            <span className="state" style={{ ['--state' as string]: 'var(--doc-bad)' }}>
              {notice.lendersDeclined.length} of {offers.length} lenders
            </span>
          </span>
        </div>
        {paras.slice(0, -1).map((t, i) => (
          <p key={i} className="para" style={{ animationDelay: `${i * 120}ms` }}>
            {t}
          </p>
        ))}
        <h2 id="n-reasons">Principal reasons</h2>
        {declined.map((o) => {
          const v = verifiedReasons(checks, o)
          return (
            <div key={o._id}>
              <p className="muted">{LENDERS.find((l) => l.id === o.lender)?.name}</p>
              {v.length === 0 ? (
                <p className="muted">No reason on this decline survived the counterfactual test.</p>
              ) : (
                <ul>
                  {v.map((r, i) => {
                    const [lbl, ...rest] = r.text.split(/(?<=^[^:]{3,60}?)(?=\s(?:of|is|exceeds|in|on|shows|are))/)
                    return (
                      <li key={i}>
                        <span className="lbl">{lbl.trim()}</span>
                        {rest.length ? ':' : ''} {rest.join('').trim()}
                        <span className="code">{r.field}</span>
                        <span className="ok">verified</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
        <h2 id="n-rights">Your rights</h2>
        <p className="para">{paras[paras.length - 1]}</p>
        <div className="sig">
          {verified} of {total} reasons verified by counterfactual test · generated by the compliance agent · ECOA §1002.9, FCRA §615 · a loan officer reviews every notice before it is sent.
        </div>
        <div className="actions">
          <button type="button" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" onClick={() => setReviewed((r) => !r)} aria-pressed={reviewed}>
            {reviewed ? 'Reviewed' : 'Mark reviewed'}
          </button>
        </div>
      </article>
    </>
  )
}
