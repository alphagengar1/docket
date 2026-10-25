// Lender decisions as a card grid (precision skin; design/ui-preview/docket-live-preview.html).
// Each card is the glance: rate, payment and term for offers, the first reason and its verification
// verdict for declines. "Details" opens the full OfferCard underneath, where an offer can be selected
// for approval and the trace opened, so nothing the row view could do is lost.
import { useState } from 'react'
import type { Applicant, AuditEvent, Offer, ReasonCheck } from '../types'
import { LENDERS } from '../types'
import { summarize, type LenderLine } from '../lib/summary'
import { usd } from '../lib/format'
import { OfferCard } from './OfferCard'
import '../styles/lendergrid.css'

interface Props {
  applicant: Applicant
  offers: Offer[]
  hardStop: AuditEvent | undefined
  checks: ReasonCheck[]
  bestApr: number | null
  underwriteStartedAt: number | null
  now: number
  selectedOfferId: string | null
  chosenOfferId: string | null
  decided: boolean
  canSelect: boolean
  compact: boolean
  onSelect: (offerId: string) => void
  onTrace: () => void
}

type Filter = 'all' | 'offers' | 'declined'
type Sort = 'apr' | 'name'

const isOffer = (l: LenderLine) => l.tone === 'approve'
const isDecline = (l: LenderLine) => l.tone === 'decline'

export function LenderGrid(p: Props) {
  const s = summarize(p.applicant, p.offers, p.hardStop, p.checks)
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('apr')
  const [open, setOpen] = useState<string | null>(null)

  const lines = s.lenders
  const offerN = lines.filter(isOffer).length
  const declineN = lines.filter(isDecline).length
  const answered = lines.filter((l) => l.offer?.status === 'done').length
  const shown = lines
    .filter((l) => filter === 'all' || (filter === 'offers' ? isOffer(l) : isDecline(l)))
    .slice()
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      const ra = isOffer(a) && a.offer?.apr != null ? a.offer.apr : Infinity
      const rb = isOffer(b) && b.offer?.apr != null ? b.offer.apr : Infinity
      return ra - rb || a.name.localeCompare(b.name)
    })
  const openLine = lines.find((l) => l.lender === open)

  return (
    <section className="lgv" aria-label="Lender decisions">
      <div className="lgv-head">
        <div>
          <h2>Lender decisions</h2>
          <p className="mono">
            {lines.length} lenders · {offerN} {offerN === 1 ? 'offer' : 'offers'} · {declineN} declined
          </p>
        </div>
        <span className={`lgv-pill ${answered === lines.length ? 'done' : ''}`}>
          {answered === lines.length ? `All ${lines.length} answered` : `${answered} of ${lines.length} answered`}
        </span>
      </div>

      <div className="lgv-filters">
        <div className="lgv-tabs" role="group" aria-label="Filter lender decisions">
          {([['all', 'All lenders', lines.length], ['offers', 'Offers', offerN], ['declined', 'Declined', declineN]] as const).map(([id, label, n]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label} ({n})
            </button>
          ))}
        </div>
        <label className="lgv-sort mono">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="apr">Lowest APR first</option>
            <option value="name">Lender name</option>
          </select>
        </label>
      </div>

      <div className="lgv-cards">
        {shown.map((l) => {
          const o = l.offer
          const best = !!s.best && o?._id === s.best._id
          const chosen = !!p.chosenOfferId && o?._id === p.chosenOfferId
          const selected = !!o && o._id === p.selectedOfferId
          const done = o?.status === 'done'
          const elapsed = done && o?.latencyMs != null ? `${(o.latencyMs / 1000).toFixed(1)}s review` : !done && p.underwriteStartedAt ? `${((p.now - p.underwriteStartedAt) / 1000).toFixed(0)}s so far` : 'Waiting'
          const meta = LENDERS.find((x) => x.id === l.lender)
          return (
            <article
              key={l.lender}
              className={`lgv-card ${best ? 'best' : ''} ${isDecline(l) ? 'declined' : ''} ${selected ? 'sel' : ''} ${chosen ? 'chosen' : ''} ${p.decided && !chosen ? 'dim' : ''} ${open === l.lender ? 'open' : ''}`}
              aria-label={`${l.name}, ${l.word}`}
            >
              <div className={`lgv-band ${best || chosen ? '' : 'empty'}`} aria-hidden={!best && !chosen}>
                {chosen ? 'Approved by the loan officer' : best ? '↗ Best offer' : ' '}
              </div>
              <div className="lgv-body">
                <div className="lgv-card-head">
                  <div>
                    <h3>{l.name}</h3>
                    <p className="lgv-cat mono">{meta?.label ?? l.label} · {meta?.policy}</p>
                  </div>
                  <span className={`lgv-status ${isOffer(l) ? 'offer' : isDecline(l) ? 'no' : ''}`}>{l.word}</span>
                </div>
                {isOffer(l) && o ? (
                  <>
                    <div className="lgv-rate mono">
                      {o.apr != null ? `${o.apr.toFixed(2)}%` : 'Rate pending'}
                      <small>APR</small>
                    </div>
                    <dl className="lgv-metrics">
                      <div>
                        <dt>Monthly</dt>
                        <dd className="mono">{l.monthly != null ? usd(l.monthly) : '—'}</dd>
                      </div>
                      <div>
                        <dt>Term</dt>
                        <dd className="mono">{o.termMonths != null ? `${o.termMonths} months` : '—'}</dd>
                      </div>
                      <div>
                        <dt>Amount</dt>
                        <dd className="mono">{usd(o.amount)}</dd>
                      </div>
                    </dl>
                    <p className="lgv-note mono">
                      {o.conditions.length} {o.conditions.length === 1 ? 'condition' : 'conditions'} · {l.reasons.length} supporting {l.reasons.length === 1 ? 'reason' : 'reasons'}
                    </p>
                  </>
                ) : isDecline(l) ? (
                  <>
                    <div className="lgv-rate none">No offer issued</div>
                    <div className="lgv-reason">
                      <p>{l.reasons[0]?.text ?? l.sentence}</p>
                      {l.reasons[0]?.verdict && <span className={`lgv-verdict v-${l.reasons[0].verdict.replace(/\s+/g, '-')}`}>{l.reasons[0].verdict}</span>}
                      {l.reasons.length > 1 && <span className="lgv-more mono">+{l.reasons.length - 1} more</span>}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="lgv-rate none">{o?.status === 'failed' ? 'Unavailable' : 'Underwriting…'}</div>
                    <p className="lgv-reason">{l.sentence}</p>
                  </>
                )}
              </div>
              <div className="lgv-foot">
                <span className="mono">{elapsed}</span>
                <button type="button" className="lgv-link" aria-expanded={open === l.lender} onClick={() => setOpen((cur) => (cur === l.lender ? null : l.lender))}>
                  {open === l.lender ? 'Hide details' : 'Details ↗'}
                </button>
              </div>
            </article>
          )
        })}
        {shown.length === 0 && <p className="lgv-empty">No lenders match this filter.</p>}
      </div>

      {openLine && (
        <div className="lgv-detail" aria-label={`${openLine.name} details`}>
          <OfferCard
            lender={openLine.lender}
            offer={openLine.offer}
            checks={p.checks}
            bestApr={p.bestApr}
            underwriteStartedAt={p.underwriteStartedAt}
            now={p.now}
            selected={!!openLine.offer && openLine.offer._id === p.selectedOfferId}
            chosen={!!p.chosenOfferId && openLine.offer?._id === p.chosenOfferId}
            dim={false}
            canSelect={p.canSelect}
            onSelect={() => openLine.offer && p.onSelect(openLine.offer._id)}
            onTrace={p.onTrace}
            compact={p.compact}
            defaultOpen
          />
        </div>
      )}
    </section>
  )
}
