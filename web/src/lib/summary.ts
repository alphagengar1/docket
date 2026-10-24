// Decision summary: everything the top card says, computed from live offers.
import type { Applicant, AuditEvent, Offer } from '../types'
import { LENDERS } from '../types'
import { fieldLabel, stopLabel } from '../../../convex/labels'
import { IN_FLIGHT } from './status'

export interface DecidingRule {
  field: string
  label: string
  text: string
  cited: number
  of: number
  lenders: string[]
}

export interface Summary {
  kind: 'hard' | 'running' | 'offers' | 'none'
  headline: string
  declined: number
  offered: number
  counter: number
  best: Offer | null
  rule: DecidingRule | null
  /** Hard stop only. */
  stopReason: string | null
}

const labelOf = (id: string) => LENDERS.find((l) => l.id === id)?.label ?? id
const nameOf = (id: string) => LENDERS.find((l) => l.id === id)?.name ?? id

export function summarize(a: Applicant, offers: Offer[], hs: AuditEvent | undefined): Summary {
  const done = offers.filter((o) => o.status === 'done')
  const cls = (o: Offer) => o.classification ?? (o.decision === 'approve' ? 'approve' : 'deny')
  const declines = done.filter((o) => cls(o) === 'deny')
  const counters = done.filter((o) => cls(o) === 'counteroffer')
  const offered = done.filter((o) => cls(o) === 'approve')
  const best =
    done.filter((o) => o.decision === 'approve' && o.apr != null).sort((x, y) => x.apr! - y.apr!)[0] ?? null
  const base = { declined: declines.length, offered: offered.length, counter: counters.length, best, rule: null as DecidingRule | null, stopReason: null as string | null }
  const total = LENDERS.length

  if (a.status === 'hard_stop') {
    const reason = hs?.note || stopLabel(hs?.ref ?? '')
    return { ...base, kind: 'hard', headline: `Hard stop: ${(hs?.ref ? stopLabel(hs.ref) : reason).replace(/^./, (c) => c.toLowerCase())}`, stopReason: reason }
  }
  if (IN_FLIGHT.includes(a.status) && done.length < total) {
    return { ...base, kind: 'running', headline: done.length ? `${done.length} of ${total} lenders have answered` : 'Lenders are reading the file' }
  }

  // Deciding rule: the field cited by the most distinct declining lenders.
  const byField = new Map<string, { lenders: Set<string>; text: string }>()
  for (const o of declines)
    for (const r of o.reasons) {
      const e = byField.get(r.field) ?? { lenders: new Set<string>(), text: r.text }
      e.lenders.add(o.lender)
      byField.set(r.field, e)
    }
  let rule: DecidingRule | null = null
  for (const [field, e] of byField)
    if (!rule || e.lenders.size > rule.cited)
      rule = { field, label: fieldLabel(field), text: e.text, cited: e.lenders.size, of: declines.length, lenders: [...e.lenders].map(labelOf) }

  let headline: string
  if (!best) headline = 'No lender will offer'
  else if (declines.length === 0) headline = `All ${total} lenders offered; best ${best.apr!.toFixed(2)}% from ${nameOf(best.lender)}`
  else headline = `Declined by ${declines.length} of ${total} lenders, best offer ${best.apr!.toFixed(2)}% from ${nameOf(best.lender)}`
  return { ...base, kind: best ? 'offers' : 'none', headline, rule }
}
