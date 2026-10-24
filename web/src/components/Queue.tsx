import type { Applicant, Offer } from '../types'
import { LENDERS } from '../types'
import { usd } from '../lib/format'
import { STATUS_TONE, STATUS_WORD, IN_FLIGHT } from '../lib/status'
import { rankDecisions, type Ranked } from '../lib/rank'

interface Props {
  applicants: Applicant[]
  offers: Offer[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onApproveBest: (applicantId: string, offerId: string) => void
  onDecline: (applicantId: string) => void
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

const SHORT: Record<string, string> = Object.fromEntries(LENDERS.map((l) => [l.id, l.label]))

function Row({ a, selected, onSelect }: { a: Applicant; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`queue-row ${IN_FLIGHT.includes(a.status) ? 'live' : ''}`}
      style={{ ['--row-tone' as string]: TONE_VAR[STATUS_TONE[a.status]] }}
      onClick={onSelect}
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
  )
}

/** A row that needs a human: rank, what is on the table, and one-click approve or decline. */
function DecideRow({ r, rank, selected, onSelect, onApproveBest, onDecline, disabled }: { r: Ranked; rank: number; selected: boolean; onSelect: () => void; onApproveBest: () => void; onDecline: () => void; disabled?: boolean }) {
  const a = r.applicant
  const b = r.best
  const counter = b?.classification === 'counteroffer'
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
      <span className="name">
        <span className="rank mono">{rank}</span>
        {a.name}
        <span className="purpose">{a.purpose}</span>
      </span>
      <span className="amt">{usd(a.amountRequested)}</span>
      <span className="sub">
        {r.approvals}/{r.done} lenders said yes
        {a.replayOf ? ' · replay' : ''}
      </span>
      <span className="best">
        {b ? (
          <>
            <span className="mono">{b.apr!.toFixed(2)}%</span> {SHORT[b.lender]}
            {counter ? ` · counter ${usd(b.amount ?? 0)}` : ''}
          </>
        ) : (
          'no offer'
        )}
      </span>
      <span className="queue-actions" onClick={(e) => e.stopPropagation()}>
        {b && (
          <button type="button" className="approve-pill" disabled={disabled} onClick={onApproveBest} title={`Approve ${SHORT[b.lender]} at ${b.apr!.toFixed(2)}%`}>
            Approve best
          </button>
        )}
        <button type="button" className="decline-pill" disabled={disabled} onClick={onDecline}>
          Decline
        </button>
        <button type="button" className="link" onClick={onSelect}>
          Open
        </button>
      </span>
    </div>
  )
}

/** Laminar traces table: 41px rows, 3px status bar flush-left, mono ids. Decision rows ranked on top. */
export function Queue({ applicants, offers, selectedId, onSelect, onNew, onApproveBest, onDecline, disabled }: Props) {
  const ranked = rankDecisions(applicants, offers)
  const decidingIds = new Set(ranked.map((r) => r.applicant._id))
  const newest = applicants.slice().sort((a, b) => b.createdAt - a.createdAt)
  const inFlight = newest.filter((a) => IN_FLIGHT.includes(a.status))
  const finished = newest.filter((a) => !IN_FLIGHT.includes(a.status) && !decidingIds.has(a._id))
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
              <span className="mono">best first · A approve · X decline</span>
            </div>
            {ranked.map((r, i) => (
              <DecideRow
                key={r.applicant._id}
                r={r}
                rank={i + 1}
                selected={r.applicant._id === selectedId}
                onSelect={() => onSelect(r.applicant._id)}
                onApproveBest={() => r.best && onApproveBest(r.applicant._id, r.best._id)}
                onDecline={() => onDecline(r.applicant._id)}
                disabled={disabled}
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
              <Row key={a._id} a={a} selected={a._id === selectedId} onSelect={() => onSelect(a._id)} />
            ))}
          </>
        )}
        {finished.length > 0 && (
          <>
            <div className="queue-section">
              <span>Decided · {finished.length}</span>
            </div>
            {finished.map((a) => (
              <Row key={a._id} a={a} selected={a._id === selectedId} onSelect={() => onSelect(a._id)} />
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
