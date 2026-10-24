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
  /** Lowest APR among this applicant's approvals, for the Fey delta pill. */
  bestApr: number | null
  /** The matching offer from the original run, when this card belongs to a dispute replay. */
  before?: Offer
}

/** Fey number: integer part full, fractional part dimmed. */
export function Num({ value, digits = 2, prefix = '', suffix = '' }: { value: number; digits?: number; prefix?: string; suffix?: string }) {
  const s = value.toFixed(digits)
  const [int, frac] = s.split('.')
  return (
    <span className="num">
      {prefix}
      {Number(int).toLocaleString('en-US')}
      {frac != null && <span className="frac">.{frac}</span>}
      {suffix}
    </span>
  )
}

export function OfferCard({ lender, offer, checks, underwriteStartedAt, now, selected, chosen, dim, canSelect, onSelect, onTrace, bestApr, before }: Props) {
  const meta = LENDERS.find((l) => l.id === lender)!
  const approve = offer?.status === 'done' && offer.decision === 'approve'
  const apr = useCountUp(approve ? offer!.apr : null)

  if (!offer || offer.status === 'pending') {
    const since = offer?.createdAt ?? underwriteStartedAt
    return (
      <div className="card skeleton" aria-busy="true" aria-label={`${meta.label}: reviewing`}>
        <div className="card-head">
          <span className="lender">{meta.name}</span>
          <span className={`pill ${since ? 'live' : ''}`}>{since ? 'Quoting' : 'Waiting'}</span>
        </div>
        <div className="hero mono">
          <span className="skel" style={{ width: 96, height: 24 }} />
        </div>
        <div className="hero-sub mono">{since ? 'Reviewing…' : 'Not started'}</div>
        <dl className="rows">
          <dt>Monthly</dt>
          <dd>
            <span className="skel" style={{ width: 56, height: 12 }} />
          </dd>
          <dt>Term</dt>
          <dd>
            <span className="skel" style={{ width: 40, height: 12 }} />
          </dd>
          <dt>Amount</dt>
          <dd>
            <span className="skel" style={{ width: 64, height: 12 }} />
          </dd>
        </dl>
        <div className="card-foot">
          <span className="chips">
            <span className="chip">{since ? secs(now - since, 1) : '—'}</span>
            <span className="chip">{offer?.provider ?? 'claude'}</span>
          </span>
        </div>
      </div>
    )
  }

  const { word, tone } = offerWord(offer)
  const pay = monthlyPayment(offer.amount, offer.apr, offer.termMonths)
  const interest = totalInterest(offer.amount, offer.apr, offer.termMonths)
  const selectable = canSelect && approve
  const changed = (k: 'decision' | 'apr' | 'amount' | 'termMonths' | 'classification') => !!before && before.status === 'done' && before[k] !== offer[k]
  const delta = approve && bestApr != null && offer.apr != null ? offer.apr - bestApr : null

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
        <span className="lender">{meta.name}</span>
        <span className={`pill ${tone} ${changed('decision') || changed('classification') ? 'changed' : ''}`}>{word}</span>
      </div>

      {approve ? (
        <>
          <div className={`hero mono ${changed('apr') ? 'changed' : ''}`} aria-label={`APR ${offer.apr}%`}>
            <Num value={apr ?? 0} />
            <span className="suffix">% APR</span>
            {delta != null && (
              <span className={`pill delta ${delta === 0 ? 'approve' : 'hard'}`}>{delta === 0 ? 'Best rate' : `+${delta.toFixed(2)}%`}</span>
            )}
          </div>
          <div className="hero-sub mono">
            {usd(pay)} / mo · <span className={changed('termMonths') ? 'changed' : ''}>{offer.termMonths} mo</span>
            {offer.classification === 'counteroffer' && <span className="tone-decline"> · different from requested</span>}
          </div>
        </>
      ) : (
        <div className="hero declined">
          <span>
            <span className="mono code">{offer.reasons[0]?.field ?? 'policy'}</span>
            {offer.reasons[0]?.text ?? 'Declined by policy.'}
          </span>
        </div>
      )}

      <dl className="rows">
        <dt>Amount</dt>
        <dd className={`primary ${changed('amount') ? 'changed' : ''}`}>{approve && offer.amount != null ? <Num value={offer.amount} digits={0} prefix="$" /> : '—'}</dd>
        <dt>Monthly</dt>
        <dd>{approve && pay != null ? <Num value={pay} prefix="$" /> : '—'}</dd>
        <dt>Total interest</dt>
        <dd>{approve && interest != null ? <Num value={interest} prefix="$" /> : '—'}</dd>
        <dt title="Market APR range for this credit tier">Anchor{offer.marketAnchor ? ` · ${offer.marketAnchor.tier}` : ''}</dt>
        <dd>{offer.marketAnchor ? `${offer.marketAnchor.aprLow}–${offer.marketAnchor.aprHigh}%` : '—'}</dd>
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
        <span className="chips">
          <span className="chip">{secs(offer.latencyMs, 2)}</span>
          <span className="chip">{offer.provider}</span>
          <span className="chip">{offer.reasons.length} reasons</span>
        </span>
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
      </div>
    </div>
  )
}

/** Compact "before" card for the dispute diff: header, hero, reason fields. */
export function BeforeCard({ lender, offer }: { lender: Lender; offer: Offer | undefined }) {
  const meta = LENDERS.find((l) => l.id === lender)!
  if (!offer || offer.status !== 'done') {
    return (
      <div className="card before">
        <div className="card-head">
          <span className="lender">{meta.name}</span>
          <span className="pill">No record</span>
        </div>
      </div>
    )
  }
  const { word, tone } = offerWord(offer)
  const approve = offer.decision === 'approve'
  return (
    <div className="card before" aria-label={`${meta.label} before dispute`}>
      <div className="card-head">
        <span className="lender">{meta.name}</span>
        <span className={`pill ${tone}`}>{word}</span>
      </div>
      {approve ? (
        <>
          <div className="hero mono" style={{ fontSize: 'var(--fs-big)' }}>
            <Num value={offer.apr ?? 0} />
            <span className="suffix">% APR</span>
          </div>
          <div className="hero-sub mono">
            {usd(monthlyPayment(offer.amount, offer.apr, offer.termMonths))} / mo · {offer.termMonths} mo · {usd(offer.amount)}
          </div>
        </>
      ) : (
        <div className="hero declined">
          <span className="mono code">{offer.reasons.map((r) => r.field).join(' · ')}</span>
        </div>
      )}
    </div>
  )
}
