// Focus-mode pipeline: one chip per step with its state and a short metric. The timing waterfall is one click away.
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
  timingOpen: boolean
  onTiming: () => void
}

export function PipelineStrip({ applicant, steps, offers, checks, now, timingOpen, onTiming }: Props) {
  const t0 = applicant?.createdAt ?? null
  const dur = (s: StepTiming) => (s.startedAt == null ? null : (s.finishedAt ?? now) - s.startedAt)
  const human = steps.find((s) => s.id === 'human')
  const guard = steps.find((s) => s.id === 'guardrails')
  const endAt = human?.startedAt ?? (guard?.state === 'failed' ? guard.finishedAt : null)
  const total = t0 == null ? null : (endAt ?? now) - t0
  const metric = (s: StepTiming): string => {
    const d = dur(s)
    switch (s.id) {
      case 'pull':
        return d == null ? '' : secs(d, 1)
      case 'guardrails':
        return s.state === 'failed' ? 'hard stop' : d == null ? '' : 'passed'
      case 'underwrite':
        return s.startedAt == null ? '' : `${offers.filter((o) => o.status === 'done').length}/${LENDERS.length}`
      case 'compliance':
        return s.startedAt == null ? '' : checks.length ? `${checks.filter((c) => c.flipped).length}/${checks.length} verified` : 'notice'
      case 'human':
        return s.startedAt == null ? '' : s.finishedAt ? 'decided' : 'waiting'
    }
  }
  return (
    <section className="pstrip" aria-label="Pipeline">
      <ol className="steps">
        {steps.map((s) => {
          const m = metric(s)
          return (
            <li key={s.id} className={`step ${s.state}`}>
              <span className="dot" aria-hidden="true" />
              <span className="nm">{s.label}</span>
              {m && <span className="met mono">{m}</span>}
            </li>
          )
        })}
      </ol>
      <span className="total mono">
        {applicant ? secs(total, 1) : '—'}
        <span className="muted"> total</span>
      </span>
      <button type="button" className="link" onClick={onTiming} aria-expanded={timingOpen}>
        {timingOpen ? 'Hide timing' : 'Timing'}
      </button>
    </section>
  )
}
