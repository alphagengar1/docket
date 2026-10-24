import { useState } from 'react'
import type { Applicant, AuditEvent, Bundle, Decision, Notice, Offer, ReasonCheck } from '../types'
import { LENDERS } from '../types'
import { clock, monthlyPayment, num, pct, secs, usd } from '../lib/format'
import { STATUS_TONE, STATUS_WORD, IN_FLIGHT } from '../lib/status'
import { noticeRequired, verifiedReasons } from '../lib/select'
import { ReasonList } from './ReasonList'

export type InspectorTab = 'offer' | 'trace' | 'notice'

interface Props {
  applicant: Applicant | undefined
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
  original: Applicant | undefined
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
          <div className="meta">Select an applicant from the queue.</div>
        </div>
        <div className="empty">Credit snapshot, trace and the adverse-action notice appear here.</div>
      </aside>
    )
  }

  return (
    <aside className="pane" aria-label="Inspector">
      <div className="inspector-head">
        <div className="name">
          <span>{applicant.name}</span>
          <span className={`status tone-${STATUS_TONE[applicant.status]} ${IN_FLIGHT.includes(applicant.status) ? 'live' : ''}`}>
            {STATUS_WORD[applicant.status]}
          </span>
        </div>
        <div className="meta">
          <span className="mono">{applicant.personaId}</span> · {applicant.purpose} · <span className="mono">{usd(applicant.amountRequested)}</span> · income{' '}
          <span className="mono">{usd(applicant.statedIncome)}</span>
          {original && (
            <>
              {' '}
              · <span className="tone-accent">replay after dispute</span>
            </>
          )}
        </div>
      </div>

      <StatTiles bundle={bundle} />
      <Tradelines bundle={bundle} canDispute={!!bundle && !IN_FLIGHT.includes(applicant.status) && !applicant.replayOf} onDispute={p.onDispute} />

      <div className="tabs" role="tablist">
        {(['offer', 'trace', 'notice'] as InspectorTab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className="tab" onClick={() => onTab(t)}>
            {t === 'offer' ? 'Offer' : t === 'trace' ? 'Trace' : `Notice${notice ? '' : ' ·'}`}
            {t === 'notice' && !notice && <span className="muted"> none</span>}
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
              <button type="button" disabled={!canDecline || rationale.trim().length < 4} onClick={() => act(() => p.onDecline(rationale.trim()))}>
                Record decline
              </button>
            </>
          ) : (
            <>
              <button type="button" className="ghost" disabled={!canDecline} onClick={() => setDeclining(true)}>
                Decline…
              </button>
              <button type="button" className="primary" disabled={!canApprove} onClick={() => act(p.onApprove)}>
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

function StatTiles({ bundle }: { bundle: Bundle | undefined }) {
  const tiles: Array<{ k: string; v: string; tone?: string }> = bundle
    ? [
        { k: 'FICO 9', v: num(bundle.credit.fico9) },
        { k: 'Vantage 4', v: num(bundle.credit.vantage4) },
        { k: 'Utilization', v: pct(bundle.credit.utilization) },
        { k: 'Inquiries 6mo', v: String(bundle.credit.inquiries6mo) },
        { k: 'Identity', v: bundle.identity.verified ? 'Verified' : 'Failed', tone: bundle.identity.verified ? 'tone-approve' : 'tone-hard' },
        {
          k: 'Fraud score',
          v: num(bundle.fraud.score),
          tone: bundle.fraud.score != null && bundle.fraud.score >= 80 ? 'tone-hard' : bundle.fraud.score != null && bundle.fraud.score >= 40 ? 'tone-decline' : undefined,
        },
      ]
    : [
        { k: 'FICO 9', v: '' },
        { k: 'Vantage 4', v: '' },
        { k: 'Utilization', v: '' },
        { k: 'Inquiries 6mo', v: '' },
        { k: 'Identity', v: '' },
        { k: 'Fraud score', v: '' },
      ]
  return (
    <div className="tiles" aria-label="Credit snapshot" aria-busy={!bundle}>
      {tiles.map((t) => (
        <div key={t.k} className="tile">
          <div className={`v mono ${t.tone ?? ''}`}>{bundle ? t.v : <span className="skel" style={{ width: 44, height: 16 }} />}</div>
          <div className="k">{t.k}</div>
        </div>
      ))}
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
      <button type="button" className="ghost tab" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Tradelines <span className="mono muted">{rows.length}</span> {open ? '' : '· show'}
      </button>
      {open && rows.length > 0 && (
        <table className="grid tl">
          <tbody>
            {rows.map((t, i) => {
              const derog = /dpd|late|collection|chargeoff|bk/.test(t.status)
              return (
                <tr key={i}>
                  <td className="mono muted">[{i}]</td>
                  <td>{t.type.replace('_', ' ')}</td>
                  <td className="mono">{usd(t.balance)}</td>
                  <td className={`mono ${derog ? 'tone-decline' : 'muted'}`}>{t.status}</td>
                  <td className="mono muted">{t.openedAt.slice(0, 7)}</td>
                  <td style={{ textAlign: 'right', paddingRight: 8 }}>
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
      {open && rows.length === 0 && <div className="muted" style={{ padding: '0 12px 8px' }}>No tradelines on file.</div>}
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
          <div className="muted mono" style={{ fontSize: 11 }}>
            {clock(decision.at)}
          </div>
          <div>{decision.note}</div>
        </div>
      )}
      {applicant.status === 'hard_stop' && (
        <div className="muted">Hard stop: no offers exist for this file. See the Trace tab for the triggering field.</div>
      )}
      {!show && applicant.status !== 'hard_stop' && (
        <div className="muted">
          {offers.some((o) => o.decision === 'approve') ? 'Click an offer card on the board to inspect it.' : 'No approvable offer yet.'}
        </div>
      )}
      {show && (
        <>
          <div className="summary">
            <span className="section-label">{LENDERS.find((l) => l.id === show.lender)?.label}</span>
            <span className="big mono">
              {show.apr}% <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>APR</span>
            </span>
            <span className="mono muted">
              {usd(monthlyPayment(show.amount, show.apr, show.termMonths))} / mo · {show.termMonths} mo · {usd(show.amount)}
            </span>
          </div>
          <dl className="kv">
            <dt>Provider</dt>
            <dd className="mono">{show.provider}</dd>
            <dt>Run</dt>
            <dd className="mono">{show.runId ?? '—'}</dd>
            <dt>Latency</dt>
            <dd className="mono">{secs(show.latencyMs, 2)}</dd>
          </dl>
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

function TraceTab({ applicant, events }: { applicant: Applicant; events: AuditEvent[] }) {
  const rows = events.slice().sort((a, b) => a.at - b.at)
  return (
    <ol className="timeline" aria-label="Trace">
      {rows.map((e) => {
        const dot =
          e.action === 'hard_stop' ? 'hard' : e.action.endsWith('approve') || e.action === 'offer.approved' ? 'approve' : e.action.endsWith('decline') || e.action === 'application.declined' ? 'decline' : e.actor === 'human' ? 'human' : ''
        return (
          <li key={e._id}>
            <span className="t mono">+{((e.at - applicant.createdAt) / 1000).toFixed(2)}s</span>
            <span className={`d ${dot}`} />
            <span className="body">
              <div>
                <span className="mono">{e.action}</span>
                {e.ref && <span className="ref mono"> · {e.ref}</span>}
              </div>
              <div className="actor">
                {e.actor} · {e.note}
              </div>
            </span>
          </li>
        )
      })}
      {rows.length === 0 && <li className="muted">No events yet.</li>}
    </ol>
  )
}

function NoticeTab({ applicant, bundle, notice, declined, offers, decision, checks }: { applicant: Applicant; bundle: Bundle | undefined; notice: Notice | undefined; declined: Offer[]; offers: Offer[]; decision: Decision | undefined; checks: ReasonCheck[] }) {
  const [reviewed, setReviewed] = useState(false)
  const [copied, setCopied] = useState(false)
  const req = noticeRequired(offers, decision)
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
  return (
    <>
      {requiredLine}
      <article className="doc" aria-label="Adverse action notice">
        <span className="section-label">Adverse action notice · {reviewed ? 'Reviewed' : 'Draft'}</span>
        {paras.map((t, i) => (
          <p key={i} className="para" style={{ animationDelay: `${i * 120}ms` }}>
            {t}
          </p>
        ))}
        {declined.map((o) => (
          <div className="block" key={o._id}>
            <span className="label">Reason codes · {LENDERS.find((l) => l.id === o.lender)?.name}</span>
            {verifiedReasons(checks, o).length === 0 ? (
              <span className="muted">No reason on this decline survived the counterfactual test.</span>
            ) : (
              <ReasonList offer={o} checks={checks} numbered only={verifiedReasons(checks, o)} />
            )}
          </div>
        ))}
        <div className="prov">
          {verified} of {total} reasons verified by counterfactual test · generated by compliance agent · based on {bundle?.source ?? 'mock'} pull at{' '}
          {bundle ? clock(bundle.pulledAt) : '—'} · {notice.lendersDeclined.join(', ')} · ECOA §1002.9, FCRA §615
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
