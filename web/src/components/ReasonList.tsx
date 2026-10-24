import type { Offer, Reason, ReasonCheck } from '../types'
import { CheckIcon, WarnIcon } from './Logo'
import { checkFor, type CheckState } from '../lib/select'

interface Props {
  offer: Offer
  checks: ReasonCheck[]
  numbered?: boolean
  /** When set, only reasons in this list render (used by the Notice pane). */
  only?: Reason[]
}

const MARK: Record<CheckState, { text: string; cls: string } | null> = {
  verified: { text: 'verified', cls: 'tone-approve' },
  unsupported: { text: 'did not flip', cls: 'tone-decline' },
  pending: null,
  none: null,
}

export function ReasonList({ offer, checks, numbered, only }: Props) {
  const rows = only ?? offer.reasons
  return (
    <ul className={`reasons ${numbered ? 'numbered' : ''}`}>
      {rows.map((r, i) => {
        const c = checkFor(checks, offer, r.field)
        const mark = MARK[c.state]
        return (
          <li key={i}>
            <span className="field-row">
              <span className="mono field">{r.field}</span>
              {c.state === 'pending' && <span className="skel" style={{ width: 52, height: 10 }} aria-label="testing" />}
              {mark && (
                <span className={`check-mark ${mark.cls}`} title={c.check ? `${r.field}: ${String(c.check.original)} → ${String(c.check.counterfactual)} (${c.check.latencyMs} ms)` : undefined}>
                  {c.state === 'verified' ? <CheckIcon /> : <WarnIcon />}{' '}
                  {mark.text}
                </span>
              )}
            </span>
            <span>{r.text}</span>
          </li>
        )
      })}
    </ul>
  )
}
