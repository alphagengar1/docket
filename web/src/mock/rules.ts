// Pure, deterministic stand-ins for convex/rules.ts (hard stops) and the three underwriter policies.
// The real underwriters are Claude calls; these exist so the mock flow has believable, explainable output.
import type { Bundle, Lender, MarketAnchor, Reason, Tier } from '../types'
import { MARKET_RATES } from './personas'

type BundleData = Pick<Bundle, 'credit' | 'identity' | 'fraud' | 'flags'>

export interface HardStop {
  field: string
  reason: string
}

/** Mirrors contracts.md: deceased || frozen || !verified || fraud.score >= 80. */
export function hardStop(b: BundleData): HardStop | null {
  if (b.flags.deceased) return { field: 'flags.deceased', reason: 'Bureau reports the consumer as deceased.' }
  if (b.flags.frozen) return { field: 'flags.frozen', reason: 'Credit file is frozen; no bureau data can be used.' }
  if (!b.identity.verified)
    return { field: 'identity.verified', reason: `Identity could not be verified (${b.identity.flags.join(', ') || 'no match'}).` }
  if (b.fraud.score != null && b.fraud.score >= 80)
    return { field: 'fraud.score', reason: `Fraud score ${b.fraud.score} is at or above the hard-stop threshold of 80.` }
  return null
}

export function tierFor(fico: number | null, vantage: number | null): Tier {
  const s = fico ?? vantage
  if (s == null) return 'fair'
  if (s >= 760) return 'excellent'
  if (s >= 700) return 'good'
  if (s >= 640) return 'fair'
  return 'poor'
}

export function anchorFor(tier: Tier): MarketAnchor {
  const r = MARKET_RATES.find((m) => m.tier === tier)!
  return { tier, aprLow: r.aprLow, aprHigh: r.aprHigh }
}

export interface UnderwriteInput {
  bundle: BundleData
  statedIncome: number
  amountRequested: number
  purpose: string
}

export interface UnderwriteOutput {
  decision: 'approve' | 'decline'
  apr: number | null
  termMonths: number | null
  amount: number | null
  conditions: string[]
  reasons: Reason[]
  marketAnchor: MarketAnchor
}

interface Policy {
  minFico: number | null
  allowNoFico: boolean
  minVantageIfNoFico: number
  maxUtil: number
  maxInquiries: number
  allowBankruptcy: boolean
  allowLate: boolean
  maxPaymentToIncome: number
  maxAmount: number
  spread: number // added to the anchor low
  terms: number[]
}

const POLICIES: Record<Lender, Policy> = {
  cu: {
    minFico: 680,
    allowNoFico: false,
    minVantageIfNoFico: 0,
    maxUtil: 0.5,
    maxInquiries: 3,
    allowBankruptcy: false,
    allowLate: true,
    maxPaymentToIncome: 0.12,
    maxAmount: 25000,
    spread: 0.4,
    terms: [36, 48, 60],
  },
  fintech: {
    minFico: 600,
    allowNoFico: true,
    minVantageIfNoFico: 640,
    maxUtil: 0.85,
    maxInquiries: 8,
    allowBankruptcy: false,
    allowLate: true,
    maxPaymentToIncome: 0.18,
    maxAmount: 40000,
    spread: 2.9,
    terms: [24, 36, 48],
  },
  prime: {
    minFico: 720,
    allowNoFico: false,
    minVantageIfNoFico: 0,
    maxUtil: 0.3,
    maxInquiries: 2,
    allowBankruptcy: false,
    allowLate: false,
    maxPaymentToIncome: 0.1,
    maxAmount: 50000,
    spread: 0.0,
    terms: [36, 60, 72],
  },
}

const pct = (n: number) => `${Math.round(n * 100)}%`
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

function monthlyPayment(principal: number, apr: number, months: number) {
  const r = apr / 100 / 12
  return r === 0 ? principal / months : (principal * r) / (1 - Math.pow(1 + r, -months))
}

export function underwrite(lender: Lender, input: UnderwriteInput): UnderwriteOutput {
  const p = POLICIES[lender]
  const { credit, flags } = input.bundle
  const tier = tierFor(credit.fico9, credit.vantage4)
  const anchor = anchorFor(tier)
  const reasons: Reason[] = []
  const conditions: string[] = []

  if (credit.fico9 == null) {
    if (!p.allowNoFico) reasons.push({ text: 'No FICO 9 score on file; policy requires a scored file.', field: 'credit.fico9' })
    else if ((credit.vantage4 ?? 0) < p.minVantageIfNoFico)
      reasons.push({ text: `No FICO 9 and VantageScore 4 of ${credit.vantage4 ?? 'n/a'} is below the ${p.minVantageIfNoFico} floor for unscored files.`, field: 'credit.vantage4' })
    else conditions.push('Unscored file: verify income with two recent pay stubs before funding.')
  } else if (p.minFico != null && credit.fico9 < p.minFico) {
    reasons.push({ text: `FICO 9 of ${credit.fico9} is below the policy minimum of ${p.minFico}.`, field: 'credit.fico9' })
  }

  if (credit.utilization != null && credit.utilization > p.maxUtil)
    reasons.push({ text: `Revolving utilization of ${pct(credit.utilization)} exceeds the ${pct(p.maxUtil)} cap.`, field: 'credit.utilization' })

  if (credit.inquiries6mo > p.maxInquiries)
    reasons.push({ text: `${credit.inquiries6mo} hard inquiries in six months; policy allows at most ${p.maxInquiries}.`, field: 'credit.inquiries6mo' })

  if (flags.bankruptcy && !p.allowBankruptcy)
    reasons.push({ text: 'Public-record bankruptcy within the look-back window.', field: 'flags.bankruptcy' })

  if (flags.eviction) reasons.push({ text: 'Eviction record on file.', field: 'flags.eviction' })

  const lateIdx = credit.tradelines.findIndex((t) => t.status.includes('late'))
  if (lateIdx >= 0 && !p.allowLate)
    reasons.push({ text: `Delinquency (${credit.tradelines[lateIdx].status}) on a ${credit.tradelines[lateIdx].type} tradeline within 24 months.`, field: `credit.tradelines[${lateIdx}]` })

  if (input.amountRequested > p.maxAmount)
    reasons.push({ text: `Requested ${usd(input.amountRequested)} exceeds the ${usd(p.maxAmount)} product cap.`, field: 'applicant.amountRequested' })

  const apr = Math.min(anchor.aprHigh, round1(anchor.aprLow + p.spread + (credit.utilization ?? 0.3) * 4))
  const term = p.terms[Math.min(p.terms.length - 1, input.amountRequested >= 15000 ? 2 : input.amountRequested >= 8000 ? 1 : 0)]
  const payment = monthlyPayment(input.amountRequested, apr, term)
  const pti = payment / (input.statedIncome / 12)
  let amount = input.amountRequested
  if (pti > p.maxPaymentToIncome) {
    const maxPayment = (input.statedIncome / 12) * p.maxPaymentToIncome
    const affordable = Math.floor((maxPayment / payment) * input.amountRequested / 500) * 500
    if (affordable < input.amountRequested * 0.6)
      reasons.push({ text: `Estimated payment ${usd(payment)}/mo is ${pct(pti)} of stated monthly income; policy caps it at ${pct(p.maxPaymentToIncome)}.`, field: 'applicant.statedIncome' })
    else {
      amount = affordable
      conditions.push(`Counter-offer: amount reduced to ${usd(affordable)} to keep payment within ${pct(p.maxPaymentToIncome)} of stated income.`)
    }
  }

  // Contract rule: every denial carries at least two reasons drawn from the bundle.
  if (reasons.length === 1) {
    if (credit.inquiries6mo >= 2 && !reasons.some((r) => r.field === 'credit.inquiries6mo'))
      reasons.push({ text: `${credit.inquiries6mo} recent inquiries indicate active credit seeking.`, field: 'credit.inquiries6mo' })
    else if (credit.utilization != null && credit.utilization > 0.3 && !reasons.some((r) => r.field === 'credit.utilization'))
      reasons.push({ text: `Utilization of ${pct(credit.utilization)} leaves limited capacity for new credit.`, field: 'credit.utilization' })
    else if (lateIdx >= 0)
      reasons.push({ text: `Recent delinquency on a ${credit.tradelines[lateIdx].type} tradeline.`, field: `credit.tradelines[${lateIdx}]` })
    else
      reasons.push({ text: `Stated income of ${usd(input.statedIncome)} does not offset the primary factor at this amount.`, field: 'applicant.statedIncome' })
  }

  if (reasons.length > 0) {
    return { decision: 'decline', apr: null, termMonths: null, amount: null, conditions: [], reasons, marketAnchor: anchor }
  }

  if (lender === 'cu') conditions.push('Membership share account ($5) opened at funding.')
  if (lender === 'prime' && input.amountRequested >= 15000) conditions.push('Proof of income for amounts of $15,000 and above.')
  if (lender === 'fintech') conditions.push('Autopay enrollment required for the quoted APR.')
  if (credit.inquiries6mo >= 3) conditions.push('Confirm no new debt was opened since the inquiries on file.')

  const approveReasons: Reason[] = [
    { text: credit.fico9 != null ? `FICO 9 of ${credit.fico9} meets the ${p.minFico} minimum.` : `VantageScore 4 of ${credit.vantage4} clears the unscored-file floor.`, field: credit.fico9 != null ? 'credit.fico9' : 'credit.vantage4' },
    { text: `Utilization of ${pct(credit.utilization ?? 0)} is within the ${pct(p.maxUtil)} cap.`, field: 'credit.utilization' },
    { text: `Payment of ${usd(monthlyPayment(amount, apr, term))}/mo is ${pct(monthlyPayment(amount, apr, term) / (input.statedIncome / 12))} of stated monthly income.`, field: 'applicant.statedIncome' },
  ]

  return { decision: 'approve', apr, termMonths: term, amount, conditions, reasons: approveReasons, marketAnchor: anchor }
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

export function adverseActionNotice(name: string, declines: Array<{ lender: string; reasons: Reason[] }>): string {
  if (declines.length === 0) return ''
  const lenderNames: Record<string, string> = { cu: 'the Credit Union', fintech: 'the Fintech lender', prime: 'the Prime bank' }
  const parts = declines.map((d) => {
    const list = d.reasons.map((r) => r.text.replace(/\.$/, '')).join('; ')
    return `${lenderNames[d.lender] ?? d.lender} declined because: ${list}.`
  })
  return [
    `${name}, this notice explains the credit decisions made on your application.`,
    ...parts,
    'These decisions were based on information from a consumer reporting agency sandbox. You have the right to a free copy of your report within 60 days and to dispute anything in it that is inaccurate.',
  ].join(' ')
}
