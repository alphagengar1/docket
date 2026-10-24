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

const TONE_VAR: Record<string, string> = {
  muted: 'var(--hair-2)',
  accent: 'var(--accent)',
  text: 'var(--text)',
  approve: 'var(--approve)',
  decline: 'var(--decline)',
  hard: 'var(--hard)',
}

/** Laminar traces table: 41px rows, 3px status bar flush-left, mono ids. */
export function Queue({ applicants, selectedId, onSelect, onNew, disabled }: Props) {
  const rows = applicants.slice().sort((a, b) => b.createdAt - a.createdAt)
  return (
    <aside className="pane" aria-label="Applicant queue">
      <div className="pane-head">
        <span className="section-label">Queue</span>
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
            className={`queue-row ${IN_FLIGHT.includes(a.status) ? 'live' : ''}`}
            style={{ ['--row-tone' as string]: TONE_VAR[STATUS_TONE[a.status]] }}
            onClick={() => onSelect(a._id)}
          >
            <span className="name">
              {a.name}
              <span className="purpose">{a.purpose}</span>
            </span>
            <span className="amt">{usd(a.amountRequested)}</span>
            <span className="sub">
              {a.personaId} · {a._id.slice(0, 7)}
              {a.replayOf ? ' · replay' : ''}
            </span>
            <span className="word">{STATUS_WORD[a.status]}</span>
          </button>
        ))}
      </div>
      <div className="pane-foot">
        <span>{rows.length === 0 ? 'no applicants' : `${rows.length} applicant${rows.length === 1 ? '' : 's'}`}</span>
        <span>end of queue</span>
      </div>
    </aside>
  )
}
