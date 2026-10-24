import type { Applicant, AuditEvent } from '../types'
import { LENDERS } from '../types'
import { fieldLabel } from '../../../convex/labels'
import { Disclose, KV, Mono } from './Disclose'
import '../styles/hardstop.css'

/**
 * Hard-stop card, progressive-disclosure form.
 *
 * Glance: one plain-English sentence a loan officer reads in half a second
 * ("Hard stop: the bureau says this person died. Decided in code before any lender or model saw the file.").
 * Detail (opens inline): the rule that fired, who decided it, the rule's note verbatim, underwriters run,
 * what the model saw, whether a notice is owed, when it fired, and how many override attempts were blocked.
 *
 * `event` is the first `rules.hard_stop` audit event (existing prop, unchanged).
 * `events` and `applicant` are optional: when the parent passes them, the card can list every rule that
 * fired and count blocked override attempts. Without them it says "none recorded" rather than inventing a 0.
 */
export interface HardStopCardProps {
  event: AuditEvent | undefined
  /** All audit events for this applicant (optional; lets the card count override attempts and list every fired rule). */
  events?: AuditEvent[]
  /** The applicant row (optional; `overrideAttempts` is read from it when present). */
  applicant?: Pick<Applicant, 'overrideAttempts'> | null
}

const HARD_STOP_ACTION = 'rules.hard_stop'
const OVERRIDE_BLOCKED_ACTION = 'override.blocked'
const TAIL = 'Decided in code before any lender or model saw the file.'

/** The glance sentence, by rule. Plain English, no field paths, no jargon. */
function glance(ref: string | null | undefined): string {
  switch (ref) {
    case 'flags.deceased':
      return `Hard stop: the bureau says this person died. ${TAIL}`
    case 'flags.frozen':
      return `Hard stop: every bureau file is frozen, so there is no score to read. ${TAIL}`
    case 'identity.verified':
      return `Hard stop: the bureau could not confirm this person is who they say they are. ${TAIL}`
    case 'fraud.score':
      return `Hard stop: the fraud risk score is above the line the rules allow. ${TAIL}`
    default:
      return `Hard stop: an automated safety check halted this file. ${TAIL}`
  }
}

const capitalize = (s: string) => s.replace(/^./, (c) => c.toUpperCase())

function clock(at: number | undefined): string | null {
  if (at == null) return null
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function HardStopCard({ event, events, applicant }: HardStopCardProps) {
  const ref = event?.ref ?? null
  const ruleLabel = ref ? capitalize(fieldLabel(ref)) : 'Automated safety check'

  // Every rule that fired, in rule order, minus the headline one.
  const alsoFired = (events ?? [])
    .filter((e) => e.actor === 'rules' && e.action === HARD_STOP_ACTION && e.ref && e.ref !== ref)
    .map((e) => capitalize(fieldLabel(e.ref as string)))
  const alsoFiredUnique = [...new Set(alsoFired)]

  // Override attempts: the applicant row is authoritative; the audit log is the fallback.
  const attemptsFromLog = events ? events.filter((e) => e.action === OVERRIDE_BLOCKED_ACTION).length : null
  const attempts = applicant?.overrideAttempts ?? attemptsFromLog
  const attemptsText =
    attempts == null
      ? 'None recorded'
      : attempts === 0
        ? 'None. No person can fund a stopped file from this console.'
        : `${attempts} ${attempts === 1 ? 'attempt' : 'attempts'}, every one blocked. A hard stop has no override path.`

  const firedAt = clock(event?.at)
  const note = event?.note ?? 'A deterministic guardrail halted this file before any underwriter ran.'

  const items = [
    { label: 'Rule', value: ruleLabel },
    ...(alsoFiredUnique.length ? [{ label: 'Also fired', value: alsoFiredUnique.join('; ') }] : []),
    {
      label: 'Decided by',
      value: (
        <>
          <Mono>rules.ts</Mono>, deterministic code. Same file in, same answer out, every time. No model, no judgement call.
        </>
      ),
    },
    {
      label: 'Rule said',
      value: (
        <blockquote className="hardstop__note">
          <span className="hardstop__note-word">Verbatim</span> {note}
        </blockquote>
      ),
    },
    { label: 'Underwriters run', value: `0 of ${LENDERS.length}. No lender opened this file.` },
    { label: 'Model', value: 'The LLM never saw this file.' },
    { label: 'Notice', value: 'None owed. A hard stop is not a credit decision.' },
    { label: 'Fired at', value: firedAt ? <Mono>{firedAt}</Mono> : 'Time not recorded' },
    { label: 'Override attempts', value: attemptsText },
  ]

  return (
    <section className="hardstop hardstop--disclose" role="alert" aria-label="Hard stop">
      <Disclose
        tone="bad"
        density="card"
        className="hardstop__disclose"
        summary={
          <>
            <strong className="hardstop__word">Hard stop:</strong> {glance(ref).replace(/^Hard stop: /, '')}
          </>
        }
        meta={firedAt ? <>stopped {firedAt}</> : 'stopped'}
        detail={<KV items={items} className="hardstop__kv" />}
      />
    </section>
  )
}
