import { PRODUCT_NAME } from '../config'
import type { Connection } from '../hooks/useDesk'

interface Props {
  connection: Connection
  inFlight: number
  replaying: boolean
  onDeck: () => void
  onApplicantView: () => void
  onReplay: () => void
  onStopReplay: () => void
  theme: 'auto' | 'light' | 'dark'
  onTheme: () => void
}

export function TopBar({ connection, inFlight, replaying, onDeck, onApplicantView, onReplay, onStopReplay, theme, onTheme }: Props) {
  const word = inFlight > 0 ? `Running ${inFlight}` : 'Idle'
  return (
    <header className="topbar">
      <span className="brand">{PRODUCT_NAME}</span>
      <span className="label">Lending desk</span>
      <span className="sep" />
      <span className="pill">
        <span className={`status ${inFlight > 0 ? 'live tone-accent' : 'tone-muted'}`}>{word}</span>
        <span className="sep" />
        <span className="mono label" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {connection}
        </span>
      </span>
      <span className="spacer" />
      <button type="button" onClick={onDeck}>
        Persona deck
      </button>
      <button type="button" className="ghost" onClick={onApplicantView} title="What the applicant sees">
        Applicant view
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
      <button type="button" className="ghost" onClick={onTheme} aria-label={`Theme: ${theme}`} title={`Theme: ${theme}`}>
        {theme === 'auto' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark'}
      </button>
    </header>
  )
}
