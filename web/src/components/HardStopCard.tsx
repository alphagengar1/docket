import type { AuditEvent } from '../types'

export function HardStopCard({ event }: { event: AuditEvent | undefined }) {
  return (
    <section className="hardstop" role="alert" aria-label="Hard stop">
      <h3>Hard stop</h3>
      <span className="mono field tone-hard">{event?.ref ?? '—'}</span>
      <p>{event?.note ?? 'A deterministic guardrail halted this file before any underwriter ran.'}</p>
      <div className="zero">
        <span>
          Offers: <b className="mono">0</b>
        </span>
        <span>
          Underwriters run: <b className="mono">0</b>
        </span>
        <span>
          Rule: <b className="mono">rules.ts</b> (code, not a prompt)
        </span>
      </div>
    </section>
  )
}
