// Reason rows with their counterfactual verdict. Every verdict is a word (Verified / Unsupported /
// Testing / Untested), never a color alone, and the test itself opens inline through Disclose:
// no hover-only tooltips, so touch and screen-reader users get the same facts.
import { LENDERS, type Offer, type Reason, type ReasonCheck } from '../types'
import { CheckIcon, WarnIcon } from './Logo'
import { checkFor, type CheckState } from '../lib/select'
import { clock, pct, secs, usd } from '../lib/format'
import { fieldLabel } from '../../../convex/labels'
import { Disclose, DiscloseGroup, KV, type DiscloseTone } from './Disclose'

interface Props {
  offer: Offer
  checks: ReasonCheck[]
  numbered?: boolean
  /** When set, only reasons in this list render (used by the Notice pane). */
  only?: Reason[]
  /** Render the reasons without verification rows (e.g. a before-dispute card with no checks). */
  untested?: boolean
}

export const VERDICT: Record<CheckState, { word: string; cls: string; tone: DiscloseTone }> = {
  verified: { word: 'Verified', cls: 'tone-approve', tone: 'good' },
  unsupported: { word: 'Unsupported', cls: 'tone-decline', tone: 'bad' },
  pending: { word: 'Testing', cls: 'tone-muted', tone: 'muted' },
  none: { word: 'Untested', cls: 'tone-muted', tone: 'muted' },
}

/** Reason text as a loan officer should read it: the bureau's score is the TransUnion score, never "FICO". */
export function plainText(text: string): string {
  return text.replace(/\bFICO(?:\s*(?:9|8|®))?(?:\s+score)?/gi, 'TransUnion score')
}

/** Local fallbacks for fields that convex/labels.ts does not name, so a raw path never reaches the screen. */
const EXTRA_LABELS: Record<string, string> = {
  statedIncome: 'stated income',
  amountRequested: 'amount requested',
  'flags.lienOrJudgment': 'lien or judgment',
  'credit.tradelines': 'tradelines',
  tradelines: 'tradelines',
}

/** Plain-English label for a reason field. Uses fieldLabel from convex/labels.ts; "score" becomes "TransUnion score". */
export function reasonLabel(field: string): string {
  const key = field.replace(/^credit\./, '')
  if (EXTRA_LABELS[field]) return EXTRA_LABELS[field]
  if (EXTRA_LABELS[key]) return EXTRA_LABELS[key]
  const l = fieldLabel(field)
  if (l === 'score') return 'TransUnion score'
  if (l === 'score (V4)') return 'VantageScore 4'
  // fieldLabel echoes unknown keys back; make sure a dotted path never shows as-is.
  return l.includes('.') ? l.split('.').pop()!.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() : l
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/** Format an original / counterfactual value in the field's own units. */
export function fmtCheckValue(field: string, v: unknown): string {
  const key = field.replace(/^credit\./, '')
  if (v == null) return 'missing'
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  if (typeof v === 'number') {
    if (key === 'utilization') return pct(v)
    if (key === 'statedIncome' || key === 'amountRequested') return usd(v)
    return v.toLocaleString('en-US')
  }
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? '' : 's'}`
  return String(v)
}

/** The glance sentence for one reason's verdict: "Utilization: verified. Setting it to 10% (from 82%) flipped the decision to approve (1.4s)." */
export function verdictSentence(field: string, state: CheckState, check: ReasonCheck | undefined, lenderShort: string): string {
  const label = cap(reasonLabel(field))
  if (state === 'verified' && check)
    return `${label}: verified. Setting it to ${fmtCheckValue(field, check.counterfactual)} (from ${fmtCheckValue(field, check.original)}) flipped the decision to approve (${secs(check.latencyMs, 1)}).`
  if (state === 'unsupported' && check)
    return `${label}: unsupported. Setting it to ${fmtCheckValue(field, check.counterfactual)} (from ${fmtCheckValue(field, check.original)}) did not change the decision (${secs(check.latencyMs, 1)}).`
  if (state === 'pending') return `${label}: testing. Re-running ${lenderShort} with a passing value to see whether the decision flips.`
  return `${label}: not tested. Only decline reasons get a counterfactual test.`
}

/** One reason's verification verdict as an inline disclosure. Nothing here is hover-only. */
export function ReasonVerdictRow({ offer, reason, checks }: { offer: Offer; reason: Reason; checks: ReasonCheck[] }) {
  const { state, check } = checkFor(checks, offer, reason.field)
  const meta = LENDERS.find((l) => l.id === offer.lender)
  const lenderName = meta?.name ?? offer.lender
  const label = reasonLabel(reason.field)
  const sentence = verdictSentence(reason.field, state, check, meta?.label ?? offer.lender)
  const detail = check ? (
    <KV
      items={[
        { label: 'Reason', value: plainText(reason.text) },
        { label: 'Field', value: label },
        { label: 'Original value', value: fmtCheckValue(reason.field, check.original) },
        { label: 'Tested value', value: fmtCheckValue(reason.field, check.counterfactual) },
        { label: 'Decision flipped', value: check.flipped ? 'Yes, to approve' : 'No, still declined' },
        { label: 'Test time', value: secs(check.latencyMs, 2) },
        { label: 'Re-run', value: `${lenderName}'s decision, same file with only ${label} changed` },
        { label: 'Tested at', value: clock(check.createdAt) },
        {
          label: 'Notice',
          value: check.flipped ? 'This reason may appear in the adverse-action notice.' : 'Withheld from the notice: the test could not show it mattered.',
        },
      ]}
    />
  ) : (
    <KV
      items={[
        { label: 'Reason', value: plainText(reason.text) },
        { label: 'Field', value: label },
        { label: 'Status', value: state === 'pending' ? `Re-running ${lenderName} with a passing value for ${label}.` : 'Not tested.' },
        { label: 'Decision at', value: clock(offer.createdAt) },
      ]}
    />
  )
  return <Disclose className="rsn-verdict" density="row" tone={VERDICT[state].tone} summary={sentence} detail={detail} />
}

export function ReasonList({ offer, checks, numbered, only, untested }: Props) {
  const rows = only ?? offer.reasons
  const testable = !untested && offer.status === 'done' && offer.decision === 'decline'
  const list = (
    <ul className={`reasons rsn ${numbered ? 'numbered' : ''}`}>
      {rows.map((r, i) => {
        const c = testable ? checkFor(checks, offer, r.field) : { state: 'none' as CheckState }
        const v = VERDICT[c.state]
        return (
          <li key={i}>
            <span className="field-row">
              <span className="mono field">{reasonLabel(r.field)}</span>
              {c.state !== 'none' && (
                <span className={`check-mark ${v.cls}`}>
                  {c.state === 'verified' ? <CheckIcon /> : c.state === 'unsupported' ? <WarnIcon /> : null}
                  {c.state === 'pending' && <span className="skel" style={{ width: 10, height: 10 }} aria-hidden="true" />} {v.word}
                </span>
              )}
            </span>
            <span className="rsn-text">{plainText(r.text)}</span>
            {testable && <ReasonVerdictRow offer={offer} reason={r} checks={checks} />}
          </li>
        )
      })}
      {rows.length === 0 && <li className="rsn-text muted">No reasons recorded.</li>}
    </ul>
  )
  // The group gives the verdicts their own "Expand all" and keeps them out of any enclosing lender group's count.
  return testable && rows.length > 0 ? <DiscloseGroup className="rsn-group">{list}</DiscloseGroup> : list
}
