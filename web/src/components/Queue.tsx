import type { Applicant } from '../types'
import { usd } from '../lib/format'
import { STATUS_TONE, STATUS_WORD, IN_FLIGHT } from '../lib/status'

interface Props {
  applicants: Applicant[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  disabled?: boolean
}

export function Queue({ applicants, selectedId, onSelect, onNew, disabled }: Props) {
  const rows = applicants.slice().sort((a, b) => b.createdAt - a.createdAt)
  return (
    <aside className="pane" aria-label="Applicant queue">
      <div className="pane-head">
        <span className="section-label">Queue · {rows.length}</span>
        <button type="button" onClick={onNew} disabled={disabled}>
          New applicant
        </button>
      </div>
      <div className="pane-body" role="listbox" aria-label="Applicants">
        {rows.length === 0 && <div className="empty">No applicants yet. Draw a persona card and submit an application.</div>}
        {rows.map((a) => (
          <button
            key={a._id}
            type="button"
            role="option"
            aria-selected={a._id === selectedId}
            className="queue-row"
            onClick={() => onSelect(a._id)}
          >
            <span className="name">{a.name}</span>
            <span className={`status tone-${STATUS_TONE[a.status]} ${IN_FLIGHT.includes(a.status) ? 'live' : ''}`}>
              {STATUS_WORD[a.status]}
            </span>
            <span className="sub">
              {a.replayOf && <span className="tone-accent">replay · </span>}
              {a.purpose} · <span className="mono">{usd(a.amountRequested)}</span> · <span className="mono">{a.personaId}</span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}
