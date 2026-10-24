// Pure, deterministic stand-ins for convex/rules.ts (hard stops) and the three underwriter policies.
// Thresholds mirror policies/*.md (via convex/policies.ts) so mock outcomes match the live desk.
// The real underwriters are Claude calls; these exist so the mock flow has believable, explainable output.
import type { Bundle, Lender, MarketAnchor, OfferClassification, Reason, Tier } from '../types'
import { MARKET_RATES } from './personas'

export type BundleData = Pick<Bundle, 'credit' | 'identity' | 'fraud' | 'flags'>

export interface HardStop {
  field: string
  reason: string
}

/** Mirrors contracts.md: deceased || frozen || !verified || fraud.score >= 80. */
export function hardStop(b: BundleData): HardStop | null {
  if (b.flags.deceased) return { field: 'flags.deceased', reason: 'Bureau file carries a deceased indicator.' }
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
  classification: OfferClassification
}

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const pct = (n: number) => `${Math.round(n * 100)}%`

/** ECOA framing (design/differentiators.md #2): approve = requested terms, counteroffer = different terms, deny. Code, not LLM. */
export function classify(decision: 'approve' | 'decline', amountRequested: number, amount: number | null): OfferClassification {
  if (decision === 'decline') return 'deny'
  if (amount != null && amount < amountRequested) return 'counteroffer'
  return 'approve'
}

function capacity(lender: Lender, income: number, thin: boolean) {
  if (lender === 'cu') return Math.min(income * 0.35, 35000)
  if (lender === 'fintech') return Math.min(income * 0.5, thin ? 5000 : 25000)
  return Math.min(income * 0.4, 100000)
}

function term(lender: Lender, amount: number) {
  if (lender === 'cu') return amount <= 10000 ? 36 : amount <= 20000 ? 48 : 60
  if (lender === 'fintech') return amount <= 5000 ? 24 : amount <= 15000 ? 36 : 48
  return amount <= 15000 ? 36 : amount <= 40000 ? 60 : 84
}

function price(lender: Lender, score: number, thin: boolean): number {
  if (lender === 'cu') return score >= 740 ? 7.9 : score >= 700 ? 9.9 : 12.9
  if (lender === 'fintech') return thin ? 24.9 : score >= 720 ? 10.9 : score >= 680 ? 15.9 : score >= 640 ? 21.9 : 29.9
  return score >= 780 ? 6.49 : score >= 740 ? 7.49 : 8.49
}

export function underwrite(lender: Lender, input: UnderwriteInput): UnderwriteOutput {
  const { credit, flags, fraud } = input.bundle
  const anchor = anchorFor(tierFor(credit.fico9, credit.vantage4))
  const reasons: Reason[] = []
  const conditions: string[] = []
  const thin = lender === 'fintech' && credit.fico9 == null && credit.tradelines.length <= 2
  const score = credit.fico9 ?? (lender === 'fintech' ? credit.vantage4 : null)

  // --- score ---
  if (lender === 'cu') {
    if (credit.fico9 == null) reasons.push({ text: 'No FICO 9 score on file; the credit union does not underwrite thin files.', field: 'credit.fico9' })
    else if (credit.fico9 < 660) reasons.push({ text: `FICO 9 of ${credit.fico9} is below the policy minimum of 660.`, field: 'credit.fico9' })
  } else if (lender === 'prime') {
    if (credit.fico9 == null) reasons.push({ text: 'No FICO 9 score on file; Prime requires a scored file.', field: 'credit.fico9' })
    else if (credit.fico9 < 720) reasons.push({ text: `FICO 9 of ${credit.fico9} is below the Prime minimum of 720.`, field: 'credit.fico9' })
  } else {
    if (score == null) reasons.push({ text: 'Neither FICO 9 nor VantageScore 4 is available.', field: 'credit.fico9' })
    else if (thin) {
      if ((credit.vantage4 ?? 0) < 620) reasons.push({ text: `Thin file: VantageScore 4 of ${credit.vantage4} is below the 620 floor.`, field: 'credit.vantage4' })
    } else if (score < 600) reasons.push({ text: `FICO 9 of ${score} is below the policy minimum of 600.`, field: 'credit.fico9' })
  }

  // --- utilization / inquiries / public records / fraud ---
  const utilCap = lender === 'cu' ? 0.5 : lender === 'fintech' ? 0.8 : 0.3
  if (credit.utilization == null) {
    if (lender !== 'fintech') reasons.push({ text: 'Utilization is unavailable, which the policy treats as a failure.', field: 'credit.utilization' })
  } else if (credit.utilization > utilCap)
    reasons.push({ text: `Revolving utilization of ${pct(credit.utilization)} exceeds the ${pct(utilCap)} cap.`, field: 'credit.utilization' })

  const inqCap = lender === 'cu' ? 3 : lender === 'fintech' ? 6 : 2
  if (credit.inquiries6mo > inqCap)
    reasons.push({ text: `${credit.inquiries6mo} hard inquiries in six months; policy allows at most ${inqCap}.`, field: 'credit.inquiries6mo' })

  if (flags.bankruptcy) {
    if (lender !== 'fintech') reasons.push({ text: 'Bankruptcy on file; policy declines regardless of age.', field: 'flags.bankruptcy' })
    else if ((score ?? 0) < 640) reasons.push({ text: `Bankruptcy on file with a score of ${score}, below the 640 bankruptcy floor.`, field: 'flags.bankruptcy' })
    else conditions.push('Provide the bankruptcy discharge letter.')
  }
  if (flags.eviction) reasons.push({ text: 'Eviction judgment in public records.', field: 'flags.eviction' })

  const fraudCap = lender === 'cu' ? 60 : lender === 'fintech' ? 70 : 50
  if (fraud.score != null && fraud.score >= fraudCap)
    reasons.push({ text: `Fraud score ${fraud.score} is at or above the policy ceiling of ${fraudCap}.`, field: 'fraud.score' })

  // --- capacity ---
  const max = capacity(lender, input.statedIncome, thin)
  let amount = input.amountRequested
  if (input.amountRequested > max * 1.25) {
    reasons.push({ text: `Requested ${usd(input.amountRequested)} exceeds the ${usd(max)} maximum supported by the stated income by more than 25%.`, field: 'statedIncome' })
    reasons.push({ text: `${usd(input.amountRequested)} requested against a ${usd(max)} policy maximum.`, field: 'amountRequested' })
  } else if (input.amountRequested > max) {
    amount = Math.floor(max / 100) * 100
    conditions.push(`Approved at the policy maximum of ${usd(amount)} instead of the ${usd(input.amountRequested)} requested.`)
  }
  if (lender === 'prime' && amount < 2500 && reasons.length === 0)
    reasons.push({ text: `Requested ${usd(amount)} is below the Prime minimum of $2,500.`, field: 'amountRequested' })

  // Contract rule: every denial carries at least two reasons. The supporting reason is truthful but may not be
  // sufficient on its own; the counterfactual test (verifyReason) is what tells the two apart.
  if (reasons.length === 1) {
    const late = credit.tradelines.findIndex((t) => /dpd|late/.test(t.status))
    if (late >= 0) reasons.push({ text: `A ${credit.tradelines[late].type.replace('_', ' ')} tradeline shows status "${credit.tradelines[late].status}".`, field: `credit.tradelines[${late}]` })
    else if (credit.inquiries6mo >= 2 && !reasons.some((r) => r.field === 'credit.inquiries6mo'))
      reasons.push({ text: `${credit.inquiries6mo} recent inquiries indicate active credit seeking.`, field: 'credit.inquiries6mo' })
    else if (credit.utilization != null && credit.utilization > 0.2 && !reasons.some((r) => r.field === 'credit.utilization'))
      reasons.push({ text: `Utilization of ${pct(credit.utilization)} leaves limited capacity for new credit.`, field: 'credit.utilization' })
    else if (credit.fico9 != null && !reasons.some((r) => r.field === 'credit.fico9'))
      reasons.push({ text: `FICO 9 of ${credit.fico9} sits in the ${anchor.tier} band.`, field: 'credit.fico9' })
    else reasons.push({ text: `Stated income of ${usd(input.statedIncome)} does not offset the primary factor at this amount.`, field: 'statedIncome' })
  }

  if (reasons.length > 0) {
    return { decision: 'decline', apr: null, termMonths: null, amount: null, conditions: [], reasons, marketAnchor: anchor, classification: 'deny' }
  }

  const apr = price(lender, score ?? 0, thin)
  const months = term(lender, amount)
  if (lender === 'cu') {
    conditions.push('Open a Pacific Ridge share account (membership required before funding).', 'Provide two most recent pay stubs or equivalent proof of the stated income.')
    if (fraud.score != null && fraud.score >= 40) conditions.push('Manual identity review by a loan officer before funding.')
  } else if (lender === 'fintech') {
    conditions.push('E-sign the loan agreement; funds arrive in 1-2 business days.')
    if (fraud.score != null && fraud.score >= 40) conditions.push('Complete step-up identity verification (government ID plus selfie).')
    if (thin) conditions.push('Verify income by linking a bank account before funding.')
  } else {
    conditions.push('Verify income with a W-2 or two years of tax returns.', 'Enroll in autopay from a Meridian checking account to keep the quoted APR (otherwise +0.50%).')
    if (fraud.score != null && fraud.score >= 30) conditions.push('Enhanced identity verification by the fraud team before funding.')
  }

  const approveReasons: Reason[] = [
    thin
      ? { text: `Thin file priced on VantageScore 4 of ${credit.vantage4}.`, field: 'credit.vantage4' }
      : { text: `FICO 9 of ${credit.fico9 ?? score} meets the policy minimum.`, field: 'credit.fico9' },
    { text: `Utilization of ${pct(credit.utilization ?? 0)} is within the ${pct(utilCap)} cap.`, field: 'credit.utilization' },
  ]
  return {
    decision: 'approve',
    apr,
    termMonths: months,
    amount,
    conditions,
    reasons: approveReasons,
    marketAnchor: anchor,
    classification: classify('approve', input.amountRequested, amount),
  }
}

// ---------------------------------------------------------------------------
// Counterfactual reason test (design/differentiators.md #1).
// For reason i: set its field to a passing value and re-run the lender. "flipped" is true when the reason is
//   sufficient — fixing this field alone turns the decline into an approval — or
//   necessary  — fixing every other cited field still declines, and fixing them all approves.
// A reason that is neither was not a principal reason; it is flagged and dropped from the notice.
// ---------------------------------------------------------------------------

export interface Counterfactual {
  input: UnderwriteInput
  original: unknown
  counterfactual: unknown
}

export function fixField(input: UnderwriteInput, field: string): Counterfactual {
  const b = structuredClone(input.bundle)
  let original: unknown = null
  let counterfactual: unknown = null
  let statedIncome = input.statedIncome
  let amountRequested = input.amountRequested
  const tl = /^credit\.tradelines\[(\d+)\]$/.exec(field)
  if (tl) {
    const i = Number(tl[1])
    original = b.credit.tradelines[i]?.status ?? null
    if (b.credit.tradelines[i]) b.credit.tradelines[i] = { ...b.credit.tradelines[i], status: 'open' }
    counterfactual = 'open'
  } else {
    switch (field) {
      case 'credit.fico9':
        original = b.credit.fico9
        b.credit.fico9 = 780
        counterfactual = 780
        break
      case 'credit.vantage4':
        original = b.credit.vantage4
        b.credit.vantage4 = 760
        counterfactual = 760
        break
      case 'credit.utilization':
        original = b.credit.utilization
        b.credit.utilization = 0.1
        counterfactual = 0.1
        break
      case 'credit.inquiries6mo':
        original = b.credit.inquiries6mo
        b.credit.inquiries6mo = 0
        counterfactual = 0
        break
      case 'flags.bankruptcy':
        original = b.flags.bankruptcy
        b.flags.bankruptcy = false
        counterfactual = false
        break
      case 'flags.eviction':
        original = b.flags.eviction
        b.flags.eviction = false
        counterfactual = false
        break
      case 'fraud.score':
        original = b.fraud.score
        b.fraud.score = 5
        counterfactual = 5
        break
      case 'statedIncome':
      case 'applicant.statedIncome':
        original = statedIncome
        statedIncome = Math.max(statedIncome, amountRequested * 4)
        counterfactual = statedIncome
        break
      case 'amountRequested':
      case 'applicant.amountRequested':
        original = amountRequested
        amountRequested = Math.min(amountRequested, Math.max(2500, Math.floor((statedIncome * 0.3) / 100) * 100))
        counterfactual = amountRequested
        break
      default:
        original = null
        counterfactual = null
    }
  }
  return { input: { ...input, bundle: b, statedIncome, amountRequested }, original, counterfactual }
}

export function verifyReason(lender: Lender, input: UnderwriteInput, reasons: Reason[], field: string): { flipped: boolean; original: unknown; counterfactual: unknown } {
  const others = reasons.map((r) => r.field).filter((f) => f !== field)
  const allFixed = others.reduce((inp, f) => fixField(inp, f).input, fixField(input, field).input)
  const othersFixed = others.reduce((inp, f) => fixField(inp, f).input, input)
  const { original, counterfactual } = fixField(input, field)
  const sufficient = underwrite(lender, fixField(input, field).input).decision === 'approve'
  const approvesWhenAllFixed = underwrite(lender, allFixed).decision === 'approve'
  const stillDeclinesWithoutThisFix = underwrite(lender, othersFixed).decision === 'decline'
  return { flipped: sufficient || (approvesWhenAllFixed && stillDeclinesWithoutThisFix), original, counterfactual }
}

/** Adverse-action notice text. Only verified reasons are listed; the FCRA paragraph names the source and date. */
export function adverseActionNotice(
  name: string,
  declines: Array<{ lender: string; classification: OfferClassification; reasons: Reason[] }>,
  source: { name: string; pulledAt: number },
): string {
  if (declines.length === 0) return ''
  const lenderNames: Record<string, string> = { cu: 'Pacific Ridge Credit Union', fintech: 'Northstar Lending', prime: 'Meridian Bank Prime' }
  const parts = declines.map((d) => {
    const who = lenderNames[d.lender] ?? d.lender
    if (d.classification === 'counteroffer') return `${who} offered different terms than you requested. If you do not accept that counteroffer, this notice applies to that request.`
    const list = d.reasons.map((r) => r.text.replace(/\.$/, '')).join('; ')
    return `${who} did not approve the amount and terms you requested. Principal reasons: ${list}.`
  })
  const date = new Date(source.pulledAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return [
    `${name}, this notice explains the credit decisions made on your application.`,
    ...parts,
    `The decision was made by the lenders named above, not by the consumer reporting agency. Information from ${source.name} (report dated ${date}) was used; ${source.name} did not make this decision and cannot tell you why it was made. You have the right to a free copy of your report within 60 days and to dispute anything in it that is inaccurate.`,
  ].join('\n\n')
}

/** Mock re-pull after a tradeline dispute: drop the line; removing a derogatory line lifts the score and utilization. */
export function bundleAfterDispute(b: BundleData, index: number): BundleData {
  const next = structuredClone(b)
  const removed = next.credit.tradelines[index]
  if (!removed) return next
  next.credit.tradelines.splice(index, 1)
  const derog = /dpd|late|collection|chargeoff/.test(removed.status)
  if (derog) {
    if (next.credit.fico9 != null) next.credit.fico9 += 45
    if (next.credit.vantage4 != null) next.credit.vantage4 += 40
  }
  if (removed.type === 'credit_card' && next.credit.utilization != null) {
    const before = b.credit.tradelines.filter((t) => t.type === 'credit_card').reduce((s, t) => s + t.balance, 0)
    const after = next.credit.tradelines.filter((t) => t.type === 'credit_card').reduce((s, t) => s + t.balance, 0)
    if (before > 0) next.credit.utilization = Math.round(next.credit.utilization * (after / before) * 100) / 100
  }
  return next
}
