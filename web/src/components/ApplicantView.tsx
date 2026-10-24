// What the applicant would see (design/differentiators.md, FairQuote steal), set as an Evidence-style
// document: sans headline, serif body. Nothing about fraud scores, policies or other lenders' internals.
import type { Applicant, Decision, Notice, Offer } from '../types'
import { LENDERS } from '../types'
import { monthlyPayment, usd } from '../lib/format'
import { PRODUCT_NAME } from '../config'

interface Props {
  applicant: Applicant | undefined
  offers: Offer[]
  notice: Notice | undefined
  decision: Decision | undefined
  onBack: () => void
}

export function ApplicantView({ applicant, offers, notice, decision, onBack }: Props) {
  const chosen = decision?.chosenOfferId ? offers.find((o) => o._id === decision.chosenOfferId) : undefined
  const approvals = offers.filter((o) => o.status === 'done' && o.decision === 'approve')
  let headline = 'We are reviewing your application.'
  let body = 'This usually takes under a minute. You can keep this page open.'
  if (!applicant) {
    headline = 'No application selected.'
    body = ''
  } else if (applicant.status === 'hard_stop') {
    headline = 'We could not continue with your application.'
    body = 'We were unable to verify the information needed to review it. Please contact us to continue.'
  } else if (applicant.status === 'approved' && chosen) {
    headline = 'Your loan is approved.'
    body = `${LENDERS.find((l) => l.id === chosen.lender)?.name} will fund ${usd(chosen.amount)} at ${chosen.apr}% APR over ${chosen.termMonths} months (about ${usd(monthlyPayment(chosen.amount, chosen.apr, chosen.termMonths))} per month). A loan officer approved this on ${new Date(decision!.at).toLocaleString('en-US')}.`
  } else if (applicant.status === 'declined') {
    headline = 'Your application was not approved.'
    body = 'The notice below explains the principal reasons. You can dispute anything in your credit report that is inaccurate.'
  } else if (applicant.status === 'awaiting_human') {
    headline = approvals.length ? `You have ${approvals.length} offer${approvals.length === 1 ? '' : 's'} under review.` : 'Your application was reviewed.'
    body = approvals.length ? 'A loan officer is confirming the terms. Nothing is final until you accept an offer.' : 'The notice below explains the outcome.'
  }
  const paras = notice?.text.split(/\n\n+/) ?? []
  return (
    <div className="applicant-view">
      <div className="applicant-page">
        <div className="top">
          <span style={{ fontWeight: 600 }}>{PRODUCT_NAME}</span>
          <button type="button" onClick={onBack}>
            Back to desk
          </button>
        </div>
        <span className="section-label">Applicant view · {applicant?.name ?? '—'}</span>
        <h1>{headline}</h1>
        {applicant && <span className="dateline">Application {applicant._id} · {new Date(applicant.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>}
        {body && <p>{body}</p>}
        {applicant && applicant.status !== 'hard_stop' && approvals.length > 0 && !chosen && (
          <ul className="applicant-offers">
            {approvals.map((o) => (
              <li key={o._id}>
                <span>{LENDERS.find((l) => l.id === o.lender)?.name}</span>
                <span className="mono">
                  {usd(o.amount)} · {o.apr}% APR · {o.termMonths} mo{o.classification === 'counteroffer' ? ' · different from requested' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        {notice && applicant?.status !== 'hard_stop' && (
          <article className="doc" aria-label="Notice">
            <span className="section-label">Notice of action taken</span>
            {paras.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </article>
        )}
      </div>
    </div>
  )
}
