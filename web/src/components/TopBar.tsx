import { PRODUCT_NAME } from '../config'
import type { Connection } from '../hooks/useDesk'

interface Props {
  connection: Connection
  inFlight: number
  replaying: boolean
  view: 'desk' | 'applicant'
  onView: (v: 'desk' | 'applicant') => void
  onDeck: () => void
  onReplay: () => void
  onStopReplay: () => void
  theme: 'dark' | 'light'
  onTheme: () => void
}

/** Laminar top bar: title, segmented control, outlined 28px controls, metric chips. */
export function TopBar({ connection, inFlight, replaying, view, onView, onDeck, onReplay, onStopReplay, theme, onTheme }: Props) {
  return (
    <header className="topbar">
      <span className="brand">{PRODUCT_NAME}</span>
      <span className="label">lending desk</span>
      <span className="sep" />
      <div className="seg" role="group" aria-label="View">
        <button type="button" aria-pressed={view === 'desk'} onClick={() => onView('desk')}>
          Desk
        </button>
        <button type="button" aria-pressed={view === 'applicant'} onClick={() => onView('applicant')}>
          Applicant
        </button>
      </div>
      <span className="sep" />
      <span className={`pill ${inFlight > 0 ? 'live' : ''}`}>{inFlight > 0 ? `Running ${inFlight}` : 'Idle'}</span>
      <span className="chip">{connection}</span>
      <span className="spacer" />
      <button type="button" onClick={onDeck}>
        Persona deck
      </button>
      {replaying ? (
        <button type="button" onClick={onStopReplay}>
          Exit replay
        </button>
      ) : (
        <button type="button" className="ghost" onClick={onReplay} title="Play the recorded fixture (demo insurance)">
          Replay
        </button>
      )}
      <button type="button" className="ghost" onClick={onTheme} aria-label={`Theme: ${theme}`} title="Toggle theme">
        {theme === 'dark' ? 'Dark' : 'Light'}
      </button>
    </header>
  )
}
