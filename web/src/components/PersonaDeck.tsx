import { useEffect } from 'react'
import type { DeskPersona } from '../hooks/useDesk'

interface Props {
  personas: DeskPersona[]
  onPick: (personaId: string) => void
  onClose: () => void
}

export function PersonaDeck({ personas, onPick, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Persona deck" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <h2>Persona deck</h2>
          <button type="button" className="ghost" onClick={onClose} autoFocus>
            Close
          </button>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          The judge draws a printed card. Pick the matching persona to start intake with its defaults filled in. Sandbox data only.
        </p>
        <div className="deck">
          {personas.map((p) => (
            <button key={p.personaId} type="button" className="deck-card" onClick={() => onPick(p.personaId)}>
              <span className="mono id">{p.personaId}</span>
              <span>
                <div className="nm">{p.name}</div>
                <div className="hint">{p.hint}</div>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
