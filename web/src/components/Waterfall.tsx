// Respan-style waterfall: one span row per pipeline step, lender fan-out as nested child rows,
// bars positioned on a shared time axis that grow while a step runs. One color per actor.
import type { Applicant, Offer, ReasonCheck } from '../types'
import { LENDERS } from '../types'
import type { StepTiming } from '../lib/select'
import { secs } from '../lib/format'

interface Props {
  applicant: Applicant | undefined
  steps: StepTiming[]
  offers: Offer[]
  checks: ReasonCheck[]
  now: number
}

interface Row {
  key: string
  name: string
  metric: string
  state: StepTiming['state']
  start: number | null
  end: number | null
  color: string
  child?: boolean
}

export function Waterfall({ applicant, steps, offers, checks, now }: Props) {
  const t0 = applicant?.createdAt ?? null
  const rows: Row[] = []
  const stepBy = (id: string) => steps.find((s) => s.id === id)!
  const color: Record<string, string> = {
    pull: 'var(--actor-crs)',
    guardrails: 'var(--actor-rules)',
    underwrite: 'var(--actor-desk)',
    compliance: 'var(--actor-compliance)',
    human: 'var(--actor-human)',
  }
  const dur = (s: StepTiming) => (s.startedAt == null ? null : (s.finishedAt ?? now) - s.startedAt)
  const metric = (s: StepTiming) => {
    const d = dur(s)
    switch (s.id) {
      case 'pull':
        return d == null ? 'crs · prequal, idv, fraud' : `${secs(d, 2)} · crs`
      case 'guardrails':
        return d == null ? 'rules.ts' : s.state === 'failed' ? `${secs(d, 2)} · hard stop` : `${secs(d, 2)} · 0 rules fired`
      case 'underwrite':
        return d == null ? `${LENDERS.length} policies in parallel` : `${secs(d, 2)} · ${offers.filter((o) => o.status === 'done').length}/${LENDERS.length} done`
      case 'compliance': {
        const n = checks.length
        return d == null ? 'notice + reason tests' : `${secs(d, 2)} · ${checks.filter((c) => c.flipped).length}/${n} reasons verified`
      }
      case 'human':
        return d == null ? 'loan officer' : s.finishedAt ? `${secs(d, 1)} · decided` : `${secs(d, 1)} · waiting`
    }
  }
  for (const s of steps) {
    rows.push({ key: s.id, name: s.label, metric: metric(s), state: s.state, start: s.startedAt, end: s.finishedAt, color: color[s.id] })
    if (s.id === 'underwrite') {
      for (const l of LENDERS) {
        const o = offers.find((x) => x.lender === l.id)
        const start = o?.createdAt ?? null
        const end = o && o.status !== 'pending' && o.latencyMs != null ? o.createdAt + o.latencyMs : null
        const state: StepTiming['state'] = !o ? (s.state === 'skipped' ? 'skipped' : 'queued') : o.status === 'pending' ? 'running' : 'done'
        const word = !o || o.status === 'pending' ? 'quoting' : o.classification ?? o.decision ?? ''
        const met = !o ? l.name : o.status === 'pending' ? `${secs(now - o.createdAt, 1)} · ${o.provider} · quoting` : `${secs(o.latencyMs, 2)} · ${o.provider} · ${word}${o.decision === 'decline' ? ` · ${o.reasons.length} reasons` : ''}`
        rows.push({ key: l.id, name: l.label, metric: met, state, start, end, color: 'var(--actor-underwriter)', child: true })
      }
    }
  }
  // The human step can wait for minutes; it must not stretch the axis. Its bar is clipped by the lane instead.
  const lastEnd = rows.reduce((m, r) => (r.key === 'human' ? Math.max(m, r.start ?? 0) : Math.max(m, r.end ?? (r.start != null ? now : 0))), 0)
  const span = Math.max(10000, t0 == null ? 10000 : lastEnd - t0 + 2600)
  const tickMs = span > 20000 ? 5000 : 2000
  const ticks: number[] = []
  for (let t = 0; t <= span; t += tickMs) ticks.push(t)
  const human = stepBy('human')
  const guard = stepBy('guardrails')
  const endAt = human.startedAt ?? (guard.state === 'failed' ? guard.finishedAt : null)
  const total = t0 == null ? null : (endAt ?? now) - t0

  return (
    <section className="waterfall" aria-label="Pipeline" style={{ ['--wf-tick-px' as string]: `${(tickMs / span) * 100}%` }}>
      <div className="wf-ruler">
        <span className="total" title="Intake to board-ready">
          {applicant ? secs(total, 1) : <span className="muted">—</span>}
          <span className="muted"> total</span>
        </span>
        <span className="ticks" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} style={{ left: `${(t / span) * 100}%` }}>
              {(t / 1000).toFixed(0)}s
            </span>
          ))}
        </span>
      </div>
      {rows.map((r) => {
        const left = t0 != null && r.start != null ? ((r.start - t0) / span) * 100 : 0
        const width = t0 != null && r.start != null ? (((r.end ?? now) - r.start) / span) * 100 : 0
        return (
          <div key={r.key} className={`wf-row ${r.state} ${r.child ? 'child' : ''}`}>
            <span className="lbl">
              <span className="nm">{r.name}</span>
              {(r.state === 'skipped' || r.state === 'queued') && <span className="met">{r.state === 'skipped' ? 'skipped' : r.metric}</span>}
            </span>
            <span className="lane">
              <span className="bar" style={{ left: `${left}%`, width: `${Math.max(0, width)}%`, ['--bar' as string]: r.color }}>
                {r.start != null && <span className="t">{r.metric}</span>}
              </span>
            </span>
          </div>
        )
      })}
    </section>
  )
}
