import type { AuditEvent } from '../types'

/** Laminar "Failure Detector" card: category chip + one plain-English sentence. */
export function HardStopCard({ event }: { event: AuditEvent | undefined }) {
  return (
    <section className="hardstop" role="alert" aria-label="Hard stop">
      <div className="ttl">
        <h3>Hard stop</h3>
        <span className="chips">
          <span className="chip">rules.ts</span>
          <span className="chip">deterministic</span>
          <span className="chip">0 offers</span>
        </span>
      </div>
      <span className="k">category</span>
      <span>
        <span className="cat">{event?.ref ?? 'rules.hard_stop'}</span>
      </span>
      <span className="k">description</span>
      <p>{event?.note ?? 'A deterministic guardrail halted this file before any underwriter ran.'}</p>
      <div className="zero chips">
        <span className="chip">underwriters run: 0</span>
        <span className="chip">the LLM never saw this file</span>
        <span className="chip">no notice: not a credit decision</span>
      </div>
    </section>
  )
}
