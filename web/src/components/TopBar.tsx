import { useEffect, useRef, useState } from 'react'
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
  onNew: () => void
  onReplay: () => void
  onStopReplay: () => void
  theme: 'precision' | 'tag' | 'dark' | 'light'
  onTheme: () => void
  sandbox?: boolean
  onReset?: () => void
  /** Focus shows only what the decision needs; Detail brings every panel and timing back. */
  focus: boolean
  onFocus: (v: boolean) => void
}

/** Top bar: brand, status, the three things you do constantly. Everything else lives in the "…" menu. */
export function TopBar({ connection, inFlight, replaying, view, onView, onDeck, onNew, onReplay, onStopReplay, theme, onTheme, sandbox, onReset, focus, onFocus }: Props) {
  const [menu, setMenu] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const down = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setMenu(false)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    window.addEventListener('mousedown', down)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('mousedown', down)
      window.removeEventListener('keydown', key)
    }
  }, [menu])
  const item = (label: string, fn: () => void, hint?: string) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setMenu(false)
        fn()
      }}
    >
      <span>{label}</span>
      {hint && <span className="mono muted">{hint}</span>}
    </button>
  )
  return (
    <header className="topbar">
      <span className="brand">
        <Mark size={18} className="brand-mark" />
        {PRODUCT_NAME}
        <small className="brand-sub">Decision workspace</small>
      </span>
      <span className={`pill ${inFlight > 0 ? 'live' : ''}`}>{inFlight > 0 ? `Running ${inFlight}` : 'Idle'}</span>
      {!focus && <span className="chip">{connection}</span>}
      {replaying && <span className="chip">replay</span>}
      {sandbox && (
        <span className="chip" title="Sandbox data only: CRS test personas" style={{ color: 'var(--warn, #ff8a3d)' }}>
          SANDBOX
        </span>
      )}
      <span className="spacer" />
      <button type="button" onClick={onDeck}>
        Persona deck
      </button>
      <button type="button" onClick={onNew} disabled={replaying}>
        New applicant
      </button>
      <button
        type="button"
        className="ghost"
        onClick={() => window.open(`${window.location.pathname}${window.location.search}#/board`, 'docket-board', 'width=1440,height=900')}
        title="Open the judges' second screen in a new window"
      >
        Open board
      </button>
      <div className="menu-wrap" ref={box}>
        <button type="button" className="ghost menu-btn" aria-haspopup="menu" aria-expanded={menu} aria-label="More" onClick={() => setMenu((m) => !m)}>
          …
        </button>
        {menu && (
          <div className="menu" role="menu">
            {item(`Theme: ${theme === 'precision' ? 'Precision' : theme === 'tag' ? 'Tag' : theme === 'dark' ? 'Dark' : 'Light'}`, onTheme, 'next')}
            {item(focus ? 'Switch to Detail' : 'Switch to Focus', () => onFocus(!focus), focus ? 'Focus' : 'Detail')}
            {item(view === 'desk' ? 'Applicant view' : 'Desk view', () => onView(view === 'desk' ? 'applicant' : 'desk'))}
            {replaying ? item('Exit replay', onStopReplay) : item('Replay recorded run', onReplay)}
            {onReset && item('Reset board', onReset, 'deletes all')}
          </div>
        )}
      </div>
    </header>
  )
}
