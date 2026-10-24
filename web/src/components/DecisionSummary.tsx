// Decision Summary: the card that answers "what happened and what do I do" before any lender detail.
import type { Applicant, AuditEvent, Offer } from '../types'
import { summarize } from '../lib/summary'
import { STATUS_WORD } from '../lib/status'
import { usd } from '../lib/format'

interface Props {
  applicant: Applicant
  offers: Offer[]
  hardStop: AuditEvent | undefined
  canDecide: boolean
  onApprove: (offerId: string) => void
  onDecline: () => void
}

export function DecisionSummary({ applicant: a, offers, hardStop, canDecide, onApprove, onDecline }: Props) {
  const s = summarize(a, offers, hardStop)
  const hard = s.kind === 'hard'
  return (
    <section className={`ax-sum ${hard ? 'hard' : s.kind}`} aria-label="Decision summary">
      <div className="ax-sum-top">
        <span className="ax-label">Decision summary</span>
        <span className="ax-pill ink">{STATUS_WORD[a.status]}</span>
        {!hard && (
          <span className="ax-counts">
            <span className="ax-pill outline">{s.declined} declined</span>
            <span className="ax-pill outline">{s.offered} {s.offered === 1 ? 'offer' : 'offers'}</span>
            <span className="ax-pill outline">{s.counter} {s.counter === 1 ? 'counteroffer' : 'counteroffers'}</span>
          </span>
        )}
      </div>
      <div className="ax-sum-main">
        <h3 className="ax-headline">{s.headline}</h3>
        {canDecide && (
          <div className="ax-sum-actions">
            <button type="button" className="ax-btn primary" disabled={!s.best} onClick={() => s.best && onApprove(s.best._id)} title="Shortcut: A">
              Approve best offer
            </button>
            <button type="button" className="ax-btn" onClick={onDecline} title="Shortcut: X">
              Decline
            </button>
          </div>
        )}
      </div>
      {hard ? (
        <div className="ax-rule hard">
          <span className="ax-label">Stop reason</span>
          <div>
            <p className="ax-rule-text">{s.stopReason}</p>
            <p className="ax-rule-meta">Stopped before any lender was asked. No offers, no notice.</p>
          </div>
        </div>
      ) : (
        s.rule && (
          <div className="ax-rule">
            <span className="ax-label">Deciding rule</span>
            <div>
              <p className="ax-rule-text">
                <span className="ax-chip">{s.rule.label}</span>
                {s.rule.text}
              </p>
              <p className="ax-rule-meta">
                Cited by {s.rule.cited} of {s.rule.of} declining lenders: {s.rule.lenders.join(', ')}
              </p>
            </div>
          </div>
        )
      )}
      <p className="ax-assure">
        A human approves every offer. Every denial carries at least two reasons.
        {s.best && canDecide && (
          <span className="ax-assure-best">
            {' '}Best on the table: {usd(s.best.amount)} over {s.best.termMonths} months.
          </span>
        )}
      </p>
    </section>
  )
}
