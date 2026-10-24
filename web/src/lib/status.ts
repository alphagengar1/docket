import type { ApplicantStatus, Offer } from '../types'

export type Tone = 'muted' | 'accent' | 'text' | 'approve' | 'decline' | 'hard'

export const STATUS_WORD: Record<ApplicantStatus, string> = {
  intake: 'Intake',
  pulling: 'Pulling',
  guardrails: 'Guardrails',
  underwriting: 'Underwriting',
  compliance: 'Compliance',
  awaiting_human: 'Awaiting human',
  approved: 'Approved',
  declined: 'Declined',
  hard_stop: 'Hard stop',
}

export const STATUS_TONE: Record<ApplicantStatus, Tone> = {
  intake: 'muted',
  pulling: 'accent',
  guardrails: 'accent',
  underwriting: 'accent',
  compliance: 'accent',
  awaiting_human: 'text',
  approved: 'approve',
  declined: 'decline',
  hard_stop: 'hard',
}

export const IN_FLIGHT: ApplicantStatus[] = ['intake', 'pulling', 'guardrails', 'underwriting', 'compliance']

export function offerWord(o: Offer): { word: string; tone: Tone } {
  if (o.status === 'pending') return { word: 'Quoting', tone: 'accent' }
  if (o.status === 'failed') return { word: 'Failed', tone: 'hard' }
  if (o.decision === 'approve') return { word: 'Offer', tone: 'approve' }
  return { word: 'Declined', tone: 'decline' }
}
