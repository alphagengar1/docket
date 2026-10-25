// Lender decision card (full mode): name + policy, status pill, then one plain-English glance line.
// The 2x3 fact grid, conditions and every reason with its test result open inline through Disclose.
// The card is the selectable approve target, so the disclosure controls stop propagation like Less/Trace.
import type { Decision, Lender, Offer, ReasonCheck } from '../types'
import { LENDERS } from '../types'
import { monthlyPayment, secs, usd } from '../lib/format'
import { offerWord } from '../lib/status'
import { checkFor, noticeRequired, type CheckState } from '../lib/select'
import { CheckIcon } from './Logo'
import { Disclose, DiscloseGroup } from './Disclose'
import { ReasonVerdictRow, plainText, reasonLabel } from './ReasonList'
import '../styles/lendercard.css'

/** What the borrower asked for, so a counteroffer can be read against it. */
export interface Requested {
  amount: number
  termMonths?: number | null
}

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
  /** The borrower's request; enables the requested-vs-offered comparison on a counteroffer. */
  requested?: Requested
  /** Open the fact grid and reasons on mount (e.g. the officer just asked for Details). */
  defaultOpen?: boolean
}

const STATE: Record<CheckState, { word: string; cls: string }> = {
  verified: { word: 'Verified', cls: 'ok' },
  unsupported: { word: 'Unsupported', cls: 'bad' },
  pending: { word: 'Testing', cls: 'none' },
  none: { word: 'Untested', cls: 'none' },
}

/** Short lender names for glance sentences. */
export const SHORT_NAME: Record<Lender, string> = {
  cu: 'Pacific Ridge',
  fintech: 'Northstar',
  prime: 'Meridian Prime',
  regional: 'Cascade Regional',
  subprime: 'Harbor 2nd Chance',
}
export const shortName = (lender: Lender) => SHORT_NAME[lender] ?? lender

/** One-line gloss of each lender's written policy, for the pending card. */
export const POLICY_NOTE: Record<Lender, string> = {
  cu: 'Conservative member-owned lender: requires a TransUnion score, low utilization and no recent derogatories; declines when in doubt.',
  fintech: 'Growth online lender: prices risk instead of avoiding it; accepts thin files on VantageScore as long as fraud and capacity check out.',
  prime: 'Prime desk: lends only to the strongest files (TransUnion score 720 and up) and rewards them with the lowest rates and longest terms.',
  regional: 'Community bank: wants a clean, established file and prices it fairly; borderline files are declined with an invitation to reapply.',
  subprime: 'Small-dollar rebuilding lender: low scores and discharged bankruptcies are its market; it will not lend into open bankruptcy, eviction or a fraud signal.',
}

export function isDiscloseControl(e: { target: EventTarget | null }): boolean {
  const t = e.target as HTMLElement | null
  return !!t?.closest?.('.disclose__row, .disclose-group__toggle')
}

/** Keep the card's click-to-select and Enter/Space-to-select from firing when a disclosure control is used. */
export const discloseGuards = {
  onClick: (e: React.MouseEvent) => {
    if (isDiscloseControl(e)) e.stopPropagation()
  },
  onKeyDown: (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && isDiscloseControl(e)) e.stopPropagation()
  },
}

/** "2 reasons, both verified." / "3 reasons: 2 verified, 1 testing." */
export function verdictTally(offer: Offer, checks: ReasonCheck[]): string {
  const n = offer.reasons.length
  if (n === 0) return 'No reasons recorded.'
  const states = offer.reasons.map((r) => checkFor(checks, offer, r.field).state)
  const noun = `${n} reason${n === 1 ? '' : 's'}`
  if (states.every((s) => s === 'none')) return `${noun}.`
  const v = states.filter((s) => s === 'verified').length
  const u = states.filter((s) => s === 'unsupported').length
  const p = states.filter((s) => s === 'pending').length
  if (p === n) return `${noun}, testing.`
  if (v === n) return `${noun}, ${n === 1 ? 'verified' : n === 2 ? 'both verified' : 'all verified'}.`
  if (u === n) return `${noun}, ${n === 1 ? 'unsupported' : n === 2 ? 'both unsupported' : 'all unsupported'}.`
  const parts: string[] = []
  if (v) parts.push(`${v} verified`)
  if (u) parts.push(`${u} unsupported`)
  if (p) parts.push(`${p} testing`)
  return `${noun}: ${parts.join(', ')}.`
}

const monthsWord = (m: number | null | undefined) => (m != null ? `${m} months` : 'an unstated term')
const aprWord = (a: number | null | undefined) => (a != null ? `${a.toFixed(2)}%` : 'an unstated rate')

/** The glance sentence for a lender's decision. A loan officer should read it in half a second. */
export function offerGlance(offer: Offer, lender: Lender, opts: { bestApr?: number | null; requested?: Requested; checks?: ReasonCheck[] } = {}): string {
  const who = shortName(lender)
  if (offer.status === 'pending') return `${who} is still reading the file.`
  if (offer.status === 'failed') return `${who} did not answer; no decision was recorded.`
  const cls = offer.classification ?? (offer.decision === 'approve' ? 'approve' : 'deny')
  const pay = monthlyPayment(offer.amount, offer.apr, offer.termMonths)
  if (cls === 'counteroffer') {
    const req = opts.requested
    if (req) return `${who} countered: ${usd(offer.amount)} instead of the ${usd(req.amount)} requested, ${monthsWord(offer.termMonths)} at ${aprWord(offer.apr)}.`
    return `${who} countered with ${usd(offer.amount)} over ${monthsWord(offer.termMonths)} at ${aprWord(offer.apr)}, not the terms requested.`
  }
  if (cls === 'approve') {
    const best = opts.bestApr != null && offer.apr === opts.bestApr
    const c = offer.conditions.length
    const conds = c ? ` ${c} condition${c === 1 ? '' : 's'}.` : ''
    return `${who} offers ${aprWord(offer.apr)} APR, ${usd(pay)}/mo over ${monthsWord(offer.termMonths)}.${best ? ' Best rate.' : ''}${conds}`
  }
  const first = offer.reasons[0] ? plainText(offer.reasons[0].text).trim().replace(/\.$/, '') : 'declined by policy'
  return `${who} declined: ${first}. ${verdictTally(offer, opts.checks ?? [])}`
}

/** Requested-vs-offered comparison plus what accepting the counteroffer does to the notice. */
export function CounterofferDetail({ offer, requested, changed = {} }: { offer: Offer; requested?: Requested; changed?: { amount?: boolean; term?: boolean } }) {
  const accepted: Decision = { _id: '', applicantId: offer.applicantId, chosenOfferId: offer._id, outcome: 'approved', approvedBy: 'human', at: 0, note: '' }
  const ifAccepted = noticeRequired([offer], accepted)
  const ifNot = noticeRequired([offer], undefined)
  const less = requested && offer.amount != null && offer.amount < requested.amount
  return (
    <div className="lc-counter">
      <div className="ax-label">Counteroffer · requested vs offered</div>
      <table className="lc-cmp">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr">Term of the loan</span>
            </th>
            <th scope="col">Requested</th>
            <th scope="col">Offered</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Amount</th>
            <td>{requested ? usd(requested.amount) : 'not on this card'}</td>
            <td className={changed.amount ? 'changed' : ''}>
              {usd(offer.amount)}
              {less && <span className="lc-cmp-note"> ({usd(requested!.amount - offer.amount!)} less)</span>}
              {changed.amount && <span className="lc-changed-word"> changed</span>}
            </td>
          </tr>
          <tr>
            <th scope="row">Term</th>
            <td>{requested?.termMonths != null ? `${requested.termMonths} mo` : 'not stated'}</td>
            <td className={changed.term ? 'changed' : ''}>
              {offer.termMonths != null ? `${offer.termMonths} mo` : '—'}
              {changed.term && <span className="lc-changed-word"> changed</span>}
            </td>
          </tr>
          <tr>
            <th scope="row">APR</th>
            <td>—</td>
            <td>{aprWord(offer.apr)}</td>
          </tr>
        </tbody>
      </table>
      <p className="lc-note">
        <b>Notice:</b> if the borrower accepts this counteroffer, {ifAccepted.required ? 'an adverse-action notice is still required' : 'no adverse-action notice is owed for this lender'} (
        {ifAccepted.why}). If it is not accepted, {ifNot.required ? 'a notice is required' : 'no notice is required'} ({ifNot.why}). A denial from any other lender requires a notice
        regardless.
      </p>
    </div>
  )
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

export function LenderCard({ lender, offer, checks, bestApr, selected, chosen, dim, selectable, changed = {}, onSelect, onTrace, onCollapse, requested, defaultOpen = false }: Props) {
  const meta = LENDERS.find((l) => l.id === lender)!
  const { word, tone } = offerWord(offer)
  const approve = offer.status === 'done' && offer.decision === 'approve'
  const counter = approve && offer.classification === 'counteroffer'
  const testable = offer.status === 'done' && offer.decision === 'decline'
  const pay = approve ? monthlyPayment(offer.amount, offer.apr, offer.termMonths) : null
  const isBest = approve && bestApr != null && offer.apr === bestApr
  const dash = '—'
  const facts: Array<[string, string, boolean | undefined]> = [
    ['APR', approve && offer.apr != null ? `${offer.apr.toFixed(2)}%` : dash, changed.apr],
    ['Monthly payment', pay != null ? usd(pay, 2) : dash, undefined],
    ['Term', approve && offer.termMonths != null ? `${offer.termMonths} mo` : dash, changed.term],
    ['Amount', approve ? usd(offer.amount) : dash, changed.amount],
    ['Latency', offer.latencyMs != null ? `${offer.latencyMs.toLocaleString('en-US')} ms` : dash, undefined],
  ]
  const glance = offerGlance(offer, lender, { bestApr, requested, checks })
  const disTone = tone === 'approve' ? 'good' : tone === 'hard' ? 'bad' : tone === 'accent' ? 'muted' : 'info'
  const changedCount = [changed.apr, changed.amount, changed.term, changed.decision].filter(Boolean).length

  const reasons = (
    <ul>
      {offer.reasons.map((r, i) => {
        const st = checkFor(checks, offer, r.field).state
        return (
          <li key={i}>
            <Icon state={st} />
            <div>
              <p>{plainText(r.text)}</p>
              <span className="ax-chiprow">
                <span className="ax-chip">{reasonLabel(r.field)}</span>
                <span className={`ax-state ${STATE[st].cls}`}>{STATE[st].word}</span>
              </span>
              {testable && <ReasonVerdictRow offer={offer} reason={r} checks={checks} />}
            </div>
          </li>
        )
      })}
      {offer.reasons.length === 0 && <li className="ax-none">No reasons recorded.</li>}
    </ul>
  )

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

      <div className="lc-dis" {...discloseGuards}>
        <Disclose
          className="lc-disclose"
          density="row"
          tone={disTone}
          defaultOpen={defaultOpen}
          summary={glance}
          meta={
            changedCount > 0 ? `${changedCount} changed · ${secs(offer.latencyMs, 1)}` : offer.latencyMs != null ? secs(offer.latencyMs, 1) : undefined
          }
          detail={
            <div className="ax-lc-body">
              <dl className="ax-grid">
                {facts.map(([k, v, ch]) => (
                  <div key={k} className={ch ? 'changed' : ''}>
                    <dt>{k}</dt>
                    <dd className={k === 'APR' ? 'big' : ''}>
                      {v}
                      {ch && <span className="lc-changed-word"> changed</span>}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="ax-reasons">
                {counter && <CounterofferDetail offer={offer} requested={requested} changed={{ amount: changed.amount, term: changed.term }} />}
                <div className="ax-label">
                  {approve ? 'Basis' : 'Reasons'} ({offer.reasons.length})
                </div>
                {offer.conditions.length > 0 && (
                  <p className="ax-cond">
                    <b>Conditions:</b> {offer.conditions.join('; ')}
                  </p>
                )}
                {testable && offer.reasons.length > 0 ? <DiscloseGroup className="rsn-group">{reasons}</DiscloseGroup> : reasons}
              </div>
            </div>
          }
        />
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
