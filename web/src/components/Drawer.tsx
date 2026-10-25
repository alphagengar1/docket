import { useState, type ReactNode } from 'react'
import type { Applicant, AuditEvent, EvalRun, StepId } from '../types'
import { LENDERS, PIPELINE_STEPS } from '../types'
import { clock, clockMs, pct } from '../lib/format'
import { newestFirst } from '../lib/select'
import { FIELD_LABELS, fieldLabel } from '../../../convex/labels'
import { actionWords, asSentence, scrubModelText, refWords as sharedRefWords } from '../lib/auditWords'
import { reasonLabel } from './ReasonList'
import { ACTOR_COLOR } from './Inspector'
import { Disclose, DiscloseGroup, KV, Mono } from './Disclose'
import '../styles/drawer.css'

export type DrawerTab = 'audit' | 'eval'

interface Props {
  events: AuditEvent[]
  applicants: Applicant[]
  selectedId: string | null
  evalRuns: EvalRun[]
  evalCases: number
  onRunEval: () => Promise<void>
  /** Closes the drawer's slot (the rail also toggles it). */
  onClose: () => void
  /** Opens the assistant with a summary of the selected applicant. */
  onAsk: () => void
}

/** Audit log as one sentence per pipeline step (open for the raw rows); eval as one sentence (open for every stat). */
export function Drawer({ events, applicants, selectedId, evalRuns, evalCases, onRunEval, onClose, onAsk }: Props) {
  const [tab, setTab] = useState<DrawerTab>('audit')
  const open = true
  const [scope, setScope] = useState<'this' | 'all'>('all')
  const [running, setRunning] = useState(false)

  const run = async () => {
    setRunning(true)
    try {
      await onRunEval()
    } finally {
      setRunning(false)
    }
  }

  const names = new Map(applicants.map((a) => [a._id, a.name]))
  const rows = newestFirst(scope === 'this' && selectedId ? events.filter((e) => e.applicantId === selectedId) : events).slice(0, 400)
  const last = evalRuns.slice().sort((a, b) => b.startedAt - a.startedAt)[0]

  return (
    <section className="drawer" aria-label="Audit log and eval">
      <div className="drawer-bar">
        <div role="tablist" style={{ display: 'flex', gap: 2 }}>
          <button type="button" role="tab" className="tab" aria-selected={tab === 'audit'} onClick={() => { setTab('audit')}}>
            Audit log <span className="chip">{events.length}</span>
          </button>
          <button type="button" role="tab" className="tab" aria-selected={tab === 'eval'} onClick={() => { setTab('eval')}}>
            Eval{' '}
            {last && (
              <span className={`chip ${last.finishedAt == null ? '' : last.agreement >= AGREEMENT_MIN ? 'tone-approve' : 'tone-decline'}`}>
                {last.finishedAt == null ? 'running' : `${pct(last.agreement)} ${last.agreement >= AGREEMENT_MIN ? 'pass' : 'fail'}`}
              </span>
            )}
          </button>
        </div>
        {selectedId && (
          <button type="button" className="link ast-link" onClick={onAsk}>
            Ask the assistant to summarize
          </button>
        )}
        <span style={{ flex: 1 }} />
        {tab === 'audit' && open && (
          <button type="button" className="ghost tab" onClick={() => setScope((s) => (s === 'all' ? 'this' : 'all'))} disabled={!selectedId}>
            {scope === 'all' ? 'All applicants' : 'This applicant'}
          </button>
        )}
        {tab === 'eval' && open && (
          <button type="button" className="tab" onClick={run} disabled={running} style={{ border: '1px solid var(--hair-2)' }}>
            {running ? 'Running…' : 'Run eval'}
          </button>
        )}
        <button type="button" className="ghost tab" onClick={onClose}>
          Close
        </button>
      </div>
      {open && (
        <div className="drawer-body">
          {tab === 'audit' && <AuditLog rows={rows} names={names} selectedId={selectedId} showNames={scope === 'all' || !selectedId} />}
          {tab === 'eval' && <EvalPanel last={last} cases={evalCases} running={running} />}
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ audit log */

type GroupId = StepId | 'other'

const GROUP_TITLE: Record<GroupId, string> = {
  pull: 'Pull: bureau file',
  guardrails: 'Guardrails: hard-stop rules',
  underwrite: 'Underwrite: five lenders',
  compliance: 'Compliance: adverse-action notice',
  human: 'Human: loan officer',
  other: 'Other events',
}

/** Which pipeline step an audit action belongs to. Reason verification is part of underwriting. */
function groupOf(action: string): GroupId {
  const m = /^step\.([a-z]+)\./.exec(action)
  if (m) {
    if (m[1] === 'verify') return 'underwrite'
    if ((PIPELINE_STEPS as readonly { id: string }[]).some((s) => s.id === m[1])) return m[1] as StepId
  }
  if (/^(intake|replay|crs|dispute)\./.test(action)) return 'pull'
  if (/^rules\./.test(action)) return 'guardrails'
  if (/^(underwrite|verify)\./.test(action)) return 'underwrite'
  if (/^compliance\./.test(action)) return 'compliance'
  if (/^(notice|offer|override|desk)\./.test(action)) return 'human'
  return 'other'
}

const ACTOR_WORD: Record<string, string> = {
  intake: 'Intake',
  desk: 'Desk',
  crs: 'Bureau',
  rules: 'Rules',
  'underwriter:cu': 'Credit Union',
  'underwriter:fintech': 'Fintech',
  'underwriter:prime': 'Prime',
  'underwriter:regional': 'Regional',
  'underwriter:subprime': 'Second Chance',
  compliance: 'Compliance',
  human: 'Loan officer',
  applicant: 'Borrower',
}

const BAD = /hard_stop|failed|blocked|unsupported|error|unverified/

const lenderLabel = (id: string) => LENDERS.find((l) => l.id === id)?.label ?? id

/** Raw field paths become their plain labels; the bureau score is never called by its brand name. */
function plainNote(note: string): string {
  let out = note
  for (const key of Object.keys(FIELD_LABELS)) {
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`\\b(?:credit\\.)?${esc}\\b`, 'g'), fieldLabel(key))
  }
  out = out.replace(/\bfico\s?9?\b/gi, 'TransUnion score')
  return scrubModelText(out)
}

/** Reference column: field paths become labels; ids (Convex or mock) are never printed. */
function refWords(e: AuditEvent): string | null {
  return sharedRefWords(e.ref)
}

const ms = (n: number) => (n < 1000 ? `${Math.round(n)} ms` : `${(n / 1000).toFixed(1)} s`)

interface StepRun {
  key: string
  applicantId: string
  group: GroupId
  events: AuditEvent[] // oldest first
  newest: number
}

/** One row per (applicant, step). Events arrive newest first and are grouped without reordering applicants. */
function stepRuns(rows: AuditEvent[]): StepRun[] {
  const byKey = new Map<string, StepRun>()
  for (const e of rows) {
    const group = groupOf(e.action)
    const key = `${e.applicantId}:${group}`
    let run = byKey.get(key)
    if (!run) {
      run = { key, applicantId: e.applicantId, group, events: [], newest: e.at }
      byKey.set(key, run)
    }
    run.events.push(e)
    if (e.at > run.newest) run.newest = e.at
  }
  for (const run of byKey.values()) run.events.sort((a, b) => a.at - b.at)
  return [...byKey.values()].sort((a, b) => b.newest - a.newest)
}

interface Glance {
  text: string
  tone: 'info' | 'good' | 'bad' | 'human' | 'muted'
  meta: string
}

/** The one plain-English sentence a loan officer reads for a step. */
function glanceOf(run: StepRun): Glance {
  const ev = run.events
  const find = (a: string | RegExp) => ev.find((e) => (typeof a === 'string' ? e.action === a : a.test(e.action)))
  const count = (a: string | RegExp) => ev.filter((e) => (typeof a === 'string' ? e.action === a : a.test(e.action))).length
  const start = find(/^step\.[a-z]+\.start$/)
  const done = find(/^step\.[a-z]+\.(done|skipped)$/)
  const took = start && done ? ms(done.at - start.at) : null
  const span = took ? ` in ${took}` : ''
  const meta = took ?? `${ev.length} ${ev.length === 1 ? 'event' : 'events'}`
  const bad = ev.some((e) => BAD.test(e.action))

  switch (run.group) {
    case 'pull': {
      const pullDone = find('step.pull.done')
      const src = /source=(\w+)/.exec(pullDone?.note ?? '')?.[1]
      const from = src === 'crs' ? 'the bureau sandbox' : src ? 'the mock bureau' : 'the bureau'
      if (find('crs.error')) return { text: `bureau pull failed, fell back to mock data${span}`, tone: 'bad', meta }
      if (find('dispute.tradeline')) return { text: `borrower disputed a tradeline; a replay was started`, tone: 'info', meta }
      if (pullDone) return { text: `pulled the credit file from ${from}${span}`, tone: 'good', meta }
      if (start) return { text: 'pulling the credit file…', tone: 'muted', meta }
      if (find(/^(intake|replay)\./)) return { text: find(/^replay\./) ? 'replay started from a disputed file' : 'application received', tone: 'info', meta }
      break
    }
    case 'guardrails': {
      const stops = ev.filter((e) => e.action === 'rules.hard_stop')
      if (stops.length) {
        const first = reasonLabel(stops[0].ref ?? '')
        const more = stops.length > 1 ? ` and ${stops.length - 1} more rule${stops.length > 2 ? 's' : ''}` : ''
        return { text: `hard stop on ${first}${more}; no lender saw this file`, tone: 'bad', meta }
      }
      if (find('rules.pass') || /passed/.test(done?.note ?? '')) return { text: `passed every hard-stop rule${span}`, tone: 'good', meta }
      if (start) return { text: 'checking hard-stop rules…', tone: 'muted', meta }
      break
    }
    case 'underwrite': {
      const offers = count('underwrite.approve')
      const declines = count('underwrite.decline')
      const failed = count('underwrite.failed')
      const uDone = find('step.underwrite.done')
      const answered = offers + declines + failed
      const parts: string[] = []
      if (uDone) {
        const uStart = find('step.underwrite.start')
        const uSpan = uStart ? ` in ${ms(uDone.at - uStart.at)}` : ''
        const m = /(\d+) approve \((\d+) counteroffer\), (\d+) decline, (\d+) failed/.exec(uDone.note)
        const o = m ? Number(m[1]) : offers
        const c = m ? Number(m[2]) : 0
        const d = m ? Number(m[3]) : declines
        const f = m ? Number(m[4]) : failed
        parts.push(
          `${o + d + f} of ${LENDERS.length} lenders answered${uSpan}: ${o} offer${o === 1 ? '' : 's'}${c ? ` (${c} counter)` : ''}, ${d} decline${d === 1 ? '' : 's'}${f ? `, ${f} did not answer` : ''}`,
        )
      } else if (answered) {
        parts.push(`${answered} of ${LENDERS.length} lenders answered so far: ${offers} offer${offers === 1 ? '' : 's'}, ${declines} decline${declines === 1 ? '' : 's'}`)
      } else if (start) {
        parts.push(`${LENDERS.length} lenders are reading the file…`)
      }
      const vDone = find('step.verify.done')
      const supported = count('verify.supported')
      const unsupported = count('verify.unsupported')
      if (vDone) {
        const m = /(\d+) reasons tested: (\d+) flipped/.exec(vDone.note)
        const tested = m ? Number(m[1]) : supported + unsupported
        const held = m ? Number(m[2]) : supported
        parts.push(`${held} of ${tested} decline reason${tested === 1 ? '' : 's'} held up`)
      } else if (supported + unsupported) {
        parts.push(`${supported} of ${supported + unsupported} decline reasons held up so far`)
      }
      if (parts.length) {
        const tone = uDone && failed === 0 && (declines > 0 || offers > 0) ? 'good' : failed > 0 ? 'bad' : uDone ? 'good' : 'muted'
        return { text: parts.join('; '), tone, meta }
      }
      break
    }
    case 'compliance': {
      const skipped = find('step.compliance.skipped')
      if (skipped) return { text: `no adverse-action notice needed: ${plainNote(skipped.note)}`, tone: 'good', meta }
      if (find('compliance.failed') && !find('compliance.notice')) return { text: `notice drafting failed${span}`, tone: 'bad', meta }
      const notice = find('compliance.notice')
      if (notice || find('step.compliance.done')) {
        const withheld = /(\d+) unsupported reason/.exec(done?.note ?? notice?.note ?? '')?.[1]
        const kept = find('compliance.unverified_reasons_used')
        const tail = kept ? '; a lender kept unverified reasons' : withheld && Number(withheld) > 0 ? `; ${withheld} unsupported reason${withheld === '1' ? '' : 's'} withheld` : ''
        return { text: `adverse-action notice drafted${span}${tail}`, tone: kept ? 'bad' : 'good', meta }
      }
      if (start) return { text: 'drafting the adverse-action notice…', tone: 'muted', meta }
      break
    }
    case 'human': {
      const hDone = find('step.human.done')
      const blocked = ev.filter((e) => e.action === 'override.blocked')
      if (hDone) {
        const m = /^approved (\w+) offer: \$(\S+) at (\S+)% for (\d+) months(?: — (.*))?$/.exec(hDone.note)
        if (m) return { text: `loan officer approved the ${lenderLabel(m[1])} offer: $${m[2]} at ${m[3]}% for ${m[4]} months${m[5] ? ` — ${m[5]}` : ''}`, tone: 'good', meta }
        if (/^declined/.test(hDone.note)) return { text: `loan officer ${plainNote(hDone.note)}`, tone: 'bad', meta }
        return { text: `loan officer finished: ${plainNote(hDone.note)}`, tone: 'human', meta }
      }
      if (find('notice.approved')) return { text: 'loan officer signed the adverse-action notice', tone: 'good', meta }
      if (blocked.length) return { text: `override refused ${blocked.length === 1 ? 'once' : `${blocked.length} times`}: the hard stop is a coded rule`, tone: 'bad', meta }
      if (find('desk.error')) return { text: 'the pipeline errored; the file went to a loan officer', tone: 'bad', meta }
      const chosen = find('offer.chosen')
      if (chosen) {
        const m = /^chose (\w+): (.*?); /.exec(chosen.note)
        return { text: m ? `borrower chose the ${lenderLabel(m[1])} offer (${m[2]}); waiting on a loan officer` : 'borrower chose an offer; waiting on a loan officer', tone: 'human', meta }
      }
      if (start) return { text: 'waiting on a loan officer', tone: 'human', meta }
      break
    }
  }
  const newest = ev[ev.length - 1]
  return { text: `${actionWords(newest.action).toLowerCase()}${newest.note ? `: ${plainNote(newest.note)}` : ''}`, tone: bad ? 'bad' : 'info', meta }
}

function AuditLog({ rows, names, selectedId, showNames }: { rows: AuditEvent[]; names: Map<string, string>; selectedId: string | null; showNames: boolean }) {
  if (rows.length === 0) return <div className="dr-empty">No events yet.</div>
  const runs = stepRuns(rows)
  const order: GroupId[] = [...PIPELINE_STEPS.map((s) => s.id), 'other']
  return (
    <div className="dr-audit">
      {order.map((g) => {
        const inGroup = runs.filter((r) => r.group === g)
        if (inGroup.length === 0) return null
        return (
          <DiscloseGroup key={g} title={GROUP_TITLE[g]}>
            {inGroup.map((run) => {
              const glance = glanceOf(run)
              const first = run.events[0]
              const hi = run.applicantId === selectedId
              return (
                <Disclose
                  key={run.key}
                  id={`audit-${run.key}`}
                  tone={glance.tone}
                  className={hi ? 'dr-hi' : undefined}
                  meta={<Mono>{clock(first.at)} · {glance.meta}</Mono>}
                  summary={
                    showNames ? (
                      <>
                        <span className="dr-who">{names.get(run.applicantId) ?? 'Applicant'}:</span>{asSentence(glance.text)}
                      </>
                    ) : (
                      asSentence(glance.text)
                    )
                  }
                  detail={<StepRows events={run.events} />}
                />
              )
            })}
          </DiscloseGroup>
        )
      })}
    </div>
  )
}

/** The raw rows for one step: exact time with ms, who, what, a reference word, the note, and the gap since the previous row. */
function StepRows({ events }: { events: AuditEvent[] }) {
  return (
    <table className="dr-rows">
      <thead>
        <tr>
          <th scope="col">Time</th>
          <th scope="col">Actor</th>
          <th scope="col">Action</th>
          <th scope="col">Note</th>
          <th scope="col" style={{ textAlign: 'right', paddingRight: 0 }}>+ms</th>
        </tr>
      </thead>
      <tbody>
        {events.map((e, i) => {
          const ref = refWords(e)
          const gap = i === 0 ? null : e.at - events[i - 1].at
          return (
            <tr key={e._id}>
              <td className="dr-time">{clockMs(e.at)}</td>
              <td className="dr-actor" style={{ ['--actor' as string]: ACTOR_COLOR[e.actor] }}>
                {ACTOR_WORD[e.actor] ?? e.actor}
              </td>
              <td className="dr-action">
                {actionWords(e.action)}
                {ref && <span className="dr-ref">{ref}</span>}
              </td>
              <td className="dr-note">{plainNote(e.note) || '—'}</td>
              <td className="dr-ms">{gap == null ? '' : `+${gap}`}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* ------------------------------------------------------------------ eval */

const AGREEMENT_MIN = 0.9
const REASONS_MIN = 2
const VERIFIED_MIN = 0.8

const OUTCOME_WORD: Record<string, string> = { approve: 'approve', decline: 'decline', hard_stop: 'hard stop' }
const outcomeWord = (s: string) => OUTCOME_WORD[s] ?? s.replace(/_/g, ' ')

function Verdict({ ok }: { ok: boolean | null }) {
  if (ok == null) return <span className="dr-verdict pending">Pending</span>
  return <span className={`dr-verdict ${ok ? 'pass' : 'fail'}`}>{ok ? 'Pass' : 'Fail'}</span>
}

function Stat({ value, threshold, ok }: { value: ReactNode; threshold: string; ok: boolean | null }) {
  return (
    <>
      <span className="dr-stat-v">{value}</span>
      <span className="dr-stat-th">{threshold}</span>
      <Verdict ok={ok} />
    </>
  )
}

function EvalPanel({ last, cases, running }: { last: EvalRun | undefined; cases: number; running: boolean }) {
  const pending = !last || last.finishedAt == null || running
  const sk = (w: number) => <span className="dr-skel" style={{ width: w }} aria-hidden="true" />
  const n = last ? last.cases : cases

  if (pending) {
    return (
      <div className="dr-eval">
        <div className="dr-eval-head">
          <span className="dr-big">{sk(72)}</span>
          <span className="dr-k">{last || running ? `Eval running on ${n} cases…` : `No eval run yet · ${n} cases ready`}</span>
        </div>
        <Disclose
          tone="muted"
          summary={last || running ? `Eval is running: ${n} cases are being scored against the answer key…` : `Eval has not run yet. Press Run eval to score ${n} cases against the answer key.`}
          meta={<Mono>{last || running ? 'running' : 'idle'}</Mono>}
          detail={
            <KV
              items={[
                { label: 'Agreement', value: <Stat value={sk(40)} threshold={`threshold ≥ ${pct(AGREEMENT_MIN)}`} ok={null} /> },
                { label: 'Fraud personas', value: <Stat value={sk(40)} threshold="must get zero offers" ok={null} /> },
                { label: 'Reasons per denial', value: <Stat value={sk(40)} threshold={`threshold ≥ ${REASONS_MIN}`} ok={null} /> },
                { label: 'Reasons verified', value: <Stat value={sk(40)} threshold={`threshold ≥ ${pct(VERIFIED_MIN)}`} ok={null} /> },
                { label: 'Cases', value: <Mono>{n}</Mono> },
              ]}
            />
          }
        />
      </div>
    )
  }

  const agree = Math.round(last.agreement * last.cases)
  const fails = last.failures.length
  const agreementOk = last.agreement >= AGREEMENT_MIN
  const reasonsOk = last.avgReasonsPerDenial >= REASONS_MIN
  const verifiedOk = last.reasonsVerified == null ? null : last.reasonsVerified >= VERIFIED_MIN
  const allOk = agreementOk && last.fraudZeroOffers && reasonsOk && verifiedOk !== false && fails === 0
  const started = clock(last.startedAt)
  const finished = last.finishedAt != null ? clock(last.finishedAt) : null
  const took = last.finishedAt != null ? ms(last.finishedAt - last.startedAt) : null

  const sentence = `Eval: ${agree} of ${last.cases} cases agree; fraud personas got ${last.fraudZeroOffers ? 'zero offers' : 'an offer'}; ${fails === 0 ? 'no failures' : `${fails} failure${fails === 1 ? '' : 's'}`}.`

  return (
    <div className="dr-eval">
      <div className="dr-eval-head">
        <span className="dr-big">{pct(last.agreement)}</span>
        <span className="dr-k">agreement · {last.cases} cases · {allOk ? 'all checks pass' : 'a check failed'}</span>
      </div>
      <DiscloseGroup title="Eval run">
        <Disclose
          id="eval-stats"
          tone={allOk ? 'good' : 'bad'}
          summary={sentence}
          meta={<Mono>{started}</Mono>}
          detail={
            <KV
              items={[
                {
                  label: 'Agreement',
                  value: <Stat value={`${pct(last.agreement)} (${agree} of ${last.cases})`} threshold={`threshold ≥ ${pct(AGREEMENT_MIN)}`} ok={agreementOk} />,
                },
                {
                  label: 'Fraud personas',
                  value: <Stat value={last.fraudZeroOffers ? 'Zero offers' : 'Got an offer'} threshold="must get zero offers" ok={last.fraudZeroOffers} />,
                },
                {
                  label: 'Reasons per denial',
                  value: <Stat value={last.avgReasonsPerDenial.toFixed(2)} threshold={`threshold ≥ ${REASONS_MIN}`} ok={reasonsOk} />,
                },
                {
                  label: 'Reasons verified',
                  value: (
                    <Stat
                      value={last.reasonsVerified == null ? 'Not measured' : pct(last.reasonsVerified)}
                      threshold={`by counterfactual, threshold ≥ ${pct(VERIFIED_MIN)}`}
                      ok={verifiedOk}
                    />
                  ),
                },
                { label: 'Failures', value: <Stat value={String(fails)} threshold="threshold 0" ok={fails === 0} /> },
                {
                  label: 'Run',
                  value: (
                    <>
                      started <Mono>{started}</Mono>
                      {finished && (
                        <>
                          , finished <Mono>{finished}</Mono>
                        </>
                      )}
                      {took && <> ({took})</>}, {last.cases} cases
                    </>
                  ),
                },
              ]}
            />
          }
        />
        <Disclose
          id="eval-failures"
          tone={fails === 0 ? 'good' : 'bad'}
          summary={
            fails === 0
              ? `No failures: every one of the ${last.cases} cases matched the answer key.`
              : fails === 1
                ? `1 failure: persona ${last.failures[0].personaId} expected ${outcomeWord(last.failures[0].expected)}, got ${outcomeWord(last.failures[0].got)}.`
                : `${fails} failures: ${last.failures.map((f) => f.personaId).join(', ')} did not match the answer key.`
          }
          meta={<Mono>{fails === 0 ? '0 failed' : `${fails} failed`}</Mono>}
          detail={
            fails === 0 ? (
              <p>Every persona's outcome matched the expected decision.</p>
            ) : (
              <ul className="dr-failures">
                {last.failures.map((f, i) => (
                  <li key={i}>
                    <div className="dr-fail-line">
                      <Mono>{f.personaId}</Mono>
                      <span className="dr-fail-word">expected {outcomeWord(f.expected)}</span>
                      <span className="dr-fail-word got">got {outcomeWord(f.got)}</span>
                    </div>
                    <div className="dr-fail-why">{f.why}</div>
                  </li>
                ))}
              </ul>
            )
          }
        />
      </DiscloseGroup>
    </div>
  )
}
