// Ranks applicants that are waiting on a human, best to worst, so the reviewer can work top-down.
// Order: more approving lenders first, then the lowest APR on the table, then whoever has waited longest.
import type { Applicant, Offer } from '../types'

export interface Ranked {
  applicant: Applicant
  /** Lowest-APR approving offer (counteroffers included), or null when every lender declined. */
  best: Offer | null
  approvals: number
  done: number
}

export function rankDecisions(applicants: Applicant[], offers: Offer[]): Ranked[] {
  const rows: Ranked[] = applicants
    .filter((a) => a.status === 'awaiting_human')
    .map((a) => {
      const done = offers.filter((o) => o.applicantId === a._id && o.status === 'done')
      const approving = done.filter((o) => o.decision === 'approve' && o.apr != null).sort((x, y) => x.apr! - y.apr!)
      // The borrower's own pick (phone) wins over the lowest APR, so A / Approve best honours what the judge chose.
      const chosen = a.chosenOfferId ? approving.find((o) => o._id === a.chosenOfferId) : undefined
      return { applicant: a, best: chosen ?? approving[0] ?? null, approvals: approving.length, done: done.length }
    })
  return rows.sort(
    (x, y) => y.approvals - x.approvals || (x.best?.apr ?? 999) - (y.best?.apr ?? 999) || x.applicant.createdAt - y.applicant.createdAt,
  )
}
