import { PRODUCT_NAME } from '../config'
import { Mark } from './Logo'
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
  theme: 'tag' | 'dark' | 'light'
  onTheme: () => void
  sandbox?: boolean
  onReset?: () => void
  /** Focus shows only what the decision needs; Detail brings every panel and timing back. */
  focus: boolean
  onFocus: (v: boolean) => void
}

/** Laminar top bar: title, segmented control, outlined 28px controls, metric chips. */
export function TopBar({ connection, inFlight, replaying, view, onView, onDeck, onReplay, onStopReplay, theme, onTheme, sandbox, onReset, focus, onFocus }: Props) {
  return (
    <header className="topbar">
      <span className="brand">
        <Mark size={18} className="brand-mark" />
        {PRODUCT_NAME}
      </span>
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
      <div className="seg" role="group" aria-label="Density">
        <button type="button" aria-pressed={focus} onClick={() => onFocus(true)} title="Only what the decision needs">
          Focus
        </button>
        <button type="button" aria-pressed={!focus} onClick={() => onFocus(false)} title="Every panel, timing and log">
          Detail
        </button>
      </div>
      <span className="sep" />
      <span className={`pill ${inFlight > 0 ? 'live' : ''}`}>{inFlight > 0 ? `Running ${inFlight}` : 'Idle'}</span>
      {!focus && <span className="chip">{connection}</span>}
      {sandbox && (
        <span className="chip" title="Sandbox data only: CRS test personas" style={{ color: 'var(--warn, #ff8a3d)' }}>
          SANDBOX
        </span>
      )}
      <span className="spacer" />
      {onReset && (
        <button type="button" className="ghost" onClick={onReset} title="Delete every applicant on the board">
          Reset
        </button>
      )}
      <button
        type="button"
        className="ghost"
        onClick={() => window.open(`${window.location.pathname}${window.location.search}#/board`, 'docket-board', 'width=1440,height=900')}
        title="Open the judges' second screen in a new window"
      >
        Open board
      </button>
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
        {theme === 'tag' ? 'Tag' : theme === 'dark' ? 'Dark' : 'Light'}
      </button>
    </header>
  )
}
