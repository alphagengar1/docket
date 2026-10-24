// Decision sheet: the decide step only. The desk behind it already shows every lender card, so the
// sheet carries just the verdict, the offers you can pick between and the one rule behind the
// declines. Left/right arrows walk the queue; Esc closes.
import { useEffect } from 'react'
import type { Applicant, AuditEvent, Decision, Notice, Offer, ReasonCheck } from '../types'
import { LENDERS } from '../types'
import { usd } from '../lib/format'
import { hardStopEvent } from '../lib/select'
import { summarize } from '../lib/summary'
import { Verdict } from './Verdict'

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
  stopNote?: string
}

export function DecisionSheet(p: Props) {
  const { applicant: a, offers } = p
  const hs = a.status === 'hard_stop' ? hardStopEvent(p.events) : undefined
  const s = summarize(a, offers, hs)
  const canDecide = a.status === 'awaiting_human'
  const yes = offers.filter((o) => o.status === 'done' && o.decision === 'approve' && o.apr != null).sort((x, y) => x.apr! - y.apr!)
  const pick = yes.find((o) => o._id === p.selectedOfferId) ?? s.best

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

  return (
    <div className="scrim sheet-scrim" onClick={p.onClose}>
      <div className="sheet sheet-slim" role="dialog" aria-modal="true" aria-label={`Decision: ${a.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-nav">
          <button type="button" className="ghost" onClick={p.onPrev} aria-label="Previous applicant" title="← previous">←</button>
          <span className="mono muted">{p.position.index + 1} / {p.position.total}</span>
          <button type="button" className="ghost" onClick={p.onNext} aria-label="Next applicant" title="→ next">→</button>
          <span className="sheet-id">
            <button type="button" className="link" onClick={() => p.onInspect('trace')}>Trace</button>
            {p.notice && <button type="button" className="link" onClick={() => p.onInspect('notice')}>Notice</button>}
          </span>
          <button type="button" className="ghost" onClick={p.onClose} aria-label="Close">Esc</button>
        </div>

        <header className="sheet-head">
          <h2 className="disp">{a.name}</h2>
          <span className="muted">{a.purpose} · <span className="mono">{usd(a.amountRequested)}</span></span>
        </header>

        <Verdict
          applicant={a}
          offers={offers}
          decision={p.decision}
          hardStop={hs}
          canDecide={canDecide}
          pick={pick}
          onApprove={p.onApprove}
          onDecline={p.onDecline}
          size="sheet"
          stopNote={p.stopNote}
        />

        {canDecide && yes.length > 1 && (
          <div className="pick" role="radiogroup" aria-label="Offer to approve">
            {yes.map((o) => (
              <button
                key={o._id}
                type="button"
                role="radio"
                aria-checked={pick?._id === o._id}
                className={`pick-row ${pick?._id === o._id ? 'on' : ''}`}
                onClick={() => p.onSelectOffer(o._id)}
              >
                <span className="pick-name">{LENDERS.find((l) => l.id === o.lender)?.name}</span>
                <span className="pick-apr mono">{o.apr!.toFixed(2)}%</span>
                <span className="pick-terms mono muted">{o.monthlyPayment != null ? `${usd(o.monthlyPayment)}/mo · ` : ''}{o.termMonths} mo</span>
              </button>
            ))}
          </div>
        )}

        {s.rule && a.status !== 'hard_stop' && (
          <p className="sheet-why">
            <span className="mono muted">Why {s.rule.cited === 1 ? 'one lender' : `${s.rule.cited} lenders`} said no</span> {s.rule.text}
          </p>
        )}
      </div>
    </div>
  )
}
