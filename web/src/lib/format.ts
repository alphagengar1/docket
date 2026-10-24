export const usd = (n: number | null | undefined, digits = 0) =>
  n == null ? '—' : `$${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`

export const pct = (n: number | null | undefined, digits = 0) => (n == null ? '—' : `${(n * 100).toFixed(digits)}%`)

export const secs = (ms: number | null | undefined, digits = 1) => (ms == null ? '—' : `${(ms / 1000).toFixed(digits)}s`)

export const clock = (t: number) =>
  new Date(t).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })

export const clockMs = (t: number) => `${clock(t)}.${String(t % 1000).padStart(3, '0')}`

export function monthlyPayment(principal: number | null, apr: number | null, months: number | null) {
  if (principal == null || apr == null || months == null) return null
  const r = apr / 100 / 12
  return r === 0 ? principal / months : (principal * r) / (1 - Math.pow(1 + r, -months))
}

export function totalInterest(principal: number | null, apr: number | null, months: number | null) {
  const p = monthlyPayment(principal, apr, months)
  if (p == null || principal == null || months == null) return null
  return p * months - principal
}

export const num = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-US'))
