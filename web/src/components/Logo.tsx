// Docket brand mark: a file with a cut corner and two ledger lines, one color, fills currentColor.
// Used everywhere the product name appears (console top bar, judge board, borrower phone, favicon).
import type { CSSProperties } from 'react'

export const MARK_PATH = 'M3 2h11l7 7v13H3z M7 12h10v2.4H7z M7 17h10v2.4H7z'

export function Mark({ size = 16, color, className, title }: { size?: number; color?: string; className?: string; title?: string }) {
  const style: CSSProperties | undefined = color ? { color } : undefined
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <path d={MARK_PATH} />
    </svg>
  )
}

/** Small inline status icons so the UI never falls back to emoji glyphs. */
export function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" aria-hidden="true">
      <path d="M3 8.5l3.2 3L13 4.5" />
    </svg>
  )
}
export function WarnIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 1.5l7 12.5H1z M7 6h2v4H7z M7 11h2v2H7z" fillRule="evenodd" />
    </svg>
  )
}
