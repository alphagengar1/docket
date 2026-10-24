// Decision Summary: the card that answers "what happened and what do I do" before any lender detail.
// Progressive disclosure: every block is one plain-English glance line; the detail opens inline.
import type { Applicant, AuditEvent, Bundle, Notice, Offer, ReasonCheck } from '../types'
import { summarize, type LenderLine, type ReasonLine, type Summary } from '../lib/summary'
import { STATUS_WORD } from '../lib/status'
import { clockMs, num, pct, usd } from '../lib/format'
import { describeIdentityFlag, fieldLabel, stopLabel } from '../../../convex/labels'
import { Disclose, DiscloseGroup, KV, Mono, type DiscloseTone } from './Disclose'
import '../styles/summary.css'

interface Props {
  applicant: Applicant
  offers: Offer[]
  hardStop: AuditEvent | undefined
  canDecide: boolean
  onApprove: (offerId: string) => void
  onDecline: () => void
  /** Optional: with these the "More" disclosure can show verification verdicts, bureau facts, the notice and override attempts. */
  checks?: ReasonCheck[]
  bundle?: Bundle
  notice?: Notice
  events?: AuditEvent[]
}

/** Disclose tone for one lender row. Orange stays reserved for hard stops and failures; approvals are blue. */
export function lenderTone(line: LenderLine): DiscloseTone {
  if (line.tone === 'approve') return 'good'
  if (line.tone === 'hard') return 'bad'
  if (line.tone === 'decline') return 'info'
  return 'muted'
}

/** Right-hand meta for one lender row: "Declined · 3 reasons · 2 verified". Always words, never a color alone. */
export function lenderMeta(line: LenderLine): string {
  const parts = [line.word]
  if (line.offer?.status === 'done') {
    parts.push(`${line.reasons.length} ${line.reasons.length === 1 ? 'reason' : 'reasons'}`)
    if (line.verified != null) parts.push(line.testing > 0 ? `${line.verified} verified, ${line.testing} testing` : `${line.verified} verified`)
  }
  return parts.join(' · ')
}

function VerdictWord({ verdict }: { verdict: ReasonLine['verdict'] }) {
  if (!verdict) return null
  return <span className={`sum-verdict sum-verdict--${verdict.replace(/\s+/g, '-')}`}>{verdict}</span>
}

function ReasonLines({ reasons, numbered }: { reasons: ReasonLine[]; numbered?: boolean }) {
  if (reasons.length === 0) return <p className="sum-note">No reasons were written.</p>
  const Tag = numbered ? 'ol' : 'ul'
  return (
    <Tag className="sum-reasons">
      {reasons.map((r, i) => (
        <li key={i}>
          <span className="sum-reason-label">{r.label}</span>
          <span className="sum-reason-text">{r.text}</span>
          <VerdictWord verdict={r.verdict} />
        </li>
      ))}
    </Tag>
  )
}

/** The expandable block under one lender sentence. */
export function LenderDetail({ line }: { line: LenderLine }) {
  const o = line.offer
  if (!o || o.status !== 'done') return <p className="sum-note">{line.sentence}</p>
  const deny = line.tone === 'decline'
  if (deny) {
    return (
      <>
        <p className="sum-note">
          {line.reasons.length} {line.reasons.length === 1 ? 'reason' : 'reasons'}
          {line.verified != null && <>; the counterfactual test verified {line.verified} of {line.reasons.length}{line.testing > 0 && <>, {line.testing} still testing</>}</>}.
        </p>
        <ReasonLines reasons={line.reasons} numbered />
      </>
    )
  }
  return (
    <>
      <KV
        items={[
          { label: 'APR', value: o.apr != null ? <Mono>{o.apr.toFixed(2)}%</Mono> : 'not quoted' },
          { label: 'Amount', value: <Mono>{usd(o.amount)}</Mono> },
          { label: 'Term', value: o.termMonths != null ? <Mono>{o.termMonths} months</Mono> : 'not quoted' },
          { label: 'Monthly', value: line.monthly != null ? <Mono>{usd(line.monthly)}</Mono> : 'not quoted' },
          ...(o.conditions.length ? [{ label: 'Conditions', value: o.conditions.join('; ') }] : []),
        ]}
      />
      {line.reasons.length > 0 && (
        <>
          <p className="sum-subhead">Basis</p>
          <ReasonLines reasons={line.reasons} />
        </>
      )}
    </>
  )
}

function BureauFacts({ bundle }: { bundle: Bundle }) {
  const c = bundle.credit
  const flagWords = (Object.entries(bundle.flags) as Array<[string, boolean]>)
    .filter(([, on]) => on)
    .map(([k]) => fieldLabel(`flags.${k}`))
  const identityFlags = bundle.identity.flags.map(describeIdentityFlag)
  return (
    <KV
      items={[
        { label: 'TransUnion score', value: c.fico9 != null ? <Mono>{num(c.fico9)}</Mono> : 'not on file' },
        { label: 'Utilization', value: c.utilization != null ? <Mono>{pct(c.utilization)}</Mono> : 'not on file' },
        { label: 'Inquiries, 6 months', value: <Mono>{num(c.inquiries6mo)}</Mono> },
        {
          label: 'Identity',
          value: `${bundle.identity.verified ? 'verified' : 'not verified'}${identityFlags.length ? `: ${identityFlags.join('; ')}` : ''}`,
        },
        {
          label: 'Fraud',
          value: `${bundle.fraud.score != null ? `score ${num(bundle.fraud.score)} of 100` : 'no score'}${bundle.fraud.signals.length ? `: ${bundle.fraud.signals.join('; ')}` : ''}`,
        },
        { label: 'Flags', value: flagWords.length ? flagWords.join(', ') : 'none' },
      ]}
    />
  )
}

/** Everything a person should look at before pressing Approve or Decline. */
function MoreDetail({ s, bundle, notice, canDecide }: { s: Summary; bundle?: Bundle; notice?: Notice; canDecide: boolean }) {
  return (
    <div className="sum-more">
      <DiscloseGroup title="Lender verdicts" className="sum-lenders">
        {s.lenders.map((line) => (
          <Disclose
            key={line.lender}
            tone={lenderTone(line)}
            summary={line.sentence}
            meta={lenderMeta(line)}
            detail={<LenderDetail line={line} />}
          />
        ))}
      </DiscloseGroup>

      <div className="sum-cols">
        <section className="sum-sec" aria-label="Counts">
          <p className="sum-subhead">Counts</p>
          <KV
            items={[
              { label: 'Declined', value: <Mono>{s.declined}</Mono> },
              { label: 'Offered', value: <Mono>{s.offered}</Mono> },
              { label: 'Counteroffers', value: <Mono>{s.counter}</Mono> },
              { label: 'Answered', value: <Mono>{s.answered} of {s.total}</Mono> },
            ]}
          />
        </section>
        {s.best && (
          <section className="sum-sec" aria-label="Best offer">
            <p className="sum-subhead">Best offer{canDecide ? ' (what Approve funds)' : ''}</p>
            <KV
              items={[
                { label: 'Lender', value: s.lenders.find((l) => l.lender === s.best!.lender)?.name ?? s.best.lender },
                { label: 'APR', value: <Mono>{s.best.apr!.toFixed(2)}%</Mono> },
                { label: 'Amount', value: <Mono>{usd(s.best.amount)}</Mono> },
                { label: 'Term', value: <Mono>{s.best.termMonths ?? '—'} months</Mono> },
                { label: 'Monthly', value: s.bestMonthly != null ? <Mono>{usd(s.bestMonthly)}</Mono> : 'not quoted' },
              ]}
            />
          </section>
        )}
        <section className="sum-sec" aria-label="Bureau facts">
          <p className="sum-subhead">Bureau facts</p>
          {bundle ? <BureauFacts bundle={bundle} /> : <p className="sum-note">Bureau facts are not loaded on this surface.</p>}
        </section>
      </div>

      {notice && (
        <section className="sum-sec" aria-label="Notice">
          <p className="sum-subhead">
            Notice{notice.required === true ? ' (required' : notice.required === false ? ' (not required' : ''}
            {notice.requiredBecause ? `: ${notice.requiredBecause})` : notice.required != null ? ')' : ''}
          </p>
          <blockquote className="sum-notice">{notice.text}</blockquote>
        </section>
      )}
    </div>
  )
}

function RuleDetail({ s }: { s: Summary }) {
  const rule = s.rule!
  const rest = s.rules.slice(1)
  return (
    <>
      <p className="sum-note">
        <span className="ax-chip">{rule.label}</span>
        Cited by {rule.cited} of {rule.of} declining {rule.of === 1 ? 'lender' : 'lenders'}. What each wrote, and whether removing that one fact flipped the lender's answer:
      </p>
      <ul className="sum-cites">
        {rule.citations.map((c) => (
          <li key={c.lender}>
            <span className="sum-cite-name">{c.name}</span>
            <span className="sum-reason-text">{c.text}</span>
            <VerdictWord verdict={c.verdict} />
          </li>
        ))}
      </ul>
      {rest.length > 0 ? (
        <>
          <p className="sum-subhead">Also cited</p>
          <KV items={rest.map((r) => ({ label: r.label, value: `${r.cited} of ${r.of}: ${r.lenders.join(', ')}` }))} />
        </>
      ) : (
        <p className="sum-note">No other field was cited by a declining lender.</p>
      )}
    </>
  )
}

function StopDetail({ s, hs, a, events }: { s: Summary; hs: AuditEvent | undefined; a: Applicant; events?: AuditEvent[] }) {
  const blocked = (events ?? []).filter((e) => e.action === 'override.blocked')
  const attempts = a.overrideAttempts ?? (events ? blocked.length : null)
  return (
    <KV
      items={[
        { label: 'Rule', value: hs?.ref ? `${fieldLabel(hs.ref).replace(/^./, (c) => c.toUpperCase())}: ${stopLabel(hs.ref)}` : 'Automated safety check' },
        { label: 'Decided by', value: <><Mono>rules.ts</Mono>, deterministic code. No model saw this file.</> },
        { label: 'Fired at', value: hs ? <Mono>{clockMs(hs.at)}</Mono> : 'time not recorded' },
        { label: 'Audit note', value: <blockquote className="sum-notice">{s.stopReason}</blockquote> },
        { label: 'Underwriters run', value: `0 of ${s.total}` },
        { label: 'Notice', value: 'None owed. A hard stop is not a credit decision.' },
        {
          label: 'Override attempts',
          value:
            attempts == null
              ? 'none recorded'
              : attempts === 0
                ? 'none'
                : (
                  <>
                    {attempts} blocked.
                    {blocked.length > 0 && (
                      <ul className="sum-blocked">
                        {blocked.map((e) => (
                          <li key={e._id}>
                            <Mono>{clockMs(e.at)}</Mono> {e.note}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ),
        },
      ]}
    />
  )
}

export function DecisionSummary({ applicant: a, offers, hardStop, canDecide, onApprove, onDecline, checks, bundle, notice, events }: Props) {
  const s = summarize(a, offers, hardStop, checks)
  const hard = s.kind === 'hard'
  const moreParts = [`${s.lenders.length} lender verdicts with reasons`]
  if (bundle) moreParts.push('bureau facts')
  if (notice) moreParts.push('the notice')
  const moreLine = moreParts.length > 1 ? `${moreParts.slice(0, -1).join(', ')} and ${moreParts[moreParts.length - 1]}` : moreParts[0]
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
      <div className="ax-sum-main sum-main">
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
        {!hard && (
          <div className="sum-more-row">
            <Disclose
              tone="info"
              className="sum-more-disclose"
              summary={`More: ${moreLine}.`}
              meta={`${s.answered} of ${s.total} answered`}
              detail={<MoreDetail s={s} bundle={bundle} notice={notice} canDecide={canDecide} />}
            />
          </div>
        )}
      </div>
      {hard ? (
        <div className="sum-block hard" role="alert">
          <span className="ax-label">Stop reason</span>
          <Disclose
            tone="bad"
            summary={s.stopGlance}
            meta={hardStop ? `stopped ${clockMs(hardStop.at)}` : 'stopped'}
            detail={<StopDetail s={s} hs={hardStop} a={a} events={events} />}
          />
        </div>
      ) : (
        s.rule && (
          <div className="sum-block">
            <span className="ax-label">Deciding rule</span>
            <Disclose
              tone="info"
              summary={s.ruleGlance}
              meta={`${s.rule.cited} of ${s.rule.of} · ${s.rules.length} ${s.rules.length === 1 ? 'field' : 'fields'} cited`}
              detail={<RuleDetail s={s} />}
            />
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
