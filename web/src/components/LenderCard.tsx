// Lender decision card (full mode): name + policy, status pill, 2x3 fact grid, then every reason with its test result.
import type { Lender, Offer, ReasonCheck } from '../types'
import { LENDERS } from '../types'
import { monthlyPayment, usd } from '../lib/format'
import { offerWord } from '../lib/status'
import { checkFor, type CheckState } from '../lib/select'
import { CheckIcon } from './Logo'

interface Props {
  lender: Lender
  offer: Offer
  checks: ReasonCheck[]
  bestApr: number | null
  selected: boolean
  chosen: boolean
  dim: boolean
  selectable: boolean
  changed?: { apr?: boolean; amount?: boolean; term?: boolean; decision?: boolean }
  onSelect: () => void
  onTrace: () => void
  onCollapse?: () => void
}

const STATE: Record<CheckState, { word: string; cls: string }> = {
  verified: { word: 'Verified', cls: 'ok' },
  unsupported: { word: 'Unsupported', cls: 'bad' },
  pending: { word: 'Testing', cls: 'none' },
  none: { word: 'Untested', cls: 'none' },
}

function Icon({ state }: { state: CheckState }) {
  const cls = STATE[state].cls
  return (
    <span className={`ax-ico ${cls}`} aria-hidden="true">
      {cls === 'ok' ? (
        <CheckIcon size={14} />
      ) : cls === 'bad' ? (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square"><path d="M4 4l8 8M12 4l-8 8" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square"><path d="M4 8h8" /></svg>
      )}
    </span>
  )
}

export function LenderCard({ lender, offer, checks, bestApr, selected, chosen, dim, selectable, changed = {}, onSelect, onTrace, onCollapse }: Props) {
  const meta = LENDERS.find((l) => l.id === lender)!
  const { word, tone } = offerWord(offer)
  const approve = offer.status === 'done' && offer.decision === 'approve'
  const pay = approve ? monthlyPayment(offer.amount, offer.apr, offer.termMonths) : null
  const isBest = approve && bestApr != null && offer.apr === bestApr
  const dash = '—'
  const facts: Array<[string, string, boolean | undefined]> = [
    ['APR', approve && offer.apr != null ? `${offer.apr.toFixed(2)}%` : dash, changed.apr],
    ['Monthly payment', pay != null ? usd(pay, 2) : dash, undefined],
    ['Term', approve && offer.termMonths != null ? `${offer.termMonths} mo` : dash, changed.term],
    ['Amount', approve ? usd(offer.amount) : dash, changed.amount],
    ['Latency', offer.latencyMs != null ? `${offer.latencyMs.toLocaleString('en-US')} ms` : dash, undefined],
    ['Provider', offer.provider, undefined],
  ]
  return (
    <div
      className={`ax-lc tone-${tone} ${isBest ? 'best' : ''} ${selected ? 'sel' : ''} ${chosen ? 'chosen' : ''} ${dim ? 'dim' : ''} ${selectable ? 'selectable' : ''}`}
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-pressed={selectable ? selected : undefined}
      onClick={selectable ? onSelect : undefined}
      onKeyDown={(e) => {
        if (selectable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <header className="ax-lc-head">
        <div className="ax-lc-title">
          <h4>{meta.name}</h4>
          <span>
            {meta.label} · {meta.policy} policy
          </span>
        </div>
        <span className="ax-lc-pills">
          {isBest && <span className="ax-pill ink">Best APR</span>}
          {chosen && <span className="ax-pill ink">Chosen</span>}
          <span className={`ax-pill status-${tone} ${changed.decision ? 'changed' : ''}`}>{word.toUpperCase()}</span>
        </span>
      </header>
      <div className="ax-lc-body">
        <dl className="ax-grid">
          {facts.map(([k, v, ch]) => (
            <div key={k} className={ch ? 'changed' : ''}>
              <dt>{k}</dt>
              <dd className={k === 'APR' ? 'big' : ''}>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="ax-reasons">
          <div className="ax-label">
            {approve ? 'Basis' : 'Reasons'} ({offer.reasons.length})
          </div>
          {offer.conditions.length > 0 && (
            <p className="ax-cond">
              <b>Conditions:</b> {offer.conditions.join('; ')}
            </p>
          )}
          <ul>
            {offer.reasons.map((r, i) => {
              const st = checkFor(checks, offer, r.field).state
              return (
                <li key={i}>
                  <Icon state={st} />
                  <div>
                    <p>{r.text}</p>
                    <span className="ax-chiprow">
                      <span className="ax-chip">{r.field}</span>
                      <span className={`ax-state ${STATE[st].cls}`}>{STATE[st].word}</span>
                    </span>
                  </div>
                </li>
              )
            })}
            {offer.reasons.length === 0 && <li className="ax-none">No reasons recorded.</li>}
          </ul>
        </div>
      </div>
      <footer className="ax-lc-foot">
        {onCollapse && (
          <button type="button" className="link" onClick={(e) => { e.stopPropagation(); onCollapse() }}>
            Less
          </button>
        )}
        <button type="button" className="link" onClick={(e) => { e.stopPropagation(); onTrace() }}>
          Trace
        </button>
      </footer>
    </div>
  )
}
