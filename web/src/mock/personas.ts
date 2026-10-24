// Persona deck. Mirrors convex/crs.mock.ts (the teammate's deck) so mock and live runs show the same cards.
// Regenerate from the backend file if the deck changes. Sandbox data only, no real PII.
import type { Bundle, EvalCase, MarketRate, PersonaCard } from '../types'

export type PersonaBundle = Omit<Bundle, '_id' | 'applicantId' | 'pulledAt'>

export interface Persona extends PersonaCard {
  bundle: PersonaBundle
  /** What the intake form pre-fills when this card is drawn (same as the backend's defaultIntake). */
  defaults: { purpose: string; amountRequested: number; statedIncome: number }
}

export const PERSONAS: Persona[] = [
  {
    personaId: "P01",
    name: "Avery Lindqvist",
    hint: "Long credit history, low balances, no recent inquiries.",
    defaults: { purpose: "home improvement", amountRequested: 20000, statedIncome: 142000 },
    bundle: {
      source: 'mock',
      credit: {
        fico9: 805,
        vantage4: 812,
        tradelines: [
          { type: "mortgage", balance: 312000, status: "open", openedAt: "2015-06-01" },
          { type: "credit_card", balance: 1240, status: "open", openedAt: "2011-03-14" },
          { type: "credit_card", balance: 310, status: "open", openedAt: "2016-09-02" },
          { type: "auto", balance: 0, status: "closed", openedAt: "2014-01-10" },
        ],
        inquiries6mo: 0,
        utilization: 0.08,
      },
      identity: { verified: true, flags: [] },
      fraud: { score: 4, signals: [] },
      flags: { deceased: false, frozen: false, bankruptcy: false, eviction: false },
      raw: { provider: 'mock', personaId: "P01" },
    },
  },
  {
    personaId: "P02",
    name: "Marcus Oyelaran",
    hint: "Solid score, moderate card balances, one recent inquiry.",
    defaults: { purpose: "debt consolidation", amountRequested: 15000, statedIncome: 88000 },
    bundle: {
      source: 'mock',
      credit: {
        fico9: 735,
        vantage4: 729,
        tradelines: [
          { type: "credit_card", balance: 4200, status: "open", openedAt: "2017-05-20" },
          { type: "credit_card", balance: 2900, status: "open", openedAt: "2019-11-03" },
          { type: "auto", balance: 14800, status: "open", openedAt: "2022-02-15" },
        ],
        inquiries6mo: 1,
        utilization: 0.28,
      },
      identity: { verified: true, flags: [] },
      fraud: { score: 11, signals: [] },
      flags: { deceased: false, frozen: false, bankruptcy: false, eviction: false },
      raw: { provider: 'mock', personaId: "P02" },
    },
  },
  {
    personaId: "P03",
    name: "Priya Raghunathan",
    hint: "Fair score, balances climbing, two inquiries this spring.",
    defaults: { purpose: "medical expenses", amountRequested: 8000, statedIncome: 61000 },
    bundle: {
      source: 'mock',
      credit: {
        fico9: 665,
        vantage4: 671,
        tradelines: [
          { type: "credit_card", balance: 5600, status: "open", openedAt: "2018-08-11" },
          { type: "student_loan", balance: 21000, status: "open", openedAt: "2014-09-01" },
          { type: "credit_card", balance: 1800, status: "open", openedAt: "2021-01-25" },
        ],
        inquiries6mo: 2,
        utilization: 0.45,
      },
      identity: { verified: true, flags: [] },
      fraud: { score: 14, signals: [] },
      flags: { deceased: false, frozen: false, bankruptcy: false, eviction: false },
      raw: { provider: 'mock', personaId: "P03" },
    },
  },
  {
    personaId: "P04",
    name: "Dalton Reyes-Whitford",
    hint: "Several late payments, cards near their limits, shopping for credit.",
    defaults: { purpose: "auto repair", amountRequested: 6000, statedIncome: 39000 },
    bundle: {
      source: 'mock',
      credit: {
        fico9: 585,
        vantage4: 579,
        tradelines: [
          { type: "credit_card", balance: 3900, status: "open_30dpd", openedAt: "2019-04-02" },
          { type: "credit_card", balance: 2600, status: "open", openedAt: "2020-07-19" },
          { type: "personal_loan", balance: 4100, status: "open_60dpd", openedAt: "2023-03-08" },
        ],
        inquiries6mo: 4,
        utilization: 0.7,
      },
      identity: { verified: true, flags: [] },
      fraud: { score: 19, signals: [] },
      flags: { deceased: false, frozen: false, bankruptcy: false, eviction: false },
      raw: { provider: 'mock', personaId: "P04" },
    },
  },
  {
    personaId: "P05",
    name: "Noor Haddadin",
    hint: "Thin file: one young tradeline, no FICO yet.",
    defaults: { purpose: "laptop for school", amountRequested: 4000, statedIncome: 42000 },
    bundle: {
      source: 'mock',
      credit: {
        fico9: null,
        vantage4: 645,
        tradelines: [
          { type: "credit_card", balance: 380, status: "open", openedAt: "2026-01-15" },
        ],
        inquiries6mo: 1,
        utilization: 0.19,
      },
      identity: { verified: true, flags: [] },
      fraud: { score: 12, signals: [] },
      flags: { deceased: false, frozen: false, bankruptcy: false, eviction: false },
      raw: { provider: 'mock', personaId: "P05" },
    },
  },
  {
    personaId: "P06",
    name: "Gretchen Abernathy",
    hint: "Chapter 7 bankruptcy on file, rebuilding with a secured card.",
    defaults: { purpose: "debt consolidation", amountRequested: 7500, statedIncome: 54000 },
    bundle: {
      source: 'mock',
      credit: {
        fico9: 612,
        vantage4: 618,
        tradelines: [
          { type: "credit_card", balance: 450, status: "open", openedAt: "2024-10-01" },
          { type: "credit_card", balance: 0, status: "discharged_bk7", openedAt: "2016-02-11" },
          { type: "personal_loan", balance: 0, status: "discharged_bk7", openedAt: "2018-06-30" },
        ],
        inquiries6mo: 1,
        utilization: 0.3,
      },
      identity: { verified: true, flags: [] },
      fraud: { score: 9, signals: [] },
      flags: { deceased: false, frozen: false, bankruptcy: true, eviction: false },
      raw: { provider: 'mock', personaId: "P06" },
    },
  },
  {
    personaId: "P07",
    name: "Tobias Marchetti",
    hint: "Eviction judgment in public records, otherwise middling credit.",
    defaults: { purpose: "moving costs", amountRequested: 5000, statedIncome: 47000 },
    bundle: {
      source: 'mock',
      credit: {
        fico9: 650,
        vantage4: 644,
        tradelines: [
          { type: "credit_card", balance: 2100, status: "open", openedAt: "2019-02-14" },
          { type: "auto", balance: 9800, status: "open", openedAt: "2021-08-09" },
        ],
        inquiries6mo: 2,
        utilization: 0.42,
      },
      identity: { verified: true, flags: [] },
      fraud: { score: 16, signals: [] },
      flags: { deceased: false, frozen: false, bankruptcy: false, eviction: true },
      raw: { provider: 'mock', personaId: "P07" },
    },
  },
  {
    personaId: "P08",
    name: "Celeste Varga",
    hint: "Application details conflict with the bureau file.",
    defaults: { purpose: "business inventory", amountRequested: 25000, statedIncome: 120000 },
    bundle: {
      source: 'mock',
      credit: {
        fico9: 702,
        vantage4: 698,
        tradelines: [
          { type: "credit_card", balance: 1500, status: "open", openedAt: "2024-11-20" },
          { type: "credit_card", balance: 900, status: "open", openedAt: "2025-01-05" },
        ],
        inquiries6mo: 5,
        utilization: 0.33,
      },
      identity: {
        verified: true,
        flags: ["address_mismatch"],
      },
      fraud: {
        score: 92,
        signals: ["ssn_issued_after_dob", "address_mismatch", "phone_recently_ported", "velocity_5_apps_30d"],
      },
      flags: { deceased: false, frozen: false, bankruptcy: false, eviction: false },
      raw: { provider: 'mock', personaId: "P08" },
    },
  },
  {
    personaId: "P09",
    name: "Harold Benningfield",
    hint: "Bureau file carries a deceased indicator.",
    defaults: { purpose: "vacation", amountRequested: 10000, statedIncome: 70000 },
    bundle: {
      source: 'mock',
      credit: {
        fico9: 690,
        vantage4: 684,
        tradelines: [
          { type: "credit_card", balance: 220, status: "open", openedAt: "2009-05-05" },
          { type: "mortgage", balance: 0, status: "closed", openedAt: "2001-03-01" },
        ],
        inquiries6mo: 0,
        utilization: 0.04,
      },
      identity: {
        verified: true,
        flags: ["deceased_indicator"],
      },
      fraud: {
        score: 44,
        signals: ["deceased_indicator"],
      },
      flags: { deceased: true, frozen: false, bankruptcy: false, eviction: false },
      raw: { provider: 'mock', personaId: "P09" },
    },
  },
  {
    personaId: "P10",
    name: "Imani Oduya-Brecht",
    hint: "Credit file is frozen with the bureau.",
    defaults: { purpose: "wedding", amountRequested: 12000, statedIncome: 95000 },
    bundle: {
      source: 'mock',
      credit: { fico9: null, vantage4: null, tradelines: [], inquiries6mo: 0, utilization: null },
      identity: {
        verified: true,
        flags: ["file_frozen"],
      },
      fraud: { score: null, signals: [] },
      flags: { deceased: false, frozen: true, bankruptcy: false, eviction: false },
      raw: { provider: 'mock', personaId: "P10" },
    },
  },
  {
    personaId: "P11",
    name: "Rowan Castellanos",
    hint: "Identity could not be verified against the bureau.",
    defaults: { purpose: "home improvement", amountRequested: 9000, statedIncome: 76000 },
    bundle: {
      source: 'mock',
      credit: {
        fico9: 718,
        vantage4: 711,
        tradelines: [
          { type: "credit_card", balance: 1900, status: "open", openedAt: "2016-12-01" },
          { type: "auto", balance: 6200, status: "open", openedAt: "2022-05-18" },
        ],
        inquiries6mo: 1,
        utilization: 0.21,
      },
      identity: {
        verified: false,
        flags: ["dob_mismatch", "name_mismatch"],
      },
      fraud: {
        score: 38,
        signals: ["dob_mismatch"],
      },
      flags: { deceased: false, frozen: false, bankruptcy: false, eviction: false },
      raw: { provider: 'mock', personaId: "P11" },
    },
  },
  {
    personaId: "P12",
    name: "Soren Albrechtsen",
    hint: "Decent score but almost every card is maxed out.",
    defaults: { purpose: "debt consolidation", amountRequested: 18000, statedIncome: 82000 },
    bundle: {
      source: 'mock',
      credit: {
        fico9: 700,
        vantage4: 692,
        tradelines: [
          { type: "credit_card", balance: 9400, status: "open", openedAt: "2017-03-30" },
          { type: "credit_card", balance: 7800, status: "open", openedAt: "2018-10-12" },
          { type: "credit_card", balance: 4950, status: "open", openedAt: "2020-06-04" },
          { type: "auto", balance: 11000, status: "open", openedAt: "2023-01-20" },
        ],
        inquiries6mo: 1,
        utilization: 0.94,
      },
      identity: { verified: true, flags: [] },
      fraud: { score: 10, signals: [] },
      flags: { deceased: false, frozen: false, bankruptcy: false, eviction: false },
      raw: { provider: 'mock', personaId: "P12" },
    },
  },
  {
    personaId: "P13",
    name: "Yesenia Okonkwo-Pratt",
    hint: "Nine hard inquiries in six months.",
    defaults: { purpose: "furniture", amountRequested: 7000, statedIncome: 58000 },
    bundle: {
      source: 'mock',
      credit: {
        fico9: 690,
        vantage4: 681,
        tradelines: [
          { type: "credit_card", balance: 2300, status: "open", openedAt: "2019-09-09" },
          { type: "credit_card", balance: 1100, status: "open", openedAt: "2026-03-02" },
          { type: "personal_loan", balance: 5000, status: "open", openedAt: "2026-04-15" },
        ],
        inquiries6mo: 9,
        utilization: 0.36,
      },
      identity: { verified: true, flags: [] },
      fraud: {
        score: 21,
        signals: ["velocity_9_inquiries_6mo"],
      },
      flags: { deceased: false, frozen: false, bankruptcy: false, eviction: false },
      raw: { provider: 'mock', personaId: "P13" },
    },
  },
  {
    personaId: "P14",
    name: "Bartholomew Nkemelu",
    hint: "Good score, asking for far more than the stated income supports.",
    defaults: { purpose: "boat", amountRequested: 30000, statedIncome: 28000 },
    bundle: {
      source: 'mock',
      credit: {
        fico9: 720,
        vantage4: 715,
        tradelines: [
          { type: "credit_card", balance: 800, status: "open", openedAt: "2015-07-07" },
          { type: "student_loan", balance: 12000, status: "open", openedAt: "2012-09-01" },
        ],
        inquiries6mo: 1,
        utilization: 0.2,
      },
      identity: { verified: true, flags: [] },
      fraud: { score: 7, signals: [] },
      flags: { deceased: false, frozen: false, bankruptcy: false, eviction: false },
      raw: { provider: 'mock', personaId: "P14" },
    },
  },
  {
    personaId: "P15",
    name: "Lucinda Petrosyan",
    hint: "Good credit; moderate fraud signals around a recent phone change.",
    defaults: { purpose: "home improvement", amountRequested: 10000, statedIncome: 90000 },
    bundle: {
      source: 'mock',
      credit: {
        fico9: 710,
        vantage4: 704,
        tradelines: [
          { type: "credit_card", balance: 2600, status: "open", openedAt: "2014-04-22" },
          { type: "mortgage", balance: 210000, status: "open", openedAt: "2019-08-30" },
        ],
        inquiries6mo: 1,
        utilization: 0.24,
      },
      identity: {
        verified: true,
        flags: ["phone_recently_ported"],
      },
      fraud: {
        score: 55,
        signals: ["phone_recently_ported", "new_email_domain"],
      },
      flags: { deceased: false, frozen: false, bankruptcy: false, eviction: false },
      raw: { provider: 'mock', personaId: "P15" },
    },
  },
  {
    personaId: "P16",
    name: "Kwame Delacroix-Osei",
    hint: "Near-prime: a few dings, improving over the last year.",
    defaults: { purpose: "debt consolidation", amountRequested: 9000, statedIncome: 64000 },
    bundle: {
      source: 'mock',
      credit: {
        fico9: 625,
        vantage4: 633,
        tradelines: [
          { type: "credit_card", balance: 3300, status: "open", openedAt: "2018-01-18" },
          { type: "credit_card", balance: 2100, status: "open_30dpd_12mo_ago", openedAt: "2020-11-02" },
          { type: "auto", balance: 8700, status: "open", openedAt: "2022-09-14" },
        ],
        inquiries6mo: 3,
        utilization: 0.6,
      },
      identity: { verified: true, flags: [] },
      fraud: { score: 13, signals: [] },
      flags: { deceased: false, frozen: false, bankruptcy: false, eviction: false },
      raw: { provider: 'mock', personaId: "P16" },
    },
  },
  {
    personaId: "P17",
    name: "Beatrix Oyinlola",
    hint: "Excellent score, but rate-shopped three lenders recently.",
    defaults: { purpose: "solar panels", amountRequested: 22000, statedIncome: 130000 },
    bundle: {
      source: 'mock',
      credit: {
        fico9: 760,
        vantage4: 766,
        tradelines: [
          { type: "mortgage", balance: 398000, status: "open", openedAt: "2018-05-25" },
          { type: "credit_card", balance: 2100, status: "open", openedAt: "2010-10-10" },
          { type: "auto", balance: 19000, status: "open", openedAt: "2025-12-01" },
        ],
        inquiries6mo: 3,
        utilization: 0.15,
      },
      identity: { verified: true, flags: [] },
      fraud: { score: 6, signals: [] },
      flags: { deceased: false, frozen: false, bankruptcy: false, eviction: false },
      raw: { provider: 'mock', personaId: "P17" },
    },
  },
  {
    personaId: "P18",
    name: "Vance Thibodeaux",
    hint: "Low score plus a cluster of synthetic-identity signals.",
    defaults: { purpose: "electronics", amountRequested: 3000, statedIncome: 45000 },
    bundle: {
      source: 'mock',
      credit: {
        fico9: 560,
        vantage4: 571,
        tradelines: [
          { type: "credit_card", balance: 1400, status: "open", openedAt: "2025-09-01" },
          { type: "credit_card", balance: 980, status: "open", openedAt: "2025-10-20" },
        ],
        inquiries6mo: 6,
        utilization: 0.88,
      },
      identity: {
        verified: true,
        flags: ["authorized_user_pile_on"],
      },
      fraud: {
        score: 81,
        signals: ["authorized_user_pile_on", "ssn_thin_history", "velocity_6_inquiries_6mo"],
      },
      flags: { deceased: false, frozen: false, bankruptcy: false, eviction: false },
      raw: { provider: 'mock', personaId: "P18" },
    },
  },
  {
    personaId: "P19",
    name: "Eleanor Vasquez-Stroud",
    hint: "Spotless prime file. Read the whole record.",
    defaults: { purpose: "kitchen remodel", amountRequested: 35000, statedIncome: 160000 },
    bundle: {
      source: 'mock',
      credit: {
        fico9: 812,
        vantage4: 819,
        tradelines: [
          { type: "mortgage", balance: 0, status: "closed", openedAt: "1998-04-01" },
          { type: "credit_card", balance: 90, status: "open", openedAt: "2003-02-14" },
          { type: "credit_card", balance: 0, status: "open", openedAt: "2008-08-08" },
        ],
        inquiries6mo: 0,
        utilization: 0.01,
      },
      identity: {
        verified: true,
        flags: ["deceased_indicator"],
      },
      fraud: {
        score: 30,
        signals: ["deceased_indicator", "no_activity_18mo"],
      },
      flags: { deceased: true, frozen: false, bankruptcy: false, eviction: false },
      raw: { provider: 'mock', personaId: "P19" },
    },
  },
  {
    personaId: "P20",
    name: "Desmond Achterberg",
    hint: "Old bankruptcy, score recovered into the mid 600s.",
    defaults: { purpose: "debt consolidation", amountRequested: 6000, statedIncome: 72000 },
    bundle: {
      source: 'mock',
      credit: {
        fico9: 655,
        vantage4: 661,
        tradelines: [
          { type: "credit_card", balance: 1900, status: "open", openedAt: "2021-05-05" },
          { type: "auto", balance: 13500, status: "open", openedAt: "2023-07-12" },
          { type: "credit_card", balance: 0, status: "discharged_bk7", openedAt: "2012-01-30" },
        ],
        inquiries6mo: 1,
        utilization: 0.27,
      },
      identity: { verified: true, flags: [] },
      fraud: { score: 9, signals: [] },
      flags: { deceased: false, frozen: false, bankruptcy: true, eviction: false },
      raw: { provider: 'mock', personaId: "P20" },
    },
  },
]

export const PERSONA_CARDS: PersonaCard[] = PERSONAS.map(({ personaId, name, hint }) => ({ personaId, name, hint }))

export function personaById(id: string): Persona | undefined {
  return PERSONAS.find((p) => p.personaId === id)
}

/** Mirrors personas/map.json (the answer key). P03's expectedReasonsIncludes is a planted disagreement so the failures list is exercised. */
export const EVAL_CASES: EvalCase[] = [
  { _id: 'ec_P01', personaId: "P01", expected: "approve", expectedReasonsIncludes: [], note: "prime: all three lenders should approve" },
  { _id: 'ec_P02', personaId: "P02", expected: "approve", expectedReasonsIncludes: [], note: "good: cu + fintech + prime approve" },
  { _id: 'ec_P03', personaId: "P03", expected: "approve", expectedReasonsIncludes: ["credit.inquiries6mo"], note: "PLANTED: answer key cites inquiries, but 2 inquiries is under every cap" },
  { _id: 'ec_P04', personaId: "P04", expected: "decline", expectedReasonsIncludes: ["credit.fico9"], note: "subprime: below every floor, late payments, 70% utilization" },
  { _id: 'ec_P05', personaId: "P05", expected: "approve", expectedReasonsIncludes: [], note: "thin file: fintech starter loan on vantage4 with income verification condition" },
  { _id: 'ec_P06', personaId: "P06", expected: "decline", expectedReasonsIncludes: ["flags.bankruptcy"], note: "bankruptcy with score under fintech's 640 bankruptcy floor" },
  { _id: 'ec_P07', personaId: "P07", expected: "decline", expectedReasonsIncludes: ["flags.eviction"], note: "eviction is a decline at all three lenders" },
  { _id: 'ec_P08', personaId: "P08", expected: "hard_stop", expectedReasonsIncludes: ["fraud.score"], note: "fraud score 92 >= 80" },
  { _id: 'ec_P09', personaId: "P09", expected: "hard_stop", expectedReasonsIncludes: ["flags.deceased"], note: "deceased indicator" },
  { _id: 'ec_P10', personaId: "P10", expected: "hard_stop", expectedReasonsIncludes: ["flags.frozen"], note: "frozen file" },
  { _id: 'ec_P11', personaId: "P11", expected: "hard_stop", expectedReasonsIncludes: ["identity.verified"], note: "IDV fail" },
  { _id: 'ec_P12', personaId: "P12", expected: "decline", expectedReasonsIncludes: ["credit.utilization"], note: "94% utilization exceeds every policy cap" },
  { _id: 'ec_P13', personaId: "P13", expected: "decline", expectedReasonsIncludes: ["credit.inquiries6mo"], note: "9 inquiries exceeds every policy cap" },
  { _id: 'ec_P14', personaId: "P14", expected: "decline", expectedReasonsIncludes: ["statedIncome"], note: "amount requested exceeds every income-based max by more than the counter-offer margin" },
  { _id: 'ec_P15', personaId: "P15", expected: "approve", expectedReasonsIncludes: [], note: "fraud score 55 is below the 80 hard stop; cu and fintech approve with identity review condition, prime declines" },
  { _id: 'ec_P16', personaId: "P16", expected: "approve", expectedReasonsIncludes: [], note: "near-prime: fintech only" },
  { _id: 'ec_P17', personaId: "P17", expected: "approve", expectedReasonsIncludes: [], note: "excellent score; prime declines on 3 inquiries, cu and fintech approve" },
  { _id: 'ec_P18', personaId: "P18", expected: "hard_stop", expectedReasonsIncludes: ["fraud.score"], note: "fraud score 81, boundary case at >= 80" },
  { _id: 'ec_P19', personaId: "P19", expected: "hard_stop", expectedReasonsIncludes: ["flags.deceased"], note: "planted trap: perfect score, deceased flag. The LLM never sees it." },
  { _id: 'ec_P20', personaId: "P20", expected: "approve", expectedReasonsIncludes: [], note: "old bankruptcy, score 655 >= fintech's 640 bankruptcy floor; fintech approves with condition" },
]

export const MARKET_RATES: MarketRate[] = [
  { _id: 'mr_excellent', tier: 'excellent', aprLow: 6.4, aprHigh: 9.9, source: 'mock', fetchedAt: Date.UTC(2026, 9, 24, 6) },
  { _id: 'mr_good', tier: 'good', aprLow: 9.9, aprHigh: 15.5, source: 'mock', fetchedAt: Date.UTC(2026, 9, 24, 6) },
  { _id: 'mr_fair', tier: 'fair', aprLow: 15.5, aprHigh: 24.9, source: 'mock', fetchedAt: Date.UTC(2026, 9, 24, 6) },
  { _id: 'mr_poor', tier: 'poor', aprLow: 24.9, aprHigh: 35.9, source: 'mock', fetchedAt: Date.UTC(2026, 9, 24, 6) },
]
