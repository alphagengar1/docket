import type { ReactNode } from 'react'
import '../styles/floor.css'

export type PanelId = 'queue' | 'inspector' | 'log' | 'assistant'

interface Props {
  open: Record<PanelId, boolean>
  onToggle: (p: PanelId) => void
  waiting: number
  /** Which panels this rail controls. Each rail sits on the edge its panels open from. */
  items?: PanelId[]
  side?: 'left' | 'right' | 'bottom'
  /** Shown next to the Log button (event count). */
  count?: number
}

const ITEMS: Array<{ id: PanelId; label: string; key: string; icon: ReactNode }> = [
  {
    id: 'queue',
    label: 'Queue',
    key: '1',
    icon: <path d="M3 5h14M3 10h14M3 15h14" />,
  },
  {
    id: 'inspector',
    label: 'Inspect',
    key: '2',
    icon: <path d="M4 3h12v14H4zM13 3v14" />,
  },
  {
    id: 'log',
    label: 'Log',
    key: '3',
    icon: <path d="M3 4h14v12H3zM3 12h14" />,
  },
  {
    id: 'assistant',
    label: 'Ask',
    key: '4',
    icon: <path d="M3 4h14v9H9l-4 3v-3H3z" />,
  },
]

/** Thin activity rail (VS Code style): one button per collapsible panel, placed on the edge the panel opens from. */
export function Rail({ open, onToggle, waiting, items, side = 'left', count }: Props) {
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? 'Cmd' : 'Ctrl'
  const shown = items ? ITEMS.filter((it) => items.includes(it.id)) : ITEMS
  return (
    <nav className={`rail rail-${side}`} aria-label="Panels">
      {shown.map((it) => (
        <button
          key={it.id}
          type="button"
          className="rail-btn"
          aria-pressed={open[it.id]}
          onClick={() => onToggle(it.id)}
          title={`${it.label} (${mod}+${it.key})`}
        >
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            {it.icon}
          </svg>
          <span className="rail-lbl">{it.label}</span>
          {it.id === 'queue' && waiting > 0 && <span className="rail-badge">{waiting}</span>}
          {it.id === 'log' && count != null && <span className="rail-count mono">{count}</span>}
        </button>
      ))}
    </nav>
  )
}
