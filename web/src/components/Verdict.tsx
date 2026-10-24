// Verdict: the one block that answers "approved or not?" at a glance. A solid stamp in the state's
// colour (blue approved, ink declined, signal hard stop, outline when it needs you, dashed while
// working), one line under it, and the two buttons when a human has to decide.
import type { Applicant, AuditEvent, Decision, Offer } from '../types'
import { LENDERS } from '../types'
import { usd } from '../lib/format'
import { summarize } from '../lib/summary'

interface Props {
  applicant: Applicant
  offers: Offer[]
  decision: Decision | undefined
  hardStop: AuditEvent | undefined
  canDecide: boolean
  /** The offer Approve acts on (a picked card, else the best). */
  pick: Offer | null
  onApprove: (offerId: string) => void
  onDecline: () => void
  size?: 'board' | 'sheet'
  /** The specific hard-stop reason when the caller has it (the audit log's last hard-stop note). */
  stopNote?: string
}

const nameOf = (id: string) => LENDERS.find((l) => l.id === id)?.name ?? id
const terms = (o: Offer) => `${nameOf(o.lender)} · ${o.apr!.toFixed(2)}% · ${usd(o.amount)} / ${o.termMonths} mo`

export function Verdict({ applicant: a, offers, decision, hardStop, canDecide, pick, onApprove, onDecline, size = 'board', stopNote }: Props) {
  const s = summarize(a, offers, hardStop)
  const chosen = decision?.chosenOfferId ? offers.find((o) => o._id === decision.chosenOfferId) : undefined

  let kind: string
  let word: string
  let line: string
  if (a.status === 'approved') {
    kind = 'approved'
    word = 'Approved'
    line = chosen?.apr != null ? terms(chosen) : 'Offer approved'
  } else if (a.status === 'declined') {
    kind = 'declined'
    word = 'Declined'
    line = 'Adverse-action notice sent'
  } else if (a.status === 'hard_stop') {
    kind = 'hard'
    word = 'Hard stop'
    line = stopNote ?? s.stopReason ?? 'Stopped by a rule before any lender saw the file'
  } else if (a.status === 'awaiting_human') {
    kind = 'needs'
    word = 'Needs you'
    line = pick?.apr != null ? `Best: ${terms(pick)}` : 'No lender will offer'
  } else {
    kind = 'working'
    word = 'Working'
    line = s.headline
  }

  return (
    <section className={`vd vd-${kind} vd-${size}`} aria-label={`Verdict: ${word}`}>
      <span className="vd-stamp">{word}</span>
      <span className="vd-line">{line}</span>
      {canDecide && (
        <span className="vd-actions">
          <button type="button" className="vd-btn" onClick={onDecline} title="Shortcut: X">
            Decline
          </button>
          <button type="button" className="vd-btn primary" disabled={!pick} onClick={() => pick && onApprove(pick._id)} title="Shortcut: A">
            Approve
          </button>
        </span>
      )}
    </section>
  )
}
