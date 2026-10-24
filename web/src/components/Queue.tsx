// Queue: ranked decision rows on top, then in-flight and decided rows.
// Every row carries one plain-English sentence and an inline Disclose that opens the lender
// verdicts (with reasons and verification words), the bureau facts, the notice and the applicant
// facts, so the loan officer can look before pressing Approve best or Decline without leaving the spot.
//
// Detail tables (bundles, notices, decisions, audit events, reason checks) are optional props. When
// the parent does not pass them, an opened row fetches its own slice from the live backend
// (useApplicantSlice) and, failing that, says in words that the rows are not loaded in this view.
import { useState, type ReactNode, type SyntheticEvent } from 'react'
import type { Applicant, AuditEvent, Bundle, Decision, Notice, Offer, Reason, ReasonCheck } from '../types'
import { LENDERS } from '../types'
import { clock, num, pct, secs, usd } from '../lib/format'
import { STATUS_TONE, STATUS_WORD, IN_FLIGHT } from '../lib/status'
import { rankDecisions, type Ranked } from '../lib/rank'
import { summarize } from '../lib/summary'
import { checkFor, hardStopEvent, originalOf, stepTimings } from '../lib/select'
import { describeIdentityFlag, fieldLabel, stopLabel } from '../../../convex/labels'
import { useApplicantSlice } from '../hooks/useDesk'
import { useNow } from '../hooks/useNow'
import { Disclose, KV, Mono, type KVItem } from './Disclose'
import '../styles/queue.css'

interface Props {
  applicants: Applicant[]
  offers: Offer[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onApproveBest: (applicantId: string, offerId: string) => void
  onDecline: (applicantId: string) => void
  disabled?: boolean
  /** Hard-stop reason per applicant id, quoted on the row. */
  stopReasons?: Record<string, string>
  /** Optional detail tables (see the file comment). Each one is used when present. */
  bundles?: Bundle[]
  notices?: Notice[]
  decisions?: Decision[]
  auditEvents?: AuditEvent[]
  reasonChecks?: ReasonCheck[]
  /** True while the replay store is the source of truth. Defaults to `disabled`, which App sets to desk.replaying. */
  replaying?: boolean
}

const TONE_VAR: Record<string, string> = {
  muted: 'var(--hair-2)',
  accent: 'var(--accent)',
  text: 'var(--text)',
  approve: 'var(--approve)',
  decline: 'var(--decline)',
  hard: 'var(--hard)',
}

const TOTAL = LENDERS.length
const SHORT: Record<string, string> = Object.fromEntries(LENDERS.map((l) => [l.id, l.label]))
const NAME: Record<string, string> = Object.fromEntries(LENDERS.map((l) => [l.id, l.name]))

/** Never print the F-word: lender and compliance text may still carry it. */
const plain = (s: string) => s.replace(/\bFICO\b/gi, 'TransUnion score')
const lower = (s: string) => s.replace(/^./, (c) => c.toLowerCase())
const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`)
const clsOf = (o: Offer) => o.classification ?? (o.decision === 'approve' ? 'approve' : 'deny')
const stop = (e: SyntheticEvent) => e.stopPropagation()

/* ---------------------------------------------------------------- detail data */

interface Tables {
  bundles?: Bundle[]
  notices?: Notice[]
  decisions?: Decision[]
  auditEvents?: AuditEvent[]
  reasonChecks?: ReasonCheck[]
  replaying: boolean
}

/** `undefined` = not loaded in this view; `null` = loaded, nothing exists. */
interface Facts {
  bundle?: Bundle | null
  notice?: Notice | null
  decision?: Decision | null
  events?: AuditEvent[]
  checks?: ReasonCheck[]
}

const CONVEX_ID = /^[a-z0-9]{32}$/

function useFacts(a: Applicant, open: boolean, t: Tables): Facts {
  const fromProps = t.bundles != null && t.notices != null && t.decisions != null && t.auditEvents != null
  // Mock ids (app_1) never reach the backend; replay rows live in the local store.
  const want = open && !fromProps && !t.replaying && CONVEX_ID.test(a._id)
  const slice = useApplicantSlice(want ? a._id : null, t.replaying)
  const id = a._id
  return {
    bundle: t.bundles ? (t.bundles.find((b) => b.applicantId === id) ?? null) : slice ? (slice.bundles[0] ?? null) : undefined,
    notice: t.notices ? (t.notices.find((n) => n.applicantId === id) ?? null) : slice ? (slice.notices[0] ?? null) : undefined,
    decision: t.decisions ? (t.decisions.find((d) => d.applicantId === id) ?? null) : slice ? (slice.decisions[0] ?? null) : undefined,
    events: t.auditEvents ? t.auditEvents.filter((e) => e.applicantId === id) : slice?.auditEvents,
    checks: t.reasonChecks,
  }
}

/* ---------------------------------------------------------------- words */

type VerdictKind = 'idle' | 'quoting' | 'failed' | 'offer' | 'declined'

function lenderVerdict(o: Offer | undefined): { kind: VerdictKind; word: string; text: ReactNode } {
  if (!o) return { kind: 'idle', word: 'Not asked', text: 'This lender has not opened the file.' }
  if (o.status === 'pending') return { kind: 'quoting', word: 'Quoting', text: 'Reading the file now.' }
  if (o.status === 'failed') {
    const why = (o as Offer & { failureReason?: string }).failureReason
    return { kind: 'failed', word: 'Failed', text: why === 'timeout' ? 'Ran out of time. No answer counts as no offer.' : 'Errored. No answer counts as no offer.' }
  }
  const c = clsOf(o)
  if (c === 'approve' || c === 'counteroffer') {
    const apr = o.apr != null ? `${o.apr.toFixed(2)}% APR` : 'APR not stated'
    const term = o.termMonths != null ? ` over ${o.termMonths} months` : ''
    return {
      kind: 'offer',
      word: c === 'approve' ? 'Offer' : 'Counteroffer',
      text: (
        <>
          <Mono>{apr}</Mono>, {usd(o.amount)}
          {term}
          {o.conditions.length ? `. Conditions: ${plain(o.conditions.join('; '))}` : ''}
        </>
      ),
    }
  }
  return { kind: 'declined', word: 'Declined', text: null }
}

/** Verification word for one decline reason: from reasonChecks when the parent passed them, else from the backend's verdict on the reason. */
function reasonVerdict(o: Offer, r: Reason, checks?: ReasonCheck[]): { word: string; cls: string } {
  let state: 'verified' | 'unsupported' | 'pending' | 'none'
  if (checks) state = checkFor(checks, o, r.field).state
  else {
    const v = (r as Reason & { verified?: boolean | null }).verified
    state = v === true ? 'verified' : v === false ? 'unsupported' : 'none'
  }
  if (state === 'verified') return { word: 'verified', cls: 'verified' }
  if (state === 'unsupported') return { word: 'did not flip', cls: 'unsupported' }
  if (state === 'pending') return { word: 'testing', cls: 'pending' }
  return { word: 'untested', cls: 'pending' }
}

function LenderList({ offers, checks }: { offers: Offer[]; checks?: ReasonCheck[] }) {
  return (
    <ul className="qd-lenders" aria-label="What each lender said">
      {LENDERS.map((l) => {
        const o = offers.find((x) => x.lender === l.id)
        const v = lenderVerdict(o)
        return (
          <li key={l.id} data-verdict={v.kind}>
            <span className="qd-lender-head">
              <span className="qd-lender">{l.name}</span>
              <span className={`qd-word ${v.kind}`}>{v.word}</span>
            </span>
            {v.kind === 'declined' && o ? (
              o.reasons.length ? (
                <ul className="qd-reasons">
                  {o.reasons.map((r, i) => {
                    const rv = reasonVerdict(o, r, checks)
                    return (
                      <li key={i}>
                        {plain(r.text)} <span className={`qd-verdict ${rv.cls}`}>{rv.word}</span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <span>No reason recorded.</span>
              )
            ) : (
              <span>{v.text}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function NoticeBlock({ notice, offers }: { notice: Notice | null | undefined; offers: Offer[] }) {
  if (notice === undefined) return <p className="qd-note">Notice: not loaded in this view. Open the applicant to read it.</p>
  if (notice === null) {
    const owed = offers.filter((o) => o.status === 'done' && clsOf(o) !== 'approve').length
    if (offers.length === 0) return <p className="qd-note">No notice yet: no lender has answered.</p>
    return (
      <p className="qd-note">
        {owed ? `Notice owed for ${owed} ${owed === 1 ? 'lender' : 'lenders'}; compliance has not drafted it yet.` : 'No notice owed: every lender offered the requested terms.'}
      </p>
    )
  }
  const sentAt = (notice as Notice & { approvedAt?: number }).approvedAt
  return (
    <>
      <p className="qd-note">
        <b>{sentAt ? 'Notice sent' : 'Notice drafted, not sent'}</b> <Mono>{clock(sentAt ?? notice.createdAt)}</Mono>; covers {notice.lendersDeclined.length}{' '}
        {notice.lendersDeclined.length === 1 ? 'lender' : 'lenders'}
        {notice.required === false ? '; not required' : ''}.
      </p>
      <Disclose tone="muted" summary="Read the notice text" detail={<blockquote className="qd-notice">{plain(notice.text)}</blockquote>} />
    </>
  )
}

function applicantItems(a: Applicant, original?: Applicant): KVItem[] {
  const items: KVItem[] = [
    { label: 'Requested', value: usd(a.amountRequested) },
    { label: 'Stated income', value: `${usd(a.statedIncome)} a year, self-reported` },
    { label: 'Persona', value: <Mono>{a.personaId}</Mono> },
  ]
  if (a.cardCode) items.push({ label: 'Card code', value: <Mono>{a.cardCode}</Mono> })
  if (a.replayOf)
    items.push({
      label: 'Replay of',
      value: original ? `${original.name}'s earlier application, re-run after a dispute` : 'An earlier application, re-run after a dispute',
    })
  items.push({ label: 'Submitted', value: <Mono>{clock(a.createdAt)}</Mono> })
  return items
}

const SOURCE_WORD: Record<Bundle['source'], string> = { crs: 'CRS sandbox', nessie: 'Nessie sandbox', mock: 'mock data' }

function bureauItems(b: Bundle | null | undefined): KVItem[] {
  if (b === undefined) return [{ label: 'Bureau file', value: 'Not loaded in this view. Open the applicant to see the full file.' }]
  if (b === null) return [{ label: 'Bureau file', value: 'Not pulled yet.' }]
  const score = b.credit.fico9 ?? b.credit.vantage4
  const flags = b.flags as Bundle['flags'] & { lienOrJudgment?: boolean }
  const flagWords = [
    flags.frozen && 'frozen file',
    flags.deceased && 'deceased indicator',
    flags.bankruptcy && 'bankruptcy',
    flags.eviction && 'eviction',
    flags.lienOrJudgment && 'lien or judgment',
  ].filter((w): w is string => typeof w === 'string')
  const idFlags = b.identity.flags.map(describeIdentityFlag)
  return [
    { label: 'TransUnion score', value: score != null ? <Mono>{num(score)}</Mono> : 'No score on file' },
    { label: 'Utilization', value: b.credit.utilization != null ? <Mono>{pct(b.credit.utilization)}</Mono> : 'Not reported' },
    { label: 'Inquiries', value: `${b.credit.inquiries6mo} in the last 6 months` },
    { label: 'Identity', value: `${b.identity.verified ? 'Verified' : 'Not verified'}${idFlags.length ? `: ${idFlags.join('; ')}` : ''}` },
    {
      label: 'Fraud',
      value: `${b.fraud.score != null ? `Risk score ${num(b.fraud.score)}` : 'No risk score'}${b.fraud.signals.length ? `: ${b.fraud.signals.join('; ')}` : ', no signals'}`,
    },
    { label: 'Flags', value: flagWords.length ? flagWords.join(', ') : 'None' },
    { label: 'Source', value: `${SOURCE_WORD[b.source]}, pulled ${clock(b.pulledAt)}` },
  ]
}

function hardItems(facts: Facts, stopReason?: string): KVItem[] {
  const ev = facts.events ? hardStopEvent(facts.events) : undefined
  const fallback = stopReason ?? 'An automated safety check halted this file'
  return [
    { label: 'Rule', value: ev?.ref ? stopLabel(ev.ref) : fallback },
    ...(ev?.ref ? [{ label: 'Field', value: fieldLabel(ev.ref) }] : []),
    { label: 'Rule said', value: <q className="qd-quote">{plain(ev?.note ?? fallback)}</q> },
    { label: 'Fired at', value: ev ? <Mono>{clock(ev.at)}</Mono> : facts.events === undefined ? 'Not loaded in this view' : 'Time not recorded' },
    { label: 'Lenders asked', value: `0 of ${TOTAL}. The model never saw this file.` },
    { label: 'Notice', value: 'None owed: a hard stop is not a credit decision.' },
  ]
}

function chosenOffer(a: Applicant, offers: Offer[], d: Decision | null | undefined) {
  const id = d?.chosenOfferId ?? a.chosenOfferId ?? null
  return id ? offers.find((o) => o._id === id) : undefined
}

function decidedItems(a: Applicant, offers: Offer[], facts: Facts): KVItem[] {
  const d = facts.decision
  const chosen = chosenOffer(a, offers, d)
  const declines = offers.filter((o) => o.status === 'done' && clsOf(o) === 'deny').length
  const items: KVItem[] = [{ label: 'Outcome', value: a.status === 'approved' ? 'Approved' : 'Declined' }]
  if (a.status === 'approved')
    items.push({
      label: 'Funded by',
      value: chosen
        ? `${NAME[chosen.lender]} at ${chosen.apr?.toFixed(2) ?? '—'}% APR, ${usd(chosen.amount)}${chosen.termMonths != null ? ` over ${chosen.termMonths} months` : ''}`
        : d === undefined
          ? 'Not loaded in this view'
          : 'Offer not recorded',
    })
  else items.push({ label: 'Lenders', value: `${declines} of ${TOTAL} had said no` })
  items.push({ label: 'Decided at', value: d ? <Mono>{clock(d.at)}</Mono> : d === undefined ? 'Not loaded in this view' : 'Not recorded' })
  items.push({ label: 'Decided by', value: 'The loan officer, by hand' })
  if (d?.note) items.push({ label: 'Note', value: plain(d.note) })
  return items
}

function flightItems(a: Applicant, offers: Offer[], facts: Facts, now: number): KVItem[] {
  const steps = facts.events ? stepTimings(a, facts.events) : null
  const running = steps?.find((s) => s.state === 'running')
  const done = offers.filter((o) => o.status === 'done').length
  return [
    { label: 'Step', value: STATUS_WORD[a.status] },
    {
      label: 'Running for',
      value: running?.startedAt != null ? `${secs(now - running.startedAt)} on ${running.label.toLowerCase()}` : `${secs(now - a.createdAt)} since intake`,
    },
    { label: 'Lenders answered', value: `${done} of ${TOTAL}` },
    { label: 'Submitted', value: <Mono>{clock(a.createdAt)}</Mono> },
  ]
}

/* ---------------------------------------------------------------- detail block */

type Mode = 'decide' | 'hard' | 'decided' | 'flight'

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="qd-block">
      <h4>{title}</h4>
      {children}
    </section>
  )
}

function RowDetail({ a, offers, facts, original, mode, now, stopReason }: { a: Applicant; offers: Offer[]; facts: Facts; original?: Applicant; mode: Mode; now: number; stopReason?: string }) {
  const rule = mode === 'decide' || mode === 'decided' ? summarize(a, offers, undefined).rule : null
  return (
    <div className="qd">
      {mode === 'hard' && (
        <Block title="Hard stop">
          <KV items={hardItems(facts, stopReason)} />
        </Block>
      )}
      {mode === 'decided' && (
        <Block title="Decision">
          <KV items={decidedItems(a, offers, facts)} />
        </Block>
      )}
      {mode === 'flight' && (
        <Block title="Progress">
          <KV items={flightItems(a, offers, facts, now)} />
        </Block>
      )}
      {mode !== 'hard' && (
        <Block title="Lenders">
          <LenderList offers={offers} checks={facts.checks} />
        </Block>
      )}
      {rule && (
        <Block title="Deciding rule">
          <p className="qd-rule">
            <span className="ax-chip">{rule.label}</span>
            {plain(rule.text)}
            <span className="qd-rule-meta">
              Cited by {rule.cited} of {rule.of} declining {rule.of === 1 ? 'lender' : 'lenders'}: {rule.lenders.join(', ')}
            </span>
          </p>
        </Block>
      )}
      {(mode === 'decide' || mode === 'decided') && (
        <Block title="Notice">
          <NoticeBlock notice={facts.notice} offers={offers} />
        </Block>
      )}
      <Block title="Bureau facts">
        <KV items={bureauItems(facts.bundle)} />
      </Block>
      <Block title="Applicant">
        <KV items={applicantItems(a, original)} />
      </Block>
    </div>
  )
}

/** "More / Less" beside Approve and Decline. Disclose has no controlled `open` prop, so this delegates to its summary button by id. */
function MoreButton({ targetId, open }: { targetId: string; open: boolean }) {
  return (
    <span className="q-more-wrap" onClick={stop} onKeyDown={stop}>
      <button
        type="button"
        className="q-more"
        aria-expanded={open}
        aria-controls={`${targetId}-detail`}
        title={open ? 'Hide what the lenders said' : 'See what the lenders said before you act'}
        onClick={() => document.getElementById(`${targetId}-summary`)?.click()}
      >
        {open ? 'Less' : 'More'}
      </button>
    </span>
  )
}

/* ---------------------------------------------------------------- rows */

const FLIGHT_PHRASE: Record<string, string> = {
  intake: 'Taking the application; lenders not asked yet',
  pulling: 'Pulling the bureau file; lenders not asked yet',
  guardrails: 'Running the hard-stop rules before any lender sees the file',
  compliance: 'Compliance is drafting the notice',
}

function rowSentence(a: Applicant, offers: Offer[], facts: Facts, stopReason: string | undefined): ReactNode {
  if (a.status === 'hard_stop') {
    const why = stopReason ?? 'an automated safety check halted this file'
    return (
      <>
        <b>Hard stop:</b> {sentence(lower(plain(why)))} Stopped before lenders, no offers.
      </>
    )
  }
  if (a.status === 'approved') {
    const d = facts.decision
    const chosen = chosenOffer(a, offers, d)
    const when = d ? ` at ${clock(d.at)}` : ''
    const notice = facts.notice ? ((facts.notice as Notice & { approvedAt?: number }).approvedAt ? ' Notice sent.' : ' Notice drafted.') : ''
    return chosen ? (
      <>
        <b>Approved:</b> {NAME[chosen.lender]} at <b className="mono">{chosen.apr?.toFixed(2) ?? '—'}%</b>
        {when}, by the loan officer.{notice}
      </>
    ) : (
      <>
        <b>Approved</b> by the loan officer{when}.{notice}
      </>
    )
  }
  if (a.status === 'declined') {
    const d = facts.decision
    const declines = offers.filter((o) => o.status === 'done' && clsOf(o) === 'deny').length
    return (
      <>
        <b>Declined</b> by the loan officer{d ? ` at ${clock(d.at)}` : ''}; {declines} of {TOTAL} lenders had said no.
      </>
    )
  }
  if (a.status === 'underwriting') {
    const done = offers.filter((o) => o.status === 'done').length
    return <>Underwriting: {done} of {TOTAL} lenders have answered.</>
  }
  return <>{FLIGHT_PHRASE[a.status] ?? STATUS_WORD[a.status]}.</>
}

interface RowProps {
  a: Applicant
  offers: Offer[]
  selected: boolean
  onSelect: () => void
  stopReason?: string
  tables: Tables
  original?: Applicant
  now: number
}

/** In-flight or decided row: name, amount, status word, then one sentence that opens into the record. */
function Row({ a, offers, selected, onSelect, stopReason, tables, original, now }: RowProps) {
  const hard = a.status === 'hard_stop'
  const live = IN_FLIGHT.includes(a.status)
  const [open, setOpen] = useState(false)
  const facts = useFacts(a, open, tables)
  const mode: Mode = hard ? 'hard' : live ? 'flight' : 'decided'
  const tone = hard ? 'bad' : a.status === 'approved' ? 'good' : 'info'
  const meta = live ? secs(now - a.createdAt) : a.replayOf ? 'replay' : undefined
  return (
    <div
      role="option"
      tabIndex={0}
      aria-selected={selected}
      className={`queue-row plain ${hard ? 'hardrow' : ''} ${live ? 'live' : ''}`}
      style={{ ['--row-tone' as string]: TONE_VAR[STATUS_TONE[a.status]] }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <span className="q-line1">
        <span className="q-name">{a.name}</span>
        <span className="q-amt mono">{usd(a.amountRequested)}</span>
      </span>
      <span className="q-line2">
        <span className="q-purpose">{a.purpose}</span>
        <span className={`ax-pill ${hard ? 'hard' : 'outline'}`}>{STATUS_WORD[a.status]}</span>
      </span>
      <div className="q-disclose" onClick={stop} onKeyDown={stop}>
        <Disclose
          id={`q-${a._id}`}
          tone={tone}
          meta={meta}
          onToggle={setOpen}
          summary={<span className="q-sentence">{rowSentence(a, offers, facts, stopReason)}</span>}
          detail={<RowDetail a={a} offers={offers} facts={facts} original={original} mode={mode} now={now} stopReason={stopReason} />}
        />
      </div>
    </div>
  )
}

interface DecideProps {
  r: Ranked
  offers: Offer[]
  rank: number
  selected: boolean
  onSelect: () => void
  onApproveBest: () => void
  onDecline: () => void
  disabled?: boolean
  tables: Tables
  original?: Applicant
  now: number
}

/** A row that needs a human: rank, what is on the table, one sentence, More beside Approve and Decline. */
function DecideRow({ r, offers, rank, selected, onSelect, onApproveBest, onDecline, disabled, tables, original, now }: DecideProps) {
  const a = r.applicant
  const b = r.best
  const counter = b?.classification === 'counteroffer'
  const [open, setOpen] = useState(false)
  const facts = useFacts(a, open, tables)
  const did = `q-${a._id}`
  const failed = offers.filter((o) => o.status === 'failed').length
  const declined = r.done - r.approvals
  const summary = b ? (
    <>
      {r.approvals} of {TOTAL} lenders approve; best <b className="mono">{b.apr!.toFixed(2)}%</b> from {NAME[b.lender]}
      {counter ? ` as a counteroffer on ${usd(b.amount ?? 0)}` : ''}
      {a.chosenOfferId === b._id ? ', the borrower’s pick' : ''}.
    </>
  ) : (
    <>
      <b>No offer</b> on the table: {declined} of {TOTAL} lenders declined{failed ? `, ${failed} failed` : ''}.
    </>
  )
  return (
    <div
      role="option"
      tabIndex={0}
      aria-selected={selected}
      className={`queue-row decide ${b ? 'has-offer' : 'no-offer'}`}
      style={{ ['--row-tone' as string]: b ? 'var(--approve)' : 'var(--decline)' }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <span className="q-line1">
        <span className="q-rank mono">{rank}</span>
        <span className="q-name">{a.name}</span>
        <span className="q-amt mono">{usd(a.amountRequested)}</span>
      </span>
      <span className="q-line2">
        <span className="q-purpose">{a.purpose}</span>
        <span className="ax-pill outline">Review</span>
      </span>
      <span className="q-line3">
        <span className="q-approve">
          {r.approvals}/{TOTAL} approve
        </span>
        <span className="q-seg" role="img" aria-label={`${r.approvals} of ${TOTAL} lenders approve`}>
          {Array.from({ length: TOTAL }, (_, i) => (
            <i key={i} className={i < r.approvals ? 'on' : ''} />
          ))}
        </span>
      </span>
      <div className="q-disclose" onClick={stop} onKeyDown={stop}>
        <Disclose
          id={did}
          tone="human"
          meta={a.replayOf ? 'replay' : undefined}
          onToggle={setOpen}
          summary={<span className="q-sentence q-best">{summary}</span>}
          detail={<RowDetail a={a} offers={offers} facts={facts} original={original} mode="decide" now={now} />}
        />
      </div>
      <span className="queue-actions" onClick={stop}>
        <button type="button" className="approve-pill" disabled={disabled || !b} onClick={onApproveBest} title={b ? `Approve ${SHORT[b.lender]} at ${b.apr!.toFixed(2)}%` : 'No offer to approve'}>
          Approve best
        </button>
        <button type="button" className="decline-pill" disabled={disabled} onClick={onDecline}>
          Decline
        </button>
        <MoreButton targetId={did} open={open} />
      </span>
    </div>
  )
}

/** Laminar traces table: status bar flush-left, mono numbers. Decision rows ranked on top. */
export function Queue({ applicants, offers, selectedId, onSelect, onNew, onApproveBest, onDecline, disabled, stopReasons, bundles, notices, decisions, auditEvents, reasonChecks, replaying }: Props) {
  const ranked = rankDecisions(applicants, offers)
  const decidingIds = new Set(ranked.map((r) => r.applicant._id))
  const newest = applicants.slice().sort((a, b) => b.createdAt - a.createdAt)
  const inFlight = newest.filter((a) => IN_FLIGHT.includes(a.status))
  const finished = newest.filter((a) => !IN_FLIGHT.includes(a.status) && !decidingIds.has(a._id))
  const now = useNow(inFlight.length > 0)
  const tables: Tables = { bundles, notices, decisions, auditEvents, reasonChecks, replaying: replaying ?? !!disabled }
  const offersOf = (id: string) => offers.filter((o) => o.applicantId === id)
  return (
    <aside className="pane" aria-label="Applicant queue">
      <div className="pane-head">
        <span className="section-label">Queue</span>
        <button type="button" onClick={onNew} disabled={disabled}>
          New applicant
        </button>
      </div>
      <div className="pane-body" role="listbox" aria-label="Applicants">
        {applicants.length === 0 && <div className="empty">No applicants yet. Draw a persona card and submit an application.</div>}
        {ranked.length > 0 && (
          <>
            <div className="queue-section">
              <span>Needs your decision · {ranked.length}</span>
              <span className="mono">A approve · X decline</span>
            </div>
            {ranked.map((r, i) => (
              <DecideRow
                key={r.applicant._id}
                r={r}
                offers={offersOf(r.applicant._id)}
                rank={i + 1}
                selected={r.applicant._id === selectedId}
                onSelect={() => onSelect(r.applicant._id)}
                onApproveBest={() => r.best && onApproveBest(r.applicant._id, r.best._id)}
                onDecline={() => onDecline(r.applicant._id)}
                disabled={disabled}
                tables={tables}
                original={originalOf(applicants, r.applicant)}
                now={now}
              />
            ))}
          </>
        )}
        {inFlight.length > 0 && (
          <>
            <div className="queue-section">
              <span>In flight · {inFlight.length}</span>
            </div>
            {inFlight.map((a) => (
              <Row key={a._id} a={a} offers={offersOf(a._id)} selected={a._id === selectedId} onSelect={() => onSelect(a._id)} stopReason={stopReasons?.[a._id]} tables={tables} original={originalOf(applicants, a)} now={now} />
            ))}
          </>
        )}
        {finished.length > 0 && (
          <>
            <div className="queue-section">
              <span>Decided · {finished.length}</span>
            </div>
            {finished.map((a) => (
              <Row key={a._id} a={a} offers={offersOf(a._id)} selected={a._id === selectedId} onSelect={() => onSelect(a._id)} stopReason={stopReasons?.[a._id]} tables={tables} original={originalOf(applicants, a)} now={now} />
            ))}
          </>
        )}
      </div>
      <div className="pane-foot">
        <span>{applicants.length === 0 ? 'no applicants' : `${applicants.length} applicant${applicants.length === 1 ? '' : 's'}`}</span>
        <span>{ranked.length ? `${ranked.length} waiting on you` : 'nothing waiting on you'}</span>
      </div>
    </aside>
  )
}
