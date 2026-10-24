import type { Applicant, Offer } from '../types'
import type { StepTiming } from '../lib/select'
import { secs } from '../lib/format'

interface Props {
  applicant: Applicant | undefined
  steps: StepTiming[]
  offers: Offer[]
  now: number
}

export function PipelineRail({ applicant, steps, offers, now }: Props) {
  // Total = intake to board-ready (human step start), or to the hard stop. Waiting on the human is not pipeline time.
  const started = applicant?.createdAt ?? null
  const human = steps.find((s) => s.id === 'human')
  const guard = steps.find((s) => s.id === 'guardrails')
  const endAt = human?.startedAt ?? (guard?.state === 'failed' ? guard.finishedAt : null)
  const total = started == null ? null : (endAt ?? now) - started
  return (
    <nav className="rail" aria-label="Pipeline">
      <div className="total mono" title="Total run time">
        {applicant ? secs(total, 1) : <span className="muted">—</span>}
      </div>
      {steps.map((s) => {
        const elapsed =
          s.startedAt == null ? null : s.state === 'running' ? now - s.startedAt : s.finishedAt != null ? s.finishedAt - s.startedAt : null
        return (
          <div key={s.id} className={`rail-step ${s.state}`}>
            <span className="dot" />
            <span className="line" />
            <div>
              <div className="name">{s.label}</div>
              <div className="elapsed mono">
                {s.state === 'skipped' ? 'skipped' : elapsed == null ? '' : secs(elapsed, s.state === 'running' ? 1 : 2)}
              </div>
              {s.id === 'underwrite' && (s.state === 'running' || s.state === 'done') && (
                <div className="minibars" aria-hidden="true">
                  {(['cu', 'fintech', 'prime'] as const).map((l) => {
                    const o = offers.find((x) => x.lender === l)
                    const cls = !o ? '' : o.status === 'pending' ? 'pending' : o.decision ?? ''
                    return <i key={l} className={cls} />
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </nav>
  )
}
