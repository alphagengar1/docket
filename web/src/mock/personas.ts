// Persona deck. Mirrors what personas/map.json will hold; sandbox data only, no real PII.
import type { Bundle, EvalCase, MarketRate, PersonaCard } from '../types'

export type PersonaBundle = Omit<Bundle, '_id' | 'applicantId' | 'pulledAt'>

export interface Persona extends PersonaCard {
  bundle: PersonaBundle
  /** Defaults the intake form pre-fills when this card is drawn. */
  defaults: { purpose: string; amountRequested: number; statedIncome: number }
}

const yearsAgo = (y: number) => Date.UTC(2026 - y, 3, 1)

function bundle(p: Omit<Partial<PersonaBundle>, 'credit'> & { credit?: Partial<PersonaBundle['credit']> }): PersonaBundle {
  return {
    source: 'mock',
    credit: {
      fico9: 700,
      vantage4: 705,
      tradelines: [],
      inquiries6mo: 1,
      utilization: 0.25,
      ...p.credit,
    },
    identity: p.identity ?? { verified: true, flags: [] },
    fraud: p.fraud ?? { score: 8, signals: [] },
    flags: p.flags ?? { deceased: false, frozen: false, bankruptcy: false, eviction: false },
    raw: { sandbox: true },
  }
}

export const PERSONAS: Persona[] = [
  {
    personaId: 'P01',
    name: 'Maya Chen',
    hint: 'Prime file, 780s, low utilization',
    defaults: { purpose: 'Debt consolidation', amountRequested: 18000, statedIncome: 128000 },
    bundle: bundle({
      credit: {
        fico9: 784,
        vantage4: 791,
        utilization: 0.09,
        inquiries6mo: 0,
        tradelines: [
          { type: 'mortgage', balance: 412000, status: 'current', openedAt: yearsAgo(6) },
          { type: 'credit_card', balance: 1840, status: 'current', openedAt: yearsAgo(9) },
          { type: 'auto', balance: 9200, status: 'current', openedAt: yearsAgo(2) },
        ],
      },
      fraud: { score: 3, signals: [] },
    }),
  },
  {
    personaId: 'P02',
    name: 'Devon Reyes',
    hint: 'Good score, one late payment last year',
    defaults: { purpose: 'Home improvement', amountRequested: 12000, statedIncome: 76000 },
    bundle: bundle({
      credit: {
        fico9: 712,
        vantage4: 718,
        utilization: 0.34,
        inquiries6mo: 2,
        tradelines: [
          { type: 'credit_card', balance: 6100, status: 'current', openedAt: yearsAgo(5) },
          { type: 'auto', balance: 14800, status: '30d_late_2025', openedAt: yearsAgo(3) },
          { type: 'student', balance: 22000, status: 'current', openedAt: yearsAgo(8) },
        ],
      },
      fraud: { score: 11, signals: [] },
    }),
  },
  {
    personaId: 'P03',
    name: 'Priya Natarajan',
    hint: 'Fair score, utilization above 60%',
    defaults: { purpose: 'Medical expenses', amountRequested: 9000, statedIncome: 54000 },
    bundle: bundle({
      credit: {
        fico9: 648,
        vantage4: 655,
        utilization: 0.63,
        inquiries6mo: 3,
        tradelines: [
          { type: 'credit_card', balance: 11200, status: 'current', openedAt: yearsAgo(4) },
          { type: 'credit_card', balance: 4300, status: 'current', openedAt: yearsAgo(2) },
          { type: 'personal', balance: 3100, status: 'current', openedAt: yearsAgo(1) },
        ],
      },
      fraud: { score: 14, signals: [] },
    }),
  },
  {
    personaId: 'P04',
    name: 'Luis Ortega',
    hint: 'Thin file, no FICO 9 score yet',
    defaults: { purpose: 'Vehicle purchase', amountRequested: 7500, statedIncome: 48000 },
    bundle: bundle({
      credit: {
        fico9: null,
        vantage4: 662,
        utilization: 0.18,
        inquiries6mo: 1,
        tradelines: [{ type: 'credit_card', balance: 420, status: 'current', openedAt: yearsAgo(1) }],
      },
      fraud: { score: 9, signals: [] },
    }),
  },
  {
    personaId: 'P05',
    name: 'Harold Finch',
    hint: 'Bureau deceased indicator set',
    defaults: { purpose: 'Debt consolidation', amountRequested: 15000, statedIncome: 61000 },
    bundle: bundle({
      credit: { fico9: 701, vantage4: 699, utilization: 0.22, inquiries6mo: 0 },
      flags: { deceased: true, frozen: false, bankruptcy: false, eviction: false },
      fraud: { score: 22, signals: ['bureau_deceased_indicator'] },
    }),
  },
  {
    personaId: 'P06',
    name: 'Sasha Volkov',
    hint: 'Synthetic-identity fraud signals',
    defaults: { purpose: 'Business equipment', amountRequested: 25000, statedIncome: 95000 },
    bundle: bundle({
      credit: { fico9: 733, vantage4: 740, utilization: 0.05, inquiries6mo: 7 },
      identity: { verified: true, flags: ['ssn_issued_after_dob', 'address_velocity_high'] },
      fraud: { score: 91, signals: ['ssn_issued_after_dob', 'address_velocity_high', 'authorized_user_piggyback'] },
    }),
  },
  {
    personaId: 'P07',
    name: 'Nora Whitfield',
    hint: 'Credit file is frozen',
    defaults: { purpose: 'Home improvement', amountRequested: 10000, statedIncome: 88000 },
    bundle: bundle({
      credit: { fico9: null, vantage4: null, utilization: null, inquiries6mo: 0, tradelines: [] },
      flags: { deceased: false, frozen: true, bankruptcy: false, eviction: false },
      fraud: { score: null, signals: [] },
    }),
  },
  {
    personaId: 'P08',
    name: 'Jamal Carter',
    hint: 'Identity verification failed',
    defaults: { purpose: 'Moving costs', amountRequested: 5000, statedIncome: 58000 },
    bundle: bundle({
      credit: { fico9: 690, vantage4: 684, utilization: 0.31, inquiries6mo: 2 },
      identity: { verified: false, flags: ['dob_mismatch', 'name_mismatch'] },
      fraud: { score: 41, signals: ['dob_mismatch'] },
    }),
  },
  {
    personaId: 'P09',
    name: 'Elena Petrov',
    hint: 'Chapter 7 bankruptcy, 18 months ago',
    defaults: { purpose: 'Debt consolidation', amountRequested: 8000, statedIncome: 42000 },
    bundle: bundle({
      credit: {
        fico9: 571,
        vantage4: 580,
        utilization: 0.78,
        inquiries6mo: 4,
        tradelines: [
          { type: 'credit_card', balance: 2900, status: 'current', openedAt: yearsAgo(1) },
          { type: 'credit_card', balance: 0, status: 'included_in_bankruptcy', openedAt: yearsAgo(7) },
        ],
      },
      flags: { deceased: false, frozen: false, bankruptcy: true, eviction: false },
      fraud: { score: 12, signals: [] },
    }),
  },
  {
    personaId: 'P10',
    name: 'Tom Nakamura',
    hint: 'Strong score, six inquiries this quarter',
    defaults: { purpose: 'Wedding', amountRequested: 20000, statedIncome: 102000 },
    bundle: bundle({
      credit: {
        fico9: 741,
        vantage4: 736,
        utilization: 0.27,
        inquiries6mo: 6,
        tradelines: [
          { type: 'credit_card', balance: 5400, status: 'current', openedAt: yearsAgo(6) },
          { type: 'credit_card', balance: 2200, status: 'current', openedAt: yearsAgo(0) },
          { type: 'auto', balance: 21000, status: 'current', openedAt: yearsAgo(1) },
        ],
      },
      fraud: { score: 17, signals: [] },
    }),
  },
]

export const PERSONA_CARDS: PersonaCard[] = PERSONAS.map(({ personaId, name, hint }) => ({ personaId, name, hint }))

export function personaById(id: string): Persona | undefined {
  return PERSONAS.find((p) => p.personaId === id)
}

/** Stand-in for the teammate's answer key (personas/map.json). P10 is a planted disagreement so the failures list is exercised. */
export const EVAL_CASES: EvalCase[] = [
  { _id: 'ec_P01', personaId: 'P01', expected: 'approve', expectedReasonsIncludes: [], note: 'prime, all three approve' },
  { _id: 'ec_P02', personaId: 'P02', expected: 'approve', expectedReasonsIncludes: ['credit.tradelines'], note: 'late payment costs the prime offer' },
  { _id: 'ec_P03', personaId: 'P03', expected: 'approve', expectedReasonsIncludes: ['credit.utilization'], note: 'only fintech should approve' },
  { _id: 'ec_P04', personaId: 'P04', expected: 'approve', expectedReasonsIncludes: ['credit.fico9'], note: 'thin file, fintech with conditions' },
  { _id: 'ec_P05', personaId: 'P05', expected: 'hard_stop', expectedReasonsIncludes: ['flags.deceased'], note: 'deceased indicator' },
  { _id: 'ec_P06', personaId: 'P06', expected: 'hard_stop', expectedReasonsIncludes: ['fraud.score'], note: 'fraud score 91' },
  { _id: 'ec_P07', personaId: 'P07', expected: 'hard_stop', expectedReasonsIncludes: ['flags.frozen'], note: 'frozen file' },
  { _id: 'ec_P08', personaId: 'P08', expected: 'hard_stop', expectedReasonsIncludes: ['identity.verified'], note: 'IDV failed' },
  { _id: 'ec_P09', personaId: 'P09', expected: 'decline', expectedReasonsIncludes: ['flags.bankruptcy', 'credit.fico9'], note: 'all three decline' },
  { _id: 'ec_P10', personaId: 'P10', expected: 'decline', expectedReasonsIncludes: ['credit.inquiries6mo'], note: 'PLANTED: answer key says decline; fintech and prime approve' },
]

export const MARKET_RATES: MarketRate[] = [
  { _id: 'mr_excellent', tier: 'excellent', aprLow: 6.4, aprHigh: 9.9, source: 'mock', fetchedAt: Date.UTC(2026, 9, 24, 6) },
  { _id: 'mr_good', tier: 'good', aprLow: 9.9, aprHigh: 15.5, source: 'mock', fetchedAt: Date.UTC(2026, 9, 24, 6) },
  { _id: 'mr_fair', tier: 'fair', aprLow: 15.5, aprHigh: 24.9, source: 'mock', fetchedAt: Date.UTC(2026, 9, 24, 6) },
  { _id: 'mr_poor', tier: 'poor', aprLow: 24.9, aprHigh: 35.9, source: 'mock', fetchedAt: Date.UTC(2026, 9, 24, 6) },
]
