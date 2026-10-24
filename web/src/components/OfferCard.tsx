import { LENDERS, type Lender, type Offer, type ReasonCheck } from '../types'
import { clock, monthlyPayment, secs, totalInterest, usd } from '../lib/format'
import { offerWord } from '../lib/status'
import { useCountUp } from '../hooks/useNow'
import { ReasonList, plainText, reasonLabel } from './ReasonList'
import { CounterofferDetail, LenderCard, POLICY_NOTE, discloseGuards, offerGlance, shortName, type Requested } from './LenderCard'
import { Disclose, KV } from './Disclose'

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
  /** Focus mode: headline only (status, APR or first reason, monthly); rows, conditions and reasons open through the Details disclosure. */
  compact?: boolean
  /** What the borrower asked for; lets a counteroffer be read against the request. */
  requested?: Requested
  /** Open the detail on mount. */
  defaultOpen?: boolean
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

export function OfferCard({ lender, offer, checks, underwriteStartedAt, now, selected, chosen, dim, canSelect, onSelect, onTrace, bestApr, before, compact, requested, defaultOpen = false }: Props) {
  const meta = LENDERS.find((l) => l.id === lender)!
  const approve = offer?.status === 'done' && offer.decision === 'approve'
  const apr = useCountUp(approve ? offer!.apr : null)

  if (!offer || offer.status === 'pending') {
    const since = offer?.createdAt ?? underwriteStartedAt
    const who = shortName(lender)
    const glance = since ? `${who} is still reading the file (${secs(now - since, 1)}).` : `${who} has not started yet.`
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
        <div className="oc-dis">
          <Disclose
            className="oc-disclose"
            density="row"
            tone="muted"
            defaultOpen={defaultOpen}
            summary={glance}
            meta={since ? secs(now - since, 1) : undefined}
            detail={
              <>
                <KV
                  items={[
                    { label: 'Started', value: since ? clock(since) : 'Not yet; waiting for the bureau pull and guardrails to finish.' },
                    { label: 'Provider', value: offer?.provider ?? 'claude' },
                    { label: 'Policy', value: `${meta.policy} (${meta.label}). ${POLICY_NOTE[lender]}` },
                    { label: 'Must decide', value: 'Approve or decline; if approved, an APR, a term and an amount; if declined, at least two reasons, each then tested with a counterfactual.' },
                  ]}
                />
                {!compact && (
                  <dl className="rows oc-skel-rows" aria-hidden="true">
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
                )}
              </>
            }
          />
        </div>
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
  const counter = approve && offer.classification === 'counteroffer'

  if (!compact) {
    return (
      <LenderCard
        lender={lender}
        offer={offer}
        checks={checks}
        bestApr={bestApr}
        selected={selected}
        chosen={chosen}
        dim={dim}
        selectable={selectable}
        changed={{ apr: changed('apr'), amount: changed('amount'), term: changed('termMonths'), decision: changed('decision') || changed('classification') }}
        onSelect={onSelect}
        onTrace={onTrace}
        requested={requested}
        defaultOpen={defaultOpen}
      />
    )
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (!selectable) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect()
    }
  }

  const glance = offerGlance(offer, lender, { bestApr, requested, checks })
  const disTone = tone === 'approve' ? 'good' : tone === 'hard' ? 'bad' : 'info'
  const first = offer.reasons[0]

  return (
    <div
      className={`card arrive compact ${selectable ? 'selectable' : ''} ${chosen ? 'chosen' : ''} ${dim ? 'dim' : ''}`}
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
            {counter && (
              <span className="tone-decline">
                {' '}
                · countered: {usd(offer.amount)}
                {requested ? ` of ${usd(requested.amount)} requested` : ', not the terms requested'}
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="hero declined">
          <span>
            <span className="mono code">{first ? reasonLabel(first.field) : 'policy'}</span>
            {first ? plainText(first.text) : 'Declined by policy.'}
          </span>
        </div>
      )}

      <div className="oc-dis" {...discloseGuards}>
        <Disclose
          className="oc-disclose"
          density="row"
          tone={disTone}
          defaultOpen={defaultOpen}
          summary={glance}
          meta={secs(offer.latencyMs, 1)}
          detail={
            <div className="oc-detail">
              <dl className="rows">
                <dt>Amount</dt>
                <dd className={`primary ${changed('amount') ? 'changed' : ''}`}>{approve && offer.amount != null ? <Num value={offer.amount} digits={0} prefix="$" /> : '—'}</dd>
                <dt>Monthly</dt>
                <dd>{approve && pay != null ? <Num value={pay} prefix="$" /> : '—'}</dd>
                <dt>Total interest</dt>
                <dd>{approve && interest != null ? <Num value={interest} prefix="$" /> : '—'}</dd>
                <dt>Market anchor{offer.marketAnchor ? ` · ${offer.marketAnchor.tier} tier` : ''}</dt>
                <dd>{offer.marketAnchor ? `${offer.marketAnchor.aprLow}–${offer.marketAnchor.aprHigh}%` : '—'}</dd>
              </dl>

              {counter && (
                <div className="block">
                  <CounterofferDetail offer={offer} requested={requested} changed={{ amount: changed('amount'), term: changed('termMonths') }} />
                </div>
              )}

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

              <span className="chips oc-provider">
                <span className="chip">provider {offer.provider}</span>
                <span className="chip">{offer.latencyMs != null ? `${offer.latencyMs.toLocaleString('en-US')} ms` : '—'}</span>
              </span>
            </div>
          }
        />
      </div>

      <div className="card-foot">
        <span className="chips">
          <span className="chip">{secs(offer.latencyMs, 2)}</span>
          {offer.conditions.length > 0 && <span className="chip">{offer.conditions.length} conditions</span>}
          <span className="chip">{offer.reasons.length} reasons</span>
        </span>
        <span className="chips">
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

/** "Before" card for the dispute diff: a glance line, with the original terms, reasons and changed fields inline. */
export function BeforeCard({ lender, offer, after, checks = [] }: { lender: Lender; offer: Offer | undefined; after?: Offer; checks?: ReasonCheck[] }) {
  const meta = LENDERS.find((l) => l.id === lender)!
  if (!offer || offer.status !== 'done') {
    return (
      <div className="card before">
        <div className="card-head">
          <span className="lender">{meta.name}</span>
          <span className="pill">No record</span>
        </div>
        <p className="oc-before-none">Before the dispute, {shortName(lender)} did not record a decision.</p>
      </div>
    )
  }
  const { word, tone } = offerWord(offer)
  const approve = offer.decision === 'approve'
  const cls = offer.classification ?? (approve ? 'approve' : 'deny')
  const who = shortName(lender)
  const pay = monthlyPayment(offer.amount, offer.apr, offer.termMonths)
  const glance =
    cls === 'deny'
      ? `Before the dispute: ${who} declined on ${offer.reasons.map((r) => reasonLabel(r.field)).join(' and ') || 'policy'}.`
      : cls === 'counteroffer'
        ? `Before the dispute: ${who} countered with ${usd(offer.amount)} over ${offer.termMonths ?? '—'} months at ${offer.apr?.toFixed(2) ?? '—'}%.`
        : `Before the dispute: ${who} offered ${offer.apr?.toFixed(2) ?? '—'}% APR, ${usd(pay)}/mo over ${offer.termMonths ?? '—'} months.`

  const changes: Array<{ label: string; value: string }> = []
  if (after && after.status === 'done') {
    const w = (o: Offer) => offerWord(o).word
    if (w(after) !== word) changes.push({ label: 'Decision', value: `${word} → ${w(after)}` })
    if (after.apr !== offer.apr) changes.push({ label: 'APR', value: `${offer.apr != null ? `${offer.apr.toFixed(2)}%` : '—'} → ${after.apr != null ? `${after.apr.toFixed(2)}%` : '—'}` })
    if (after.amount !== offer.amount) changes.push({ label: 'Amount', value: `${usd(offer.amount)} → ${usd(after.amount)}` })
    if (after.termMonths !== offer.termMonths) changes.push({ label: 'Term', value: `${offer.termMonths ?? '—'} mo → ${after.termMonths ?? '—'} mo` })
    const beforeFields = new Set(offer.reasons.map((r) => r.field))
    const afterFields = new Set(after.reasons.map((r) => r.field))
    const dropped = [...beforeFields].filter((f) => !afterFields.has(f)).map(reasonLabel)
    const added = [...afterFields].filter((f) => !beforeFields.has(f)).map(reasonLabel)
    if (dropped.length) changes.push({ label: 'Reasons dropped', value: dropped.join(', ') })
    if (added.length) changes.push({ label: 'Reasons added', value: added.join(', ') })
  }

  return (
    <div className="card before" aria-label={`${meta.label} before dispute`}>
      <div className="card-head">
        <span className="lender">{meta.name}</span>
        <span className={`pill ${tone}`}>{word}</span>
      </div>
      <div className="oc-dis">
        <Disclose
          className="oc-disclose"
          density="row"
          tone="muted"
          summary={glance}
          meta={after && after.status === 'done' ? `${changes.length} changed` : undefined}
          detail={
            <div className="oc-detail">
              <KV
                items={[
                  { label: 'APR', value: approve && offer.apr != null ? `${offer.apr.toFixed(2)}%` : '—' },
                  { label: 'Monthly', value: approve && pay != null ? usd(pay, 2) : '—' },
                  { label: 'Term', value: approve && offer.termMonths != null ? `${offer.termMonths} mo` : '—' },
                  { label: 'Amount', value: approve ? usd(offer.amount) : '—' },
                  { label: 'Decided at', value: clock(offer.createdAt) },
                ]}
              />
              <div className="block">
                <span className="label">{approve ? 'Basis' : 'Reasons'} · {offer.reasons.length}</span>
                <ReasonList offer={offer} checks={checks} untested={checks.length === 0} />
              </div>
              <div className="block">
                <span className="label">Changed in the re-run</span>
                {after && after.status === 'done' ? (
                  changes.length ? <KV items={changes} /> : <p className="oc-before-none">Nothing changed: the re-run reached the same decision on the same terms.</p>
                ) : (
                  <p className="oc-before-none">The re-run card below highlights every value that changed.</p>
                )}
              </div>
            </div>
          }
        />
      </div>
    </div>
  )
}
