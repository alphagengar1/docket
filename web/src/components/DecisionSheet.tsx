// Decision sheet: one applicant in focus over a blurred desk. Key points first, then the three
// lender cards, then the actions. Left/right arrows walk the queue; Esc closes.
//
// Progressive disclosure: every block is one plain-English glance line that opens in place.
//   1. Applicant facts (who wants what) and the bureau facts (what the lenders actually read).
//   2. "Look before you act": lender verdicts with reasons, bureau facts and the notice text,
//      right under the summary's Approve / Decline and reachable from the footer's More button.
//   3. Record: the adverse-action notice and the pipeline trace, in the sheet. The Trace and
//      Notice buttons still open the Inspector; nothing forces that context switch any more.
import { useEffect, useState, type ReactNode } from 'react'
import type { Actor, Applicant, AuditEvent, Bundle, Decision, Notice, Offer, ReasonCheck } from '../types'
import { LENDERS } from '../types'
import { clock, clockMs, secs, usd } from '../lib/format'
import { IN_FLIGHT, STATUS_TONE, STATUS_WORD } from '../lib/status'
import { hardStopEvent, noticeRequired, stepTimings, type StepState } from '../lib/select'
import { summarize, type LenderLine } from '../lib/summary'
import { actionWords, refWords } from '../lib/auditWords'
import { reasonLabel } from './ReasonList'
import { DecisionSummary } from './DecisionSummary'
import { ApplicantFacts, BureauFacts, bureauConcern, bureauGlance, bureauMissing } from './ApplicantFacts'
import { OfferCard } from './OfferCard'
import { Disclose, DiscloseGroup, KV, Mono, type DiscloseTone, type KVItem } from './Disclose'
import '../styles/sheet.css'

interface Props {
  applicant: Applicant
  offers: Offer[]
  checks: ReasonCheck[]
  events: AuditEvent[]
  notice: Notice | undefined
  decision: Decision | undefined
  /** The bureau bundle for this applicant. Optional so existing callers compile; the sheet says when it is missing. */
  bundle?: Bundle
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
}

const MORE_ID = 'sheet-more'

function bestOf(offers: Offer[]): Offer | null {
  return (
    offers
      .filter((o) => o.status === 'done' && o.decision === 'approve' && o.apr != null)
      .sort((a, b) => a.apr! - b.apr!)[0] ?? null
  )
}

const lenderLabel = (id: string) => LENDERS.find((l) => l.id === id)?.label ?? id
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const sentence = (parts: string[]) => {
  const s = parts.join(', ')
  return s ? s.charAt(0).toUpperCase() + s.slice(1) + '.' : ''
}
const when = (t: number) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export function DecisionSheet(p: Props) {
  const { applicant: a, offers, checks } = p
  const best = bestOf(offers)
  const chosen = p.decision?.chosenOfferId ? offers.find((o) => o._id === p.decision!.chosenOfferId) : undefined
  const hard = a.status === 'hard_stop'
  const hs = hard ? hardStopEvent(p.events) : undefined
  const running = IN_FLIGHT.includes(a.status)
  const canDecide = a.status === 'awaiting_human'
  const sel = offers.find((o) => o._id === p.selectedOfferId && o.decision === 'approve') ?? best
  const summary = summarize(a, offers, hs, checks)
  const myChecks = checks.filter((c) => c.applicantId === a._id)

  // The "Look before you act" card's open state, mirrored so the footer button can report aria-expanded.
  const [moreOpen, setMoreOpen] = useState(false)
  useEffect(() => setMoreOpen(false), [a._id])

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

  // Disclose owns its open state (no controlled prop), so the footer's More button drives the card
  // through its own summary button and scrolls it into view. Local workaround; said so in the report.
  const openMore = () => {
    const btn = document.getElementById(`${MORE_ID}-summary`) as HTMLButtonElement | null
    if (!btn) return
    if (btn.getAttribute('aria-expanded') !== 'true') btn.click()
    document.getElementById(MORE_ID)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    btn.focus({ preventScroll: true })
  }

  const noticeView = noticeBlock(p.notice, offers, p.decision, a)
  const bureauTone: DiscloseTone = p.bundle ? (bureauConcern(p.bundle) ? 'bad' : 'info') : 'muted'
  const missing = p.bundle ? null : bureauMissing(a)

  return (
    <div className="scrim sheet-scrim" onClick={p.onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Decision: ${a.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-nav">
          <button type="button" className="ghost" onClick={p.onPrev} aria-label="Previous applicant" title="← previous">
            ←
          </button>
          <span className="mono muted">
            {p.position.index + 1} / {p.position.total}
          </span>
          <button type="button" className="ghost" onClick={p.onNext} aria-label="Next applicant" title="→ next">
            →
          </button>
          <span className="sheet-id mono muted">{a.personaId}</span>
          <button type="button" className="ghost" onClick={p.onClose} aria-label="Close">
            Esc
          </button>
        </div>

        {/* Keyed by applicant so every disclosure starts closed when the arrows walk the queue. */}
        <div className="sheet-body" key={a._id}>
          <header className="sheet-head">
            <h2 className="disp">{a.name}</h2>
            <span className={`status tone-${STATUS_TONE[a.status]} ${running ? 'live' : ''}`}>{STATUS_WORD[a.status]}</span>
          </header>

          <div className="sheet-facts">
            <ApplicantFacts a={a} variant="disclose" />
            <Disclose
              id="sheet-bureau"
              tone={bureauTone}
              summary={p.bundle ? bureauGlance(p.bundle) : missing!.summary}
              meta={p.bundle ? <>pulled {clock(p.bundle.pulledAt)}</> : 'no file'}
              detail={p.bundle ? <BureauFacts b={p.bundle} /> : missing!.detail}
            />
          </div>

          <div className="sheet-sum">
            <DecisionSummary
              applicant={a}
              offers={offers}
              hardStop={hs}
              canDecide={canDecide}
              onApprove={p.onApprove}
              onDecline={p.onDecline}
              checks={checks}
              bundle={p.bundle}
              notice={p.notice}
              events={p.events}
            />
            <Disclose
              id={MORE_ID}
              className="sheet-more"
              density="card"
              tone="human"
              summary={moreGlance(summary.kind, summary.offered, summary.counter, summary.declined, summary.answered, summary.total, !!p.notice)}
              meta={<>{summary.answered} of {summary.total} answered</>}
              onToggle={setMoreOpen}
              detail={
                <>
                  <h4 className="more-h">Lender verdicts</h4>
                  <LenderVerdicts lines={summary.lenders} />
                  <h4 className="more-h">Bureau facts</h4>
                  {p.bundle ? <BureauFacts b={p.bundle} /> : <p className="facts-note">{missing!.summary}</p>}
                  {p.notice && (
                    <>
                      <h4 className="more-h">Adverse-action notice</h4>
                      <pre className="notice-text">{p.notice.text}</pre>
                    </>
                  )}
                </>
              }
            />
          </div>

          <div className="sheet-cards">
            {hard ? null : (
              LENDERS.map((l) => {
                const o = offers.find((x) => x.lender === l.id)
                return (
                  <OfferCard
                    key={l.id}
                    lender={l.id}
                    offer={o}
                    checks={checks}
                    bestApr={best?.apr ?? null}
                    underwriteStartedAt={p.underwriteStartedAt}
                    now={p.now}
                    selected={!!o && !!sel && o._id === sel._id && canDecide}
                    chosen={!!chosen && o?._id === chosen._id}
                    dim={!!chosen && o?._id !== chosen._id}
                    canSelect={canDecide}
                    onSelect={() => o && p.onSelectOffer(o._id)}
                    onTrace={() => p.onInspect('trace')}
                  />
                )
              })
            )}
          </div>

          <DiscloseGroup title="Record" className="sheet-record">
            <Disclose
              id="sheet-notice"
              tone={noticeView.tone}
              summary={noticeView.summary}
              meta={p.notice ? <>drafted {clock(p.notice.createdAt)}</> : 'no notice'}
              detail={noticeView.detail}
            />
            <Disclose
              id="sheet-trace"
              tone={hard ? 'bad' : 'info'}
              summary={traceGlance(a, p.events, offers, p.notice, p.decision, p.now)}
              meta={<>{plural(p.events.length, 'event')}</>}
              detail={<TraceDetail a={a} events={p.events} offers={offers} checks={myChecks} />}
            />
          </DiscloseGroup>
        </div>

        <footer className="sheet-foot">
          <span className="muted mono">
            {p.notice ? 'Notice drafted' : 'No notice'} · {secs(p.now - a.createdAt, 0)} on the desk
          </span>
          <span className="sheet-actions">
            <button type="button" className="ghost" onClick={() => p.onInspect('trace')} title="Open the trace in the Inspector">
              Trace
            </button>
            <button type="button" className="ghost" onClick={() => p.onInspect('notice')} title="Open the notice in the Inspector">
              Notice
            </button>
            <button
              type="button"
              className="ghost"
              onClick={openMore}
              aria-expanded={moreOpen}
              aria-controls={`${MORE_ID}-detail`}
              title="Lender verdicts, bureau facts and the notice, in this sheet"
            >
              More
            </button>
            {canDecide && (
              <>
                <button type="button" className="decline-pill" onClick={p.onDecline}>
                  Decline
                </button>
                <button type="button" className="approve-pill" disabled={!sel} onClick={() => sel && p.onApprove(sel._id)}>
                  {sel ? `Approve ${LENDERS.find((l) => l.id === sel.lender)?.label} at ${sel.apr!.toFixed(2)}%` : 'No offer to approve'}
                </button>
              </>
            )}
          </span>
        </footer>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- look before you act */

function moreGlance(kind: string, offered: number, counter: number, declined: number, answered: number, total: number, hasNotice: boolean): string {
  const tail = hasNotice ? 'the reasons, the bureau facts and the notice text are here' : 'the reasons and the bureau facts are here'
  if (kind === 'hard') return `Look before you act: rules stopped this file before any lender was asked; the bureau facts are here.`
  if (kind === 'running') return `Look before you act: ${answered} of ${total} lenders have answered so far; ${tail}.`
  return `Look before you act: ${plural(offered, 'offer')}, ${plural(counter, 'counteroffer')}, ${declined} declined; ${tail}.`
}

function LenderVerdicts({ lines }: { lines: LenderLine[] }) {
  return (
    <ul className="verdicts">
      {lines.map((l) => {
        const o = l.offer
        const approve = o?.status === 'done' && o.decision === 'approve'
        return (
          <li className="verdict" key={l.lender}>
            <div className="verdict-head">
              <span className="verdict-lender">{l.name}</span>
              <span className={`verdict-word w-${l.word.toLowerCase().replace(/\s+/g, '-')}`}>{l.word}</span>
              {approve && o && (
                <span className="verdict-terms">
                  {o.apr!.toFixed(2)}% · {usd(o.amount)} · {o.termMonths} mo{l.monthly != null ? ` · ${usd(l.monthly)}/mo` : ''}
                </span>
              )}
              {o?.latencyMs != null && <span className="verdict-meta">answered in {secs(o.latencyMs)}</span>}
            </div>
            <p className="verdict-cond">{l.sentence}</p>
            {o && o.conditions.length > 0 && <p className="verdict-cond">Conditions: {o.conditions.join('; ')}</p>}
            {l.reasons.length > 0 ? (
              <ol className="verdict-reasons">
                {l.reasons.map((r, i) => (
                  <li key={i}>
                    <span className="verdict-field">{r.label}</span>
                    <span className="verdict-text">{r.text}</span>
                    {r.verdict && (
                      <span className={`verdict-check check-${r.verdict === 'verified' ? 'verified' : r.verdict === 'did not flip' ? 'unsupported' : 'pending'}`}>
                        Counterfactual test: {verdictSentence(r.verdict)}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              o?.status === 'done' && !approve && <p className="verdict-none">No reasons recorded.</p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function verdictSentence(v: LenderLine['reasons'][number]['verdict']): string {
  switch (v) {
    case 'verified':
      return 'verified, changing this fact flips the decision'
    case 'did not flip':
      return 'did not flip, the decision held when this fact changed'
    case 'testing':
      return 'testing'
    default:
      return 'not tested'
  }
}

/* ---------------------------------------------------------------- notice */

function noticeBlock(notice: Notice | undefined, offers: Offer[], decision: Decision | undefined, a: Applicant): { summary: string; detail: ReactNode; tone: DiscloseTone } {
  const req = noticeRequired(offers, decision)
  if (notice) {
    const required = notice.required ?? req.required
    const because = notice.requiredBecause ?? req.why
    const summary = required
      ? `Adverse-action notice drafted: required because ${because}. Read it before declining.`
      : `Adverse-action notice drafted although not required (${because}). Read it before declining.`
    const items: KVItem[] = [
      { label: 'Required', value: required ? 'Yes' : 'No' },
      { label: 'Because', value: because },
      { label: 'Lenders declined', value: notice.lendersDeclined.length ? notice.lendersDeclined.map(lenderLabel).join(', ') : 'None listed' },
      { label: 'Drafted', value: when(notice.createdAt) },
    ]
    const dropped = notice.droppedReasons ?? []
    return {
      tone: 'info',
      summary,
      detail: (
        <>
          <KV items={items} />
          <pre className="notice-text">{notice.text}</pre>
          {dropped.length > 0 && (
            <>
              <h4 className="more-h">Reasons compliance withheld</h4>
              <p className="facts-note">
                {plural(dropped.length, 'reason')} did not flip the decision under the counterfactual test, so the notice leaves {dropped.length === 1 ? 'it' : 'them'} out.
              </p>
              <ul className="dropped">
                {dropped.map((d, i) => (
                  <li key={i}>
                    <span className="verdict-field">{reasonLabel(d.field)}</span>
                    {lenderLabel(d.lender)}: {d.text}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ),
    }
  }
  if (a.status === 'hard_stop') {
    return {
      tone: 'muted',
      summary: 'No notice: a hard stop is not a credit decision, so no adverse-action notice is sent.',
      detail: <p className="facts-note">The file stopped at a deterministic guardrail before any lender read it. Nothing was denied, so ECOA does not call for a notice.</p>,
    }
  }
  if (req.required) {
    return {
      tone: 'info',
      summary: `Adverse-action notice pending: ${req.why}; compliance drafts it once the reason checks finish.`,
      detail: <p className="facts-note">The notice will carry only reasons the counterfactual test verified, plus the bureau source statement.</p>,
    }
  }
  return {
    tone: 'muted',
    summary: `No adverse-action notice needed: ${req.why}.`,
    detail: <p className="facts-note">A notice is required only when a lender denies the requested terms or a counteroffer is not accepted.</p>,
  }
}

/* ---------------------------------------------------------------- trace */

function traceGlance(a: Applicant, events: AuditEvent[], offers: Offer[], notice: Notice | undefined, decision: Decision | undefined, now: number): string {
  if (events.length === 0) return 'No pipeline events recorded yet.'
  const steps = stepTimings(a, events)
  const by = Object.fromEntries(steps.map((s) => [s.id, s])) as Record<(typeof steps)[number]['id'], (typeof steps)[number]>
  const dur = (s: { startedAt: number | null; finishedAt: number | null }) =>
    s.startedAt != null && s.finishedAt != null ? secs(s.finishedAt - s.startedAt) : '—'
  const parts: string[] = []

  const pull = by.pull
  if (pull.state === 'done') parts.push(`pulled the file in ${dur(pull)}`)
  else if (pull.state === 'running' && pull.startedAt != null) parts.push(`pulling the file (${secs(now - pull.startedAt, 0)} so far)`)
  else parts.push('waiting to pull the file')

  const g = by.guardrails
  if (g.state === 'failed') parts.push('rules stopped it')
  else if (g.state === 'done') parts.push('rules passed')
  else if (g.state === 'running') parts.push('rules running')

  const u = by.underwrite
  const answered = offers.filter((o) => o.status !== 'pending').length
  if (u.state === 'done') parts.push(`${plural(answered, 'lender')} answered in ${dur(u)}`)
  else if (u.state === 'running') parts.push(`${answered} of ${LENDERS.length} lenders have answered`)
  else if (u.state === 'skipped') parts.push('no lender was asked')

  const c = by.compliance
  if (c.state === 'done') parts.push(notice ? 'compliance drafted a notice' : 'compliance found no notice needed')
  else if (c.state === 'running') parts.push('compliance is drafting')

  const h = by.human
  if (decision && decision.outcome !== 'hard_stop') parts.push(`you ${decision.outcome} it ${secs(now - decision.at, 0)} ago`)
  else if (h.state === 'running' && h.startedAt != null) parts.push(`waiting on you for ${secs(now - h.startedAt, 0)}`)
  else if (h.state === 'done') parts.push('decided')

  return sentence(parts)
}

const STEP_WORD: Record<StepState, string> = {
  queued: 'Queued',
  running: 'Running',
  done: 'Done',
  failed: 'Stopped',
  skipped: 'Skipped',
}

function actorWord(actor: Actor): string {
  if (actor.startsWith('underwriter:')) return `${lenderLabel(actor.slice('underwriter:'.length))} underwriter`
  switch (actor) {
    case 'intake':
      return 'Intake'
    case 'desk':
      return 'Desk'
    case 'crs':
      return 'Bureau pull'
    case 'rules':
      return 'Rules'
    case 'compliance':
      return 'Compliance'
    case 'human':
      return 'Loan officer'
    case 'applicant':
      return 'Applicant'
    default:
      return actor
  }
}

/** Audit refs as words: bureau fields get their label, offers their lender; ids are never printed. */
function refWord(ref: string | null): ReactNode {
  const w = refWords(ref)
  return w ? <span className="verdict-field">{w}</span> : null
}

const STEP_TITLE: Record<string, string> = { pull: 'Pull', guardrails: 'Guardrails', underwrite: 'Underwrite', compliance: 'Compliance', human: 'Human' }

function groupEvents(events: AuditEvent[]): Array<{ title: string; rows: AuditEvent[] }> {
  const sorted = events.slice().sort((x, y) => x.at - y.at)
  const groups: Array<{ title: string; rows: AuditEvent[] }> = []
  let cur = { title: 'Intake', rows: [] as AuditEvent[] }
  for (const e of sorted) {
    const m = /^step\.(\w+)\.start$/.exec(e.action)
    if (m) {
      if (cur.rows.length) groups.push(cur)
      cur = { title: STEP_TITLE[m[1]] ?? m[1], rows: [] }
    }
    cur.rows.push(e)
  }
  if (cur.rows.length) groups.push(cur)
  return groups
}

function TraceDetail({ a, events, offers, checks }: { a: Applicant; events: AuditEvent[]; offers: Offer[]; checks: ReasonCheck[] }) {
  const steps = stepTimings(a, events)
  const groups = groupEvents(events)
  const lenderOf = (offerId: string) => {
    const o = offers.find((x) => x._id === offerId)
    return o ? lenderLabel(o.lender) : 'Unknown lender'
  }
  return (
    <>
      <table className="sheet-table">
        <caption>Steps</caption>
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col">State</th>
            <th scope="col">Started</th>
            <th scope="col" className="num">
              Took
            </th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s) => (
            <tr key={s.id}>
              <td>{s.label}</td>
              <td className={`word ${s.state === 'failed' ? 'flag-bad' : s.state === 'done' ? 'flag-good' : ''}`}>{STEP_WORD[s.state]}</td>
              <td>{s.startedAt != null ? <Mono>{clockMs(s.startedAt)}</Mono> : '—'}</td>
              <td className="num">{s.startedAt != null && s.finishedAt != null ? secs(s.finishedAt - s.startedAt) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {groups.map((g) => (
        <div key={g.title}>
          <h5 className="trace-group-h">{g.title}</h5>
          <ol className="trace-rows">
            {g.rows.map((e) => (
              <li className={`trace-row ${e.action === 'rules.hard_stop' || e.action === 'hard_stop' ? 'is-stop' : ''}`} key={e._id}>
                <span className="t">{clockMs(e.at)}</span>
                <span className="who">{actorWord(e.actor)}</span>
                <span className="what">
                  <span className="act">{actionWords(e.action)}</span>
                  {refWord(e.ref)}
                </span>
                {e.note && <span className="note">{e.note}</span>}
              </li>
            ))}
          </ol>
        </div>
      ))}

      {checks.length > 0 && (
        <table className="sheet-table" style={{ marginTop: 16 }}>
          <caption>Counterfactual checks ({checks.length})</caption>
          <thead>
            <tr>
              <th scope="col">Lender</th>
              <th scope="col">Fact</th>
              <th scope="col">Tested</th>
              <th scope="col">Result</th>
              <th scope="col" className="num">
                Took
              </th>
            </tr>
          </thead>
          <tbody>
            {checks
              .slice()
              .sort((x, y) => x.createdAt - y.createdAt)
              .map((c) => (
                <tr key={c._id}>
                  <td>{lenderOf(c.offerId)}</td>
                  <td>{reasonLabel(c.field)}</td>
                  <td>
                    <Mono>{String(c.original)}</Mono> → <Mono>{String(c.counterfactual)}</Mono>
                  </td>
                  <td className={`word ${c.flipped ? 'flag-good' : ''}`}>{c.flipped ? 'Flipped the decision' : 'Did not flip'}</td>
                  <td className="num">{c.latencyMs} ms</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </>
  )
}
