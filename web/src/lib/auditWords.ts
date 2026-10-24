// Audit rows as words. Shared by the Drawer, the decision sheet's trace and the board's hard-stop
// log so an action identifier (`step.pull.start`, `underwrite.decline`) or a raw ref (a Convex id,
// `credit.tradelines[0]`, `flags.lienOrJudgment`) is never printed as-is.
import { LENDERS } from '../types'
import { reasonLabel } from '../components/ReasonList'

export const ACTION_WORDS: Record<string, string> = {
  'intake.submitted': 'Application received',
  'intake.source': 'Application received',
  'intake.replay': 'Replay started',
  'replay.started': 'Replay started',
  'dispute.tradeline': 'Tradeline disputed',
  'crs.error': 'Bureau pull failed',
  'desk.error': 'Pipeline error',
  'rules.pass': 'Rules passed',
  'rules.hard_stop': 'Hard stop',
  hard_stop: 'Hard stop',
  'underwrite.started': 'Started reading the file',
  'underwrite.start': 'Started reading the file',
  'underwrite.approve': 'Offered',
  'underwrite.decline': 'Declined',
  'underwrite.done': 'Decision returned',
  'underwrite.failed': 'Did not answer',
  'verify.requested': 'Re-test requested',
  'verify.supported': 'Reason holds up',
  'verify.unsupported': 'Reason does not hold up',
  'verify.inconclusive': 'Reason inconclusive',
  'verify.sanity': 'Sanity check',
  'compliance.notice': 'Notice drafted',
  'compliance.failed': 'Notice failed',
  'compliance.unverified_reasons_used': 'Unverified reasons kept',
  'notice.approved': 'Notice signed',
  'offer.chosen': 'Borrower chose an offer',
  'override.blocked': 'Override refused',
  'step.compliance.skipped': 'Notice not required',
}

export const STEP_WORD: Record<string, string> = {
  pull: 'Bureau pull',
  guardrails: 'Hard-stop rules',
  underwrite: 'Underwriting',
  verify: 'Reason verification',
  compliance: 'Notice',
  human: 'Human review',
}

/** Convex document ids (30–34 lower-case alphanumerics) and mock ids (`app_1`, `off_12`). */
export const CONVEX_ID = /^[a-z0-9]{30,34}$/
const MOCK_ID = /^[a-z]+_[a-z0-9]+$/i
const LONG_TOKEN = /^[a-z0-9]{20,}$/i

export const looksLikeId = (s: string) => CONVEX_ID.test(s) || MOCK_ID.test(s) || LONG_TOKEN.test(s)

export function actionWords(action: string): string {
  if (ACTION_WORDS[action]) return ACTION_WORDS[action]
  const m = /^step\.([a-z]+)\.(start|done|skipped)$/.exec(action)
  if (m) return `${STEP_WORD[m[1]] ?? m[1]} ${m[2] === 'start' ? 'started' : m[2] === 'done' ? 'finished' : 'skipped'}`
  return action.replace(/[._]/g, ' ')
}

const lenderLabel = (id: string) => LENDERS.find((l) => l.id === id)?.label ?? id

/** An audit ref as words, or null when it is an id (ids never reach the screen). */
export function refWords(ref: string | null | undefined): string | null {
  if (!ref || looksLikeId(ref)) return null
  const tl = /^credit\.tradelines\[(\d+)\]$/.exec(ref)
  if (tl) return `tradeline ${Number(tl[1]) + 1}`
  const of = /^offers\.(\w+)$/.exec(ref)
  if (of) return `${lenderLabel(of[1])} offer`
  return reasonLabel(ref)
}

/** Capitalize the first letter and close with a period unless the text already ends a sentence. */
export function asSentence(s: string): string {
  const t = s.trim()
  if (!t) return t
  const cap = t.charAt(0).toUpperCase() + t.slice(1)
  return /[.!?…]$/.test(cap) ? cap : `${cap}.`
}
