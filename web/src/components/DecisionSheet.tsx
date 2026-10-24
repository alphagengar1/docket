// Decision sheet: one applicant in focus over a blurred desk. Key points first, then the three
// lender cards, then the actions. Left/right arrows walk the queue; Esc closes.
import { useEffect } from 'react'
import type { Applicant, AuditEvent, Decision, Notice, Offer, ReasonCheck } from '../types'
import { LENDERS } from '../types'
import { secs, usd } from '../lib/format'
import { IN_FLIGHT, STATUS_TONE, STATUS_WORD, offerWord } from '../lib/status'
import { hardStopEvent, verifiedReasons } from '../lib/select'
import { fieldLabel } from '../../../convex/labels'
import { OfferCard } from './OfferCard'
import { HardStopCard } from './HardStopCard'

interface Props {
  applicant: Applicant
  offers: Offer[]
  checks: ReasonCheck[]
  events: AuditEvent[]
  notice: Notice | undefined
  decision: Decision | undefined
  now: number
  underwriteStartedAt: number | null
  position: { index: number; total: number }
  selectedOfferId: string | null
  onSelectOffer: (id: string) => void
  onPrev: () => void
  onNext: () => void
  onClose: () => void
  onApprove: (offerId: string) => void
  onDecline: () => void
  onInspect: (tab: 'offer' | 'trace' | 'notice') => void
}

function bestOf(offers: Offer[]): Offer | null {
  return (
    offers
      .filter((o) => o.status === 'done' && o.decision === 'approve' && o.apr != null)
      .sort((a, b) => a.apr! - b.apr!)[0] ?? null
  )
}

export function DecisionSheet(p: Props) {
  const { applicant: a, offers, checks } = p
  const best = bestOf(offers)
  const chosen = p.decision?.chosenOfferId ? offers.find((o) => o._id === p.decision!.chosenOfferId) : undefined
  const hard = a.status === 'hard_stop'
  const hs = hard ? hardStopEvent(p.events) : undefined
  const running = IN_FLIGHT.includes(a.status)
  const canDecide = a.status === 'awaiting_human'
  const done = offers.filter((o) => o.status === 'done')
  const approvals = done.filter((o) => o.decision === 'approve').length
  const declines = done.filter((o) => o.decision === 'decline')
  const reasonsTotal = declines.reduce((n, o) => n + o.reasons.length, 0)
  const reasonsVerified = declines.reduce((n, o) => n + verifiedReasons(checks, o).length, 0)
  const sel = offers.find((o) => o._id === p.selectedOfferId && o.decision === 'approve') ?? best

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if (e.key === 'Escape') p.onClose()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); p.onPrev() }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); p.onNext() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const headline = hard
    ? 'Hard stop'
    : chosen
      ? `Approved · ${LENDERS.find((l) => l.id === chosen.lender)?.label} · ${chosen.apr?.toFixed(2)}%`
      : a.status === 'declined'
        ? 'Declined'
        : running
          ? 'Lenders are reading the file'
          : best
            ? `Best offer · ${LENDERS.find((l) => l.id === best.lender)?.label} · ${best.apr!.toFixed(2)}%`
            : 'No lender will offer'
  const sub = hard
    ? (hs?.note ?? 'A deterministic rule stopped the file before any lender saw it.')
    : running
      ? STATUS_WORD[a.status]
      : best
        ? `${usd(best.amount)} over ${best.termMonths} months · ${approvals} of ${done.length} lenders said yes`
        : `${declines.length} of ${done.length} lenders declined · ${reasonsVerified} of ${reasonsTotal} reasons verified by counterfactual test`

  return (
    <div className="scrim sheet-scrim" onClick={p.onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Decision: ${a.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-nav">
          <button type="button" className="ghost" onClick={p.onPrev} aria-label="Previous applicant" title="← previous">
            ←
          </button>
          <span className="mono muted">
            {p.position.index + 1} / {p.position.total}
          </span>
          <button type="button" className="ghost" onClick={p.onNext} aria-label="Next applicant" title="→ next">
            →
          </button>
          <span className="sheet-id mono muted">
            {a.personaId} · {a._id.slice(0, 7)}
          </span>
          <button type="button" className="ghost" onClick={p.onClose} aria-label="Close">
            Esc
          </button>
        </div>

        <header className="sheet-head">
          <h2 className="disp">{a.name}</h2>
          <span className={`status tone-${STATUS_TONE[a.status]} ${running ? 'live' : ''}`}>{STATUS_WORD[a.status]}</span>
          <span className="muted">
            {a.purpose} · <span className="mono">{usd(a.amountRequested)}</span> · income <span className="mono">{usd(a.statedIncome)}</span>
          </span>
        </header>

        <section className={`sheet-key ${hard ? 'hard' : best || chosen ? 'good' : running ? '' : 'bad'}`} aria-label="Key points">
          <div className="headline">{headline}</div>
          <div className="sub">{sub}</div>
          <div className="verdicts">
            {LENDERS.map((l) => {
              const o = offers.find((x) => x.lender === l.id)
              const w = o ? offerWord(o) : { word: hard ? 'Skipped' : 'Waiting', tone: 'muted' as const }
              const top = o?.decision === 'decline' ? (verifiedReasons(checks, o)[0] ?? o.reasons[0]) : undefined
              return (
                <div key={l.id} className={`verdict tone-${w.tone}`}>
                  <span className="lbl">{l.label}</span>
                  <span className="word">
                    {w.word}
                    {o?.decision === 'approve' && o.apr != null ? ` ${o.apr.toFixed(2)}%` : ''}
                  </span>
                  <span className="why">{top ? `${fieldLabel(top.field)}: ${top.text}` : o?.decision === 'approve' ? `${usd(o.amount)} · ${o.termMonths} mo` : ''}</span>
                </div>
              )
            })}
          </div>
        </section>

        <div className="sheet-cards">
          {hard ? (
            <HardStopCard event={hs} />
          ) : (
            LENDERS.map((l) => {
              const o = offers.find((x) => x.lender === l.id)
              return (
                <OfferCard
                  key={l.id}
                  lender={l.id}
                  offer={o}
                  checks={checks}
                  bestApr={best?.apr ?? null}
                  underwriteStartedAt={p.underwriteStartedAt}
                  now={p.now}
                  selected={!!o && !!sel && o._id === sel._id && canDecide}
                  chosen={!!chosen && o?._id === chosen._id}
                  dim={!!chosen && o?._id !== chosen._id}
                  canSelect={canDecide}
                  onSelect={() => o && p.onSelectOffer(o._id)}
                  onTrace={() => p.onInspect('trace')}
                />
              )
            })
          )}
        </div>

        <footer className="sheet-foot">
          <span className="muted mono">
            {p.notice ? 'notice drafted' : 'no notice'} · {secs(p.now - a.createdAt, 0)} on the desk
          </span>
          <span className="sheet-actions">
            <button type="button" className="ghost" onClick={() => p.onInspect('trace')}>
              Trace
            </button>
            <button type="button" className="ghost" onClick={() => p.onInspect('notice')}>
              Notice
            </button>
            {canDecide && (
              <>
                <button type="button" className="decline-pill" onClick={p.onDecline}>
                  Decline
                </button>
                <button type="button" className="approve-pill" disabled={!sel} onClick={() => sel && p.onApprove(sel._id)}>
                  {sel ? `Approve ${LENDERS.find((l) => l.id === sel.lender)?.label} at ${sel.apr!.toFixed(2)}%` : 'No offer to approve'}
                </button>
              </>
            )}
          </span>
        </footer>
      </div>
    </div>
  )
}
