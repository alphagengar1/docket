// Decision summary: everything the top card says, computed from live offers.
// The summary card (DecisionSummary) and the lender section (App) read the same per-lender sentences
// from here, so the glance line and the detail never drift apart.
import type { Applicant, AuditEvent, Lender, Offer, ReasonCheck } from '../types'
import { LENDERS } from '../types'
import { fieldLabel, stopLabel } from '../../../convex/labels'
import { monthlyPayment, usd } from './format'
import { checkFor, type CheckState } from './select'
import { IN_FLIGHT, offerWord, type Tone } from './status'

/** Counterfactual verdict as a word a loan officer reads, never a color alone. */
export type Verdict = 'verified' | 'did not flip' | 'testing' | 'not tested'

export const VERDICT_WORD: Record<CheckState, Verdict> = {
  verified: 'verified',
  unsupported: 'did not flip',
  pending: 'testing',
  none: 'not tested',
}

export interface ReasonLine {
  field: string
  /** Plain label from convex/labels.ts, never the raw field path. */
  label: string
  text: string
  /** null when the caller did not supply reason checks (the verdict is then simply not shown). */
  verdict: Verdict | null
}

export interface LenderLine {
  lender: Lender
  label: string
  name: string
  /** Classification word: Declined / Offer / Counteroffer / Quoting / Waiting / Failed / Not asked. */
  word: string
  tone: Tone
  /** One plain-English sentence, e.g. "Northstar Lending offered 11.90%, $9,400 over 36 months." */
  sentence: string
  reasons: ReasonLine[]
  /** Reasons the counterfactual test verified; null when checks were not supplied or the lender did not decline. */
  verified: number | null
  /** Reasons whose test is still running. */
  testing: number
  offer: Offer | undefined
  monthly: number | null
}

export interface Citation {
  lender: Lender
  label: string
  name: string
  /** The exact reason text this lender wrote for the field. */
  text: string
  verdict: Verdict | null
}

export interface DecidingRule {
  field: string
  label: string
  text: string
  cited: number
  of: number
  lenders: string[]
  citations: Citation[]
}

export interface Summary {
  kind: 'hard' | 'running' | 'offers' | 'none'
  headline: string
  /** Full-sentence glance line for the summary disclosure row. */
  glance: string
  declined: number
  offered: number
  counter: number
  answered: number
  total: number
  best: Offer | null
  bestMonthly: number | null
  /** Most-cited decline field; first entry of `rules`. */
  rule: DecidingRule | null
  /** Every cited field, most-cited first. */
  rules: DecidingRule[]
  ruleGlance: string | null
  /** Hard stop only. */
  stopReason: string | null
  stopGlance: string | null
  /** One sentence per lender, in LENDERS order. */
  lenders: LenderLine[]
  /** Glance line for the "Lender decisions" section. */
  lenderGlance: string
}

const labelOf = (id: string) => LENDERS.find((l) => l.id === id)?.label ?? id
const nameOf = (id: string) => LENDERS.find((l) => l.id === id)?.name ?? id
const cls = (o: Offer) => o.classification ?? (o.decision === 'approve' ? 'approve' : 'deny')
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Lower-case a leading capital only when the word is ordinary prose (keeps "TransUnion", "APR"). */
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s)
const trimStop = (s: string) => s.trim().replace(/[.。]+$/, '')
/** Field label a loan officer reads: the bureau score is the TransUnion score, never "FICO"; nothing dotted leaks through. */
const plainLabel = (field: string) => {
  const l = fieldLabel(field)
  if (l === 'score') return 'TransUnion score'
  if (l === 'score (V4)') return 'VantageScore 4'
  return l.includes('.') ? l.split('.').pop()!.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() : l
}
/** Reason text as written by the lender, with "FICO" said as the TransUnion score. */
const plainText = (t: string) => t.replace(/\bFICO(?:\s*(?:9|8|®))?(?:\s+score)?/gi, 'TransUnion score')

/** Plain phrase for a hard-stop rule, by rule field. */
function stopPhrase(ref: string | null | undefined, fallback: string): string {
  switch (ref) {
    case 'flags.deceased':
      return 'the bureau says this person is deceased'
    case 'flags.frozen':
      return 'every bureau file is frozen'
    case 'identity.verified':
      return 'identity could not be verified'
    case 'fraud.score':
      return 'the fraud risk score is above the threshold'
    default:
      return lowerFirst(trimStop(fallback))
  }
}

function lenderLine(a: Applicant, lender: Lender, o: Offer | undefined, checks: ReasonCheck[] | undefined, hard: boolean): LenderLine {
  const name = nameOf(lender)
  const label = labelOf(lender)
  const base = { lender, label, name, offer: o, reasons: [] as ReasonLine[], verified: null as number | null, testing: 0, monthly: null as number | null }
  if (hard) return { ...base, word: 'Not asked', tone: 'muted', sentence: `${name} was not asked; the file stopped at guardrails.` }
  if (!o) return { ...base, word: 'Waiting', tone: 'muted', sentence: `${name} has not started.` }
  if (o.status === 'pending') return { ...base, word: 'Quoting', tone: 'accent', sentence: `${name} is still reading the file.` }
  if (o.status === 'failed') return { ...base, word: 'Failed', tone: 'hard', sentence: `${name} did not answer; the request failed.` }

  const { word, tone } = offerWord(o)
  const c = cls(o)
  const deny = c === 'deny'
  const reasons: ReasonLine[] = o.reasons.map((r) => ({
    field: r.field,
    label: plainLabel(r.field),
    text: plainText(r.text),
    verdict: deny && checks ? VERDICT_WORD[checkFor(checks, o, r.field).state] : null,
  }))
  const verified = deny && checks ? reasons.filter((r) => r.verdict === 'verified').length : null
  const testing = reasons.filter((r) => r.verdict === 'testing').length
  const monthly = monthlyPayment(o.amount, o.apr, o.termMonths)

  let sentence: string
  if (deny) {
    const first = reasons[0] ? lowerFirst(trimStop(reasons[0].text)) : 'policy'
    const more = reasons.length - 1
    sentence = `${name} declined: ${first}${more > 0 ? `, and ${plural(more, 'more reason')}` : ''}.`
  } else {
    const apr = o.apr != null ? `${o.apr.toFixed(2)}%` : 'an unquoted rate'
    const terms = `${usd(o.amount)} over ${o.termMonths ?? '—'} months${monthly != null ? ` (${usd(monthly)} a month)` : ''}`
    sentence =
      c === 'counteroffer'
        ? `${name} countered at ${apr}: ${terms}, different from the ${usd(a.amountRequested)} requested.`
        : `${name} offered ${apr}, ${terms}.`
  }
  return { ...base, word, tone, sentence, reasons, verified, testing, monthly }
}

export function summarize(a: Applicant, offers: Offer[], hs: AuditEvent | undefined, checks?: ReasonCheck[]): Summary {
  const done = offers.filter((o) => o.status === 'done')
  const failed = offers.filter((o) => o.status === 'failed')
  const declines = done.filter((o) => cls(o) === 'deny')
  const counters = done.filter((o) => cls(o) === 'counteroffer')
  const offered = done.filter((o) => cls(o) === 'approve')
  const best =
    done.filter((o) => o.decision === 'approve' && o.apr != null).sort((x, y) => x.apr! - y.apr!)[0] ?? null
  const total = LENDERS.length
  const hard = a.status === 'hard_stop'
  const lenders = LENDERS.map((l) => lenderLine(a, l.id, offers.find((o) => o.lender === l.id), checks, hard))
  const counts = `${plural(declines.length, 'declined', 'declined')}, ${plural(offered.length, 'offer')}, ${plural(counters.length, 'counteroffer')}`
  const base = {
    declined: declines.length,
    offered: offered.length,
    counter: counters.length,
    answered: done.length,
    total,
    best,
    bestMonthly: best ? monthlyPayment(best.amount, best.apr, best.termMonths) : null,
    rule: null as DecidingRule | null,
    rules: [] as DecidingRule[],
    ruleGlance: null as string | null,
    stopReason: null as string | null,
    stopGlance: null as string | null,
    lenders,
    lenderGlance: `Lender decisions: ${counts}. Open a row to read each card.`,
  }

  if (hard) {
    const reason = hs?.note || stopLabel(hs?.ref ?? '')
    const phrase = stopPhrase(hs?.ref, hs?.ref ? stopLabel(hs.ref) : reason)
    return {
      ...base,
      kind: 'hard',
      headline: `Hard stop: ${(hs?.ref ? stopLabel(hs.ref) : reason).replace(/^./, (c) => c.toLowerCase())}`,
      glance: `Hard stop: ${phrase}. No lender was asked; nothing to approve.`,
      stopReason: reason,
      stopGlance: `Hard stop: ${phrase}. No lender was asked; nothing to approve.`,
      lenderGlance: 'Lender decisions: none. The file stopped at guardrails before any lender was asked.',
    }
  }
  if (IN_FLIGHT.includes(a.status) && done.length < total) {
    const headline = done.length ? `${done.length} of ${total} lenders have answered` : 'Lenders are reading the file'
    return {
      ...base,
      kind: 'running',
      headline,
      glance: done.length ? `${done.length} of ${total} lenders have answered; the rest are still reading the file.` : 'Lenders are reading the file; no verdict yet.',
      lenderGlance: `Lender decisions: ${done.length} of ${total} have answered so far. Open a row to read each card.`,
    }
  }

  // Deciding rule: the field cited by the most distinct declining lenders. Every cited field is kept, most-cited first.
  const byField = new Map<string, { lenders: Set<string>; text: string; citations: Citation[] }>()
  for (const o of declines)
    for (const r of o.reasons) {
      const e = byField.get(r.field) ?? { lenders: new Set<string>(), text: plainText(r.text), citations: [] }
      if (!e.lenders.has(o.lender)) {
        e.lenders.add(o.lender)
        e.citations.push({
          lender: o.lender,
          label: labelOf(o.lender),
          name: nameOf(o.lender),
          text: plainText(r.text),
          verdict: checks ? VERDICT_WORD[checkFor(checks, o, r.field).state] : null,
        })
      }
      byField.set(r.field, e)
    }
  const rules: DecidingRule[] = [...byField]
    .map(([field, e]) => ({ field, label: plainLabel(field), text: e.text, cited: e.lenders.size, of: declines.length, lenders: [...e.lenders].map(labelOf), citations: e.citations }))
    .sort((x, y) => y.cited - x.cited)
  const rule = rules[0] ?? null
  let ruleGlance: string | null = null
  if (rule) {
    if (rule.of === 1) ruleGlance = `The one declining lender cited ${rule.label}.`
    else if (rule.cited === rule.of) ruleGlance = `Every declining lender cited the same rule: ${rule.label} (${rule.cited} of ${rule.of}).`
    else if (rule.cited * 2 > rule.of) ruleGlance = `Most declining lenders cited the same rule: ${rule.label} (${rule.cited} of ${rule.of}).`
    else ruleGlance = `The most-cited rule was ${rule.label} (${rule.cited} of ${rule.of} declining lenders).`
  }

  let headline: string
  let glance: string
  if (!best) {
    headline = 'No lender will offer'
    glance = `No lender will offer: ${declines.length} of ${total} declined${failed.length ? `, ${failed.length} failed to answer` : ''}.`
  } else if (declines.length === 0) {
    headline = `All ${total} lenders offered; best ${best.apr!.toFixed(2)}% from ${nameOf(best.lender)}`
    glance = `All ${total} lenders offered; best ${best.apr!.toFixed(2)}% from ${nameOf(best.lender)}.`
  } else {
    headline = `Declined by ${declines.length} of ${total} lenders, best offer ${best.apr!.toFixed(2)}% from ${nameOf(best.lender)}`
    glance = `Declined by ${declines.length} of ${total} lenders; best offer ${best.apr!.toFixed(2)}% from ${nameOf(best.lender)}.`
  }
  return { ...base, kind: best ? 'offers' : 'none', headline, glance, rule, rules, ruleGlance }
}
