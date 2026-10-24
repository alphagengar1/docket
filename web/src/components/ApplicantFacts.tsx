// Applicant facts: the flat <dl> the desk header has always shown, plus a disclosure variant for the
// decision sheet (one glance sentence; the seven cells open on demand). Also the bureau facts block
// the sheet discloses so an approver can check the file before clicking Approve.
import type { ReactNode } from 'react'
import type { Applicant, Bundle } from '../types'
import { num, pct, usd } from '../lib/format'
import { describeIdentityFlag } from '../../../convex/labels'
import { Disclose, KV, Mono, type KVItem } from './Disclose'

const when = (t: number) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** Lower-case the first letter of a purpose unless it looks like an acronym ("RV purchase"). */
const purposeWord = (s: string) => (/^[A-Z][A-Z]/.test(s) ? s : s.replace(/^./, (c) => c.toLowerCase()))

/** Glance line for the sheet header: who, how much, what for, on what income. */
export function applicantGlance(a: Applicant): string {
  return `${a.name} wants ${usd(a.amountRequested)} for ${purposeWord(a.purpose)}; stated income ${usd(a.statedIncome)}.`
}

interface Props {
  a: Applicant
  /** 'flat' (default) is the desk header's always-visible dl; 'disclose' is one row that opens the full facts. */
  variant?: 'flat' | 'disclose'
}

export function ApplicantFacts({ a, variant = 'flat' }: Props) {
  if (variant === 'disclose') {
    const items: KVItem[] = [
      { label: 'Purpose', value: a.purpose },
      { label: 'Requested', value: usd(a.amountRequested) },
      { label: 'Stated income', value: usd(a.statedIncome) },
      { label: 'Card code', value: a.cardCode ? <Mono>{a.cardCode}</Mono> : 'None yet' },
      { label: 'Persona', value: <Mono>{a.personaId}</Mono> },
      { label: 'Created', value: when(a.createdAt) },
      { label: 'Consent', value: a.consentAt ? when(a.consentAt) : 'Not recorded' },
    ]
    if (a.replayOf) items.push({ label: 'Replay', value: 'Re-run of an earlier file after a tradeline dispute' })
    if (a.overrideAttempts) items.push({ label: 'Override attempts', value: `${a.overrideAttempts} by the borrower` })
    return (
      <Disclose
        id="sheet-applicant"
        tone="info"
        summary={applicantGlance(a)}
        meta={a.cardCode ? <>card {a.cardCode}</> : 'no card yet'}
        detail={<KV items={items} />}
      />
    )
  }

  const created = when(a.createdAt)
  const items: Array<[string, string]> = [
    ['Purpose', a.purpose],
    ['Requested', usd(a.amountRequested)],
    ['Stated income', usd(a.statedIncome)],
    ['Card code', a.cardCode ?? 'none yet'],
    ['Persona', a.personaId],
    ['Created', created],
  ]
  return (
    <dl className="ax-facts" aria-label="Applicant details">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd className={k === 'Card code' || k === 'Persona' ? 'mono' : ''}>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ---------------------------------------------------------------- bureau facts */

const SOURCE_WORD: Record<Bundle['source'], string> = {
  crs: 'CRS sandbox (TransUnion data)',
  nessie: 'Nessie sandbox',
  mock: 'Mock bureau',
}

/** Bureau flags as words, never as colors or booleans. */
export function flagWords(b: Bundle): string[] {
  const out: string[] = []
  if (b.flags.deceased) out.push('deceased indicator')
  if (b.flags.frozen) out.push('frozen file')
  if (b.flags.bankruptcy) out.push('bankruptcy')
  if (b.flags.eviction) out.push('eviction')
  return out
}

/** Anything on the file a loan officer should look at twice. */
export function bureauConcern(b: Bundle): boolean {
  return flagWords(b).length > 0 || !b.identity.verified || b.fraud.signals.length > 0
}

const scoreWord = (n: number | null) => (n == null ? 'not reported' : num(n))
const utilWord = (n: number | null) => (n == null ? 'not reported' : pct(n))

/** One sentence: "Bureau: TransUnion score 648, utilization 62%, 2 inquiries in 6 months, identity verified, fraud score 12." */
export function bureauGlance(b: Bundle): string {
  const c = b.credit
  const parts = [
    `TransUnion score ${scoreWord(c.fico9)}`,
    `utilization ${utilWord(c.utilization)}`,
    `${c.inquiries6mo} ${c.inquiries6mo === 1 ? 'inquiry' : 'inquiries'} in 6 months`,
    `identity ${b.identity.verified ? 'verified' : 'not verified'}`,
    `fraud score ${scoreWord(b.fraud.score)}`,
  ]
  const flags = flagWords(b)
  if (flags.length) parts.push(`flags: ${flags.join(', ')}`)
  return `Bureau: ${parts.join(', ')}.`
}

export function BureauFacts({ b }: { b: Bundle }) {
  const c = b.credit
  const flags = flagWords(b)
  const idFlags = b.identity.flags.map(describeIdentityFlag)
  const items: KVItem[] = [
    { label: 'TransUnion score', value: c.fico9 == null ? 'Not reported' : <Mono>{num(c.fico9)}</Mono> },
    { label: 'VantageScore 4', value: c.vantage4 == null ? 'Not reported' : <Mono>{num(c.vantage4)}</Mono> },
    { label: 'Utilization', value: c.utilization == null ? 'Not reported' : <Mono>{pct(c.utilization)}</Mono> },
    { label: 'Inquiries, 6 months', value: <Mono>{num(c.inquiries6mo)}</Mono> },
    {
      label: 'Identity',
      value: (
        <>
          <strong>{b.identity.verified ? 'Verified' : 'Not verified'}</strong>
          {idFlags.length ? <>: {idFlags.join('; ')}</> : null}
        </>
      ),
    },
    {
      label: 'Fraud',
      value: (
        <>
          score {b.fraud.score == null ? 'not reported' : <Mono>{num(b.fraud.score)}</Mono>}
          {b.fraud.signals.length ? <>; signals: {b.fraud.signals.join('; ')}</> : <>; no signals</>}
        </>
      ),
    },
    { label: 'Flags', value: flags.length ? <strong>{flags.join(', ')}</strong> : 'None' },
    { label: 'Source', value: SOURCE_WORD[b.source] ?? b.source },
    { label: 'Pulled', value: when(b.pulledAt) },
  ]
  return (
    <div className="bureau">
      <KV items={items} />
      {c.tradelines.length ? (
        <table className="sheet-table">
          <caption>
            Tradelines ({c.tradelines.length})
          </caption>
          <thead>
            <tr>
              <th scope="col">Type</th>
              <th scope="col" className="num">
                Balance
              </th>
              <th scope="col">Status</th>
              <th scope="col">Opened</th>
            </tr>
          </thead>
          <tbody>
            {c.tradelines.map((t, i) => (
              <tr key={i}>
                <td>{t.type}</td>
                <td className="num">{usd(t.balance)}</td>
                <td className="word">{t.status}</td>
                <td>{t.openedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="facts-note">No tradelines on file.</p>
      )}
    </div>
  )
}

/** What the sheet says when it has no bundle to show. */
export function bureauMissing(a: Applicant): { summary: string; detail: ReactNode } {
  if (a.status === 'intake' || a.status === 'pulling') {
    return {
      summary: 'Bureau file is still being pulled; the facts appear here as soon as it lands.',
      detail: <p className="facts-note">Prequal, identity and fraud products are being requested. Nothing has been read yet.</p>,
    }
  }
  return {
    summary: 'Bureau file is not attached to this sheet; open the Inspector to read it.',
    detail: <p className="facts-note">The desk holds the bureau bundle but did not pass it to this sheet. The Trace and Notice buttons still open the Inspector.</p>,
  }
}
