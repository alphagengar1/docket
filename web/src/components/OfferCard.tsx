import { LENDERS, type Lender, type Offer, type ReasonCheck } from '../types'
import { monthlyPayment, secs, totalInterest, usd } from '../lib/format'
import { offerWord } from '../lib/status'
import { useCountUp } from '../hooks/useNow'
import { ReasonList } from './ReasonList'

interface Props {
  lender: Lender
  offer: Offer | undefined
  checks: ReasonCheck[]
  underwriteStartedAt: number | null
  now: number
  selected: boolean
  chosen: boolean
  dim: boolean
  canSelect: boolean
  onSelect: () => void
  onTrace: () => void
  /** The matching offer from the original run, when this card belongs to a dispute replay. */
  before?: Offer
}

export function OfferCard({ lender, offer, checks, underwriteStartedAt, now, selected, chosen, dim, canSelect, onSelect, onTrace, before }: Props) {
  const meta = LENDERS.find((l) => l.id === lender)!
  const approve = offer?.status === 'done' && offer.decision === 'approve'
  const apr = useCountUp(approve ? offer!.apr : null)

  if (!offer || offer.status === 'pending') {
    const since = offer?.createdAt ?? underwriteStartedAt
    return (
      <div className="card skeleton" aria-busy="true" aria-label={`${meta.label}: reviewing`}>
        <div className="card-head">
          <span className="lender">
            {meta.label}
            <span className="policy">{meta.name}</span>
          </span>
          <span className={`status ${since ? 'live tone-accent' : 'tone-muted'}`}>{since ? 'Quoting' : 'Waiting'}</span>
        </div>
        <div className="hero mono">
          <span className="skel" style={{ width: 84, height: 28 }} />
        </div>
        <div className="hero-sub mono">{since ? 'Reviewing…' : 'Not started'}</div>
        <dl className="kv">
          <dt>Amount</dt>
          <dd>
            <span className="skel" style={{ width: 60, height: 12 }} />
          </dd>
          <dt>Conditions</dt>
          <dd>
            <span className="skel" style={{ width: 100, height: 12 }} />
          </dd>
        </dl>
        <div className="card-foot">
          <span className="mono">{since ? secs(now - since, 1) : ''}</span>
          <span className="tag">{offer?.provider ?? 'claude'}</span>
        </div>
      </div>
    )
  }

  const { word, tone } = offerWord(offer)
  const pay = monthlyPayment(offer.amount, offer.apr, offer.termMonths)
  const interest = totalInterest(offer.amount, offer.apr, offer.termMonths)
  const selectable = canSelect && approve
  const changed = (k: 'decision' | 'apr' | 'amount' | 'termMonths' | 'classification') => !!before && before.status === 'done' && before[k] !== offer[k]

  const handleKey = (e: React.KeyboardEvent) => {
    if (!selectable) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect()
    }
  }

  return (
    <div
      className={`card arrive ${selectable ? 'selectable' : ''} ${chosen ? 'chosen' : ''} ${dim ? 'dim' : ''}`}
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-pressed={selectable ? selected : undefined}
      onClick={selectable ? onSelect : undefined}
      onKeyDown={handleKey}
    >
      <div className="card-head">
        <span className="lender">
          {meta.label}
          <span className="policy">{meta.name}</span>
        </span>
        <span className={`status tone-${tone} ${changed('decision') || changed('classification') ? 'changed' : ''}`}>{word}</span>
      </div>

      {approve ? (
        <>
          <div className={`hero mono ${changed('apr') ? 'changed' : ''}`} aria-label={`APR ${offer.apr}%`}>
            {(apr ?? 0).toFixed(2)}
            <span className="suffix">%</span>
            <span className="suffix" style={{ fontSize: 'var(--fs-label)', marginLeft: 6 }}>
              APR
            </span>
          </div>
          <div className="hero-sub mono">
            {usd(pay)} / mo · <span className={changed('termMonths') ? 'changed' : ''}>{offer.termMonths} mo</span>
          </div>
        </>
      ) : (
        <div className="hero declined">
          <span>
            <span className="mono code">{offer.reasons[0]?.field ?? 'policy'}</span>
            <br />
            {offer.reasons[0]?.text ?? 'Declined by policy.'}
          </span>
        </div>
      )}

      <dl className="kv">
        <dt>Amount</dt>
        <dd className={`mono ${changed('amount') ? 'changed' : ''}`}>{approve ? usd(offer.amount) : '—'}</dd>
        <dt>Total interest</dt>
        <dd className="mono">{approve ? usd(interest) : '—'}</dd>
        <dt>Market anchor</dt>
        <dd className="mono">
          {offer.marketAnchor ? `${offer.marketAnchor.tier} · ${offer.marketAnchor.aprLow}–${offer.marketAnchor.aprHigh}%` : '—'}
        </dd>
      </dl>

      {offer.conditions.length > 0 && (
        <div className="block">
          <span className="label">Conditions</span>
          <ul className="conds">
            {offer.conditions.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="block">
        <span className="label">{approve ? 'Basis' : `Reasons · ${offer.reasons.length} · counterfactual test`}</span>
        <ReasonList offer={offer} checks={checks} />
      </div>

      <div className="card-foot">
        <span className="mono">{secs(offer.latencyMs, 1)}</span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="tag">{offer.provider}</span>
          <button
            type="button"
            className="link"
            onClick={(e) => {
              e.stopPropagation()
              onTrace()
            }}
          >
            Trace
          </button>
        </span>
      </div>
    </div>
  )
}

/** Compact "before" card for the dispute diff: header, hero, reason count. */
export function BeforeCard({ lender, offer }: { lender: Lender; offer: Offer | undefined }) {
  const meta = LENDERS.find((l) => l.id === lender)!
  if (!offer || offer.status !== 'done') {
    return (
      <div className="card before">
        <div className="card-head">
          <span className="lender">{meta.label}</span>
          <span className="status tone-muted">No record</span>
        </div>
      </div>
    )
  }
  const { word, tone } = offerWord(offer)
  const approve = offer.decision === 'approve'
  return (
    <div className="card before" aria-label={`${meta.label} before dispute`}>
      <div className="card-head">
        <span className="lender">
          {meta.label}
          <span className="policy">Before dispute</span>
        </span>
        <span className={`status tone-${tone}`}>{word}</span>
      </div>
      {approve ? (
        <div className="hero mono" style={{ fontSize: 'var(--fs-big)' }}>
          {offer.apr?.toFixed(2)}
          <span className="suffix">%</span>
          <span className="hero-sub" style={{ marginLeft: 8 }}>
            {usd(monthlyPayment(offer.amount, offer.apr, offer.termMonths))} / mo · {offer.termMonths} mo · {usd(offer.amount)}
          </span>
        </div>
      ) : (
        <div className="hero declined">
          <span className="mono code">{offer.reasons.map((r) => r.field).join(' · ')}</span>
        </div>
      )}
    </div>
  )
}
