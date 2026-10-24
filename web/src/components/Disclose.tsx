/**
 * Disclose: the console's progressive-disclosure primitive.
 * Every step reads like a chain-of-thought: one plain-English summary row you can
 * scan at a glance, and the details only when you open it.
 *
 * Usage:
 *   import { Disclose, DiscloseGroup, KV, Mono } from './Disclose'
 *
 *   <DiscloseGroup title="Underwriting">
 *     <Disclose tone="good" summary="Rules passed: no hard stops" meta={<Mono>12 ms</Mono>}
 *       detail={<KV items={[{ label: 'checks', value: '14 of 14' }, { label: 'actor', value: 'rules.ts' }]} />} />
 *     <Disclose tone="bad" summary="Hard stop: applicant is under 18" meta="0 offers" defaultOpen
 *       detail={<p>The LLM never saw this file.</p>} />
 *     <Disclose tone="human" density="card" summary="Waiting on a human to approve" onToggle={(o) => log(o)}
 *       detail={<KV items={[{ label: 'id', value: <Mono>app_8f2a</Mono> }]} />} />
 *   </DiscloseGroup>
 *
 * Tones: info (ink), good (blue), bad (orange), human (black), muted (grey). Each tone also shows
 * its word (Note / OK / Flag / Human / Idle) next to the rule, so no state is color-only. Children
 * inside a DiscloseGroup register with it; the group's "Expand all / Collapse all" control opens or
 * closes every child. A Disclose's own detail subtree is isolated from that group, so nested rows
 * inside a card do not count toward (or get toggled by) the outer group.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import '../styles/disclose.css'

export type DiscloseTone = 'info' | 'good' | 'warn' | 'bad' | 'human' | 'muted'
export type DiscloseDensity = 'row' | 'card'

export interface DiscloseProps {
  /** One plain-English line, readable at a glance. 15px. */
  summary: ReactNode
  /** Rendered inside the expandable block. */
  detail: ReactNode
  tone?: DiscloseTone
  defaultOpen?: boolean
  /** Right-aligned small mono slot: a time, a count, an id. */
  meta?: ReactNode
  /** Stable id; also used to register with an enclosing DiscloseGroup. */
  id?: string
  onToggle?: (open: boolean) => void
  /** 'row' sits in a list under hairlines; 'card' is a standalone surface with a 2px ink rule. */
  density?: DiscloseDensity
  className?: string
  /** Override the visible tone word (e.g. "Stopped" instead of "Flag"). */
  toneWord?: string
}

/** The visible tone word. Sighted readers get it next to the rule; screen readers hear it first. */
const TONE_WORD: Record<DiscloseTone, string> = {
  info: 'Note',
  good: 'OK',
  warn: 'Declined',
  bad: 'Flag',
  human: 'Human',
  muted: 'Idle',
}

/* ---------------------------------------------------------------- group context */

interface GroupSignal {
  epoch: number
  open: boolean
}

interface GroupContextValue {
  register: (id: string, open: boolean) => () => void
  report: (id: string, open: boolean) => void
  signal: GroupSignal | null
}

const GroupContext = createContext<GroupContextValue | null>(null)

export interface DiscloseGroupProps {
  children: ReactNode
  /** Optional heading at the group's top-left. */
  title?: ReactNode
  className?: string
}

export function DiscloseGroup({ children, title, className }: DiscloseGroupProps) {
  const openById = useRef(new Map<string, boolean>())
  const [counts, setCounts] = useState({ open: 0, total: 0 })
  const [signal, setSignal] = useState<GroupSignal | null>(null)

  const recount = useCallback(() => {
    let open = 0
    for (const v of openById.current.values()) if (v) open++
    setCounts({ open, total: openById.current.size })
  }, [])

  const register = useCallback(
    (id: string, open: boolean) => {
      openById.current.set(id, open)
      recount()
      return () => {
        openById.current.delete(id)
        recount()
      }
    },
    [recount],
  )

  const report = useCallback(
    (id: string, open: boolean) => {
      if (!openById.current.has(id) || openById.current.get(id) === open) return
      openById.current.set(id, open)
      recount()
    },
    [recount],
  )

  const allOpen = counts.total > 0 && counts.open === counts.total
  const setAll = (open: boolean) => setSignal((s) => ({ epoch: (s?.epoch ?? 0) + 1, open }))

  const ctx = useMemo<GroupContextValue>(() => ({ register, report, signal }), [register, report, signal])

  return (
    <GroupContext.Provider value={ctx}>
      <section className={`disclose-group${className ? ` ${className}` : ''}`}>
        <header className="disclose-group__head">
          {title != null ? <h3 className="disclose-group__title">{title}</h3> : <span />}
          <span className="disclose-group__controls">
            <span className="disclose-group__count" aria-live="polite">
              {counts.open} of {counts.total} open
            </span>
            <button
              type="button"
              className="disclose-group__toggle"
              onClick={() => setAll(!allOpen)}
              disabled={counts.total === 0}
            >
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          </span>
        </header>
        <div className="disclose-group__body">{children}</div>
      </section>
    </GroupContext.Provider>
  )
}

/* ---------------------------------------------------------------- Disclose */

export function Disclose({
  summary,
  detail,
  tone = 'info',
  defaultOpen = false,
  meta,
  id,
  onToggle,
  density = 'row',
  className,
  toneWord,
}: DiscloseProps) {
  const auto = useId()
  const rootId = id ?? `disclose${auto}`
  const buttonId = `${rootId}-summary`
  const panelId = `${rootId}-detail`

  const [open, setOpenState] = useState(defaultOpen)
  const onToggleRef = useRef(onToggle)
  onToggleRef.current = onToggle

  const setOpen = useCallback((next: boolean) => {
    setOpenState((prev) => {
      if (prev !== next) onToggleRef.current?.(next)
      return next
    })
  }, [])

  const group = useContext(GroupContext)

  // Register with the group (if any); unregister on unmount or id change.
  useEffect(() => {
    if (!group) return
    return group.register(rootId, open)
    // `open` is reported separately below; only (re)register when identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.register, rootId])

  useEffect(() => {
    group?.report(rootId, open)
  }, [group, rootId, open])

  // Obey group-wide open/close signals, but ignore any signal that predates this mount.
  const seenEpoch = useRef<number | null>(null)
  useEffect(() => {
    const sig = group?.signal ?? null
    if (seenEpoch.current === null) {
      seenEpoch.current = sig?.epoch ?? 0
      return
    }
    if (sig && sig.epoch !== seenEpoch.current) {
      seenEpoch.current = sig.epoch
      setOpen(sig.open)
    }
  }, [group?.signal, setOpen])

  const classes = ['disclose', `disclose--${density}`, open ? 'is-open' : 'is-closed']
  if (className) classes.push(className)

  return (
    <div className={classes.join(' ')} data-tone={tone} data-open={open ? 'true' : 'false'} id={rootId}>
      <button
        type="button"
        id={buttonId}
        className="disclose__row"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <span className="disclose__chevron" aria-hidden="true">
          <svg viewBox="0 0 12 12" width="12" height="12" focusable="false">
            <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
          </svg>
        </span>
        {(toneWord != null || tone === 'bad' || tone === 'human') ? (
          <span className="disclose__tone">{toneWord ?? TONE_WORD[tone]}</span>
        ) : (
          <span className="disclose__sr">{TONE_WORD[tone]}</span>
        )}
        <span className="disclose__summary">{summary}</span>
        {meta != null && <span className="disclose__meta mono">{meta}</span>}
      </button>
      <div
        id={panelId}
        className="disclose__panel"
        role="region"
        aria-labelledby={buttonId}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="disclose__panel-inner">
          {/* Nested disclosures belong to this row, not to the group this row sits in. */}
          <GroupContext.Provider value={null}>
            <div className="disclose__detail">{detail}</div>
          </GroupContext.Provider>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- helpers */

export interface KVItem {
  label: ReactNode
  value: ReactNode
}

/** Two-column label/value grid for detail blocks. Labels mono uppercase 12px, values 15px. */
export function KV({ items, className }: { items: KVItem[]; className?: string }) {
  return (
    <dl className={`kv${className ? ` ${className}` : ''}`}>
      {items.map((it, i) => (
        <div className="kv__row" key={i}>
          <dt className="kv__label">{it.label}</dt>
          <dd className="kv__value">{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Inline mono for ids, hashes and numbers. Tabular figures. */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={`mono-id${className ? ` ${className}` : ''}`}>{children}</span>
}
