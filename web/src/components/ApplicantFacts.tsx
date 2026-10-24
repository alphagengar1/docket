import type { Applicant } from '../types'
import { usd } from '../lib/format'

export function ApplicantFacts({ a }: { a: Applicant }) {
  const created = new Date(a.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const items: Array<[string, string]> = [
    ['Purpose', a.purpose],
    ['Requested', usd(a.amountRequested)],
    ['Stated income', usd(a.statedIncome)],
    ['Card code', a.cardCode ?? 'none yet'],
    ['Persona', a.personaId],
    ['Created', created],
    ['ID', a._id.slice(0, 8)],
  ]
  return (
    <dl className="ax-facts" aria-label="Applicant details">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd className={k === 'Card code' || k === 'Persona' || k === 'ID' ? 'mono' : ''}>{v}</dd>
        </div>
      ))}
    </dl>
  )
}
