// FALLBACK ONLY: 20 synthetic personas in the bundle shape (used when a persona has no CRS fixture).
// Names and numbers here are invented. `hint` is the one-line description shown in the picker (never the outcome).
// `defaultIntake` is what the eval runner types into the intake form.
import type { BundleData, Tradeline } from "./types";

export type Persona = {
  personaId: string;
  name: string;
  hint: string;
  defaultIntake: { purpose: string; amountRequested: number; statedIncome: number };
  bundle: BundleData;
};

const tl = (type: string, balance: number, status: string, openedAt: string): Tradeline => ({
  type,
  balance,
  status,
  openedAt,
});

const clean = { verified: true, flags: [] as string[] };
const noFraud = { score: 8, signals: [] as string[] };
const noFlags = { deceased: false, frozen: false, bankruptcy: false, eviction: false };

const SYNTHETIC_PERSONAS: Persona[] = [
  {
    personaId: "P01",
    name: "Avery Lindqvist",
    hint: "Long credit history, low balances, no recent inquiries.",
    defaultIntake: { purpose: "home improvement", amountRequested: 20000, statedIncome: 142000 },
    bundle: {
      credit: {
        fico9: 805,
        vantage4: 812,
        tradelines: [
          tl("mortgage", 312000, "open", "2015-06-01"),
          tl("credit_card", 1240, "open", "2011-03-14"),
          tl("credit_card", 310, "open", "2016-09-02"),
          tl("auto", 0, "closed", "2014-01-10"),
        ],
        inquiries6mo: 0,
        utilization: 0.08,
      },
      identity: clean,
      fraud: { score: 4, signals: [] },
      flags: noFlags,
    },
  },
  {
    personaId: "P02",
    name: "Marcus Oyelaran",
    hint: "Solid score, moderate card balances, one recent inquiry.",
    defaultIntake: { purpose: "debt consolidation", amountRequested: 15000, statedIncome: 88000 },
    bundle: {
      credit: {
        fico9: 735,
        vantage4: 729,
        tradelines: [
          tl("credit_card", 4200, "open", "2017-05-20"),
          tl("credit_card", 2900, "open", "2019-11-03"),
          tl("auto", 14800, "open", "2022-02-15"),
        ],
        inquiries6mo: 1,
        utilization: 0.28,
      },
      identity: clean,
      fraud: { score: 11, signals: [] },
      flags: noFlags,
    },
  },
  {
    personaId: "P03",
    name: "Priya Raghunathan",
    hint: "Fair score, balances climbing, two inquiries this spring.",
    defaultIntake: { purpose: "medical expenses", amountRequested: 8000, statedIncome: 61000 },
    bundle: {
      credit: {
        fico9: 665,
        vantage4: 671,
        tradelines: [
          tl("credit_card", 5600, "open", "2018-08-11"),
          tl("student_loan", 21000, "open", "2014-09-01"),
          tl("credit_card", 1800, "open", "2021-01-25"),
        ],
        inquiries6mo: 2,
        utilization: 0.45,
      },
      identity: clean,
      fraud: { score: 14, signals: [] },
      flags: noFlags,
    },
  },
  {
    personaId: "P04",
    name: "Dalton Reyes-Whitford",
    hint: "Several late payments, cards near their limits, shopping for credit.",
    defaultIntake: { purpose: "auto repair", amountRequested: 6000, statedIncome: 39000 },
    bundle: {
      credit: {
        fico9: 585,
        vantage4: 579,
        tradelines: [
          tl("credit_card", 3900, "open_30dpd", "2019-04-02"),
          tl("credit_card", 2600, "open", "2020-07-19"),
          tl("personal_loan", 4100, "open_60dpd", "2023-03-08"),
        ],
        inquiries6mo: 4,
        utilization: 0.7,
      },
      identity: clean,
      fraud: { score: 19, signals: [] },
      flags: noFlags,
    },
  },
  {
    personaId: "P05",
    name: "Noor Haddadin",
    hint: "Thin file: one young tradeline, no FICO yet.",
    defaultIntake: { purpose: "laptop for school", amountRequested: 4000, statedIncome: 42000 },
    bundle: {
      credit: {
        fico9: null,
        vantage4: 645,
        tradelines: [tl("credit_card", 380, "open", "2026-01-15")],
        inquiries6mo: 1,
        utilization: 0.19,
      },
      identity: clean,
      fraud: { score: 12, signals: [] },
      flags: noFlags,
    },
  },
  {
    personaId: "P06",
    name: "Gretchen Abernathy",
    hint: "Chapter 7 bankruptcy on file, rebuilding with a secured card.",
    defaultIntake: { purpose: "debt consolidation", amountRequested: 7500, statedIncome: 54000 },
    bundle: {
      credit: {
        fico9: 612,
        vantage4: 618,
        tradelines: [
          tl("credit_card", 450, "open", "2024-10-01"),
          tl("credit_card", 0, "discharged_bk7", "2016-02-11"),
          tl("personal_loan", 0, "discharged_bk7", "2018-06-30"),
        ],
        inquiries6mo: 1,
        utilization: 0.3,
      },
      identity: clean,
      fraud: { score: 9, signals: [] },
      flags: { ...noFlags, bankruptcy: true },
    },
  },
  {
    personaId: "P07",
    name: "Tobias Marchetti",
    hint: "Eviction judgment in public records, otherwise middling credit.",
    defaultIntake: { purpose: "moving costs", amountRequested: 5000, statedIncome: 47000 },
    bundle: {
      credit: {
        fico9: 650,
        vantage4: 644,
        tradelines: [
          tl("credit_card", 2100, "open", "2019-02-14"),
          tl("auto", 9800, "open", "2021-08-09"),
        ],
        inquiries6mo: 2,
        utilization: 0.42,
      },
      identity: clean,
      fraud: { score: 16, signals: [] },
      flags: { ...noFlags, eviction: true },
    },
  },
  {
    personaId: "P08",
    name: "Celeste Varga",
    hint: "Application details conflict with the bureau file.",
    defaultIntake: { purpose: "business inventory", amountRequested: 25000, statedIncome: 120000 },
    bundle: {
      credit: {
        fico9: 702,
        vantage4: 698,
        tradelines: [
          tl("credit_card", 1500, "open", "2024-11-20"),
          tl("credit_card", 900, "open", "2025-01-05"),
        ],
        inquiries6mo: 5,
        utilization: 0.33,
      },
      identity: { verified: true, flags: ["address_mismatch"] },
      fraud: {
        score: 92,
        signals: ["ssn_issued_after_dob", "address_mismatch", "phone_recently_ported", "velocity_5_apps_30d"],
      },
      flags: noFlags,
    },
  },
  {
    personaId: "P09",
    name: "Harold Benningfield",
    hint: "Bureau file carries a deceased indicator.",
    defaultIntake: { purpose: "vacation", amountRequested: 10000, statedIncome: 70000 },
    bundle: {
      credit: {
        fico9: 690,
        vantage4: 684,
        tradelines: [tl("credit_card", 220, "open", "2009-05-05"), tl("mortgage", 0, "closed", "2001-03-01")],
        inquiries6mo: 0,
        utilization: 0.04,
      },
      identity: { verified: true, flags: ["deceased_indicator"] },
      fraud: { score: 44, signals: ["deceased_indicator"] },
      flags: { ...noFlags, deceased: true },
    },
  },
  {
    personaId: "P10",
    name: "Imani Oduya-Brecht",
    hint: "Credit file is frozen with the bureau.",
    defaultIntake: { purpose: "wedding", amountRequested: 12000, statedIncome: 95000 },
    bundle: {
      credit: {
        fico9: null,
        vantage4: null,
        tradelines: [],
        inquiries6mo: 0,
        utilization: null,
      },
      identity: { verified: true, flags: ["file_frozen"] },
      fraud: { score: null, signals: [] },
      flags: { ...noFlags, frozen: true },
    },
  },
  {
    personaId: "P11",
    name: "Rowan Castellanos",
    hint: "Identity could not be verified against the bureau.",
    defaultIntake: { purpose: "home improvement", amountRequested: 9000, statedIncome: 76000 },
    bundle: {
      credit: {
        fico9: 718,
        vantage4: 711,
        tradelines: [tl("credit_card", 1900, "open", "2016-12-01"), tl("auto", 6200, "open", "2022-05-18")],
        inquiries6mo: 1,
        utilization: 0.21,
      },
      identity: { verified: false, flags: ["dob_mismatch", "name_mismatch"] },
      fraud: { score: 38, signals: ["dob_mismatch"] },
      flags: noFlags,
    },
  },
  {
    personaId: "P12",
    name: "Soren Albrechtsen",
    hint: "Decent score but almost every card is maxed out.",
    defaultIntake: { purpose: "debt consolidation", amountRequested: 18000, statedIncome: 82000 },
    bundle: {
      credit: {
        fico9: 700,
        vantage4: 692,
        tradelines: [
          tl("credit_card", 9400, "open", "2017-03-30"),
          tl("credit_card", 7800, "open", "2018-10-12"),
          tl("credit_card", 4950, "open", "2020-06-04"),
          tl("auto", 11000, "open", "2023-01-20"),
        ],
        inquiries6mo: 1,
        utilization: 0.94,
      },
      identity: clean,
      fraud: { score: 10, signals: [] },
      flags: noFlags,
    },
  },
  {
    personaId: "P13",
    name: "Yesenia Okonkwo-Pratt",
    hint: "Nine hard inquiries in six months.",
    defaultIntake: { purpose: "furniture", amountRequested: 7000, statedIncome: 58000 },
    bundle: {
      credit: {
        fico9: 690,
        vantage4: 681,
        tradelines: [
          tl("credit_card", 2300, "open", "2019-09-09"),
          tl("credit_card", 1100, "open", "2026-03-02"),
          tl("personal_loan", 5000, "open", "2026-04-15"),
        ],
        inquiries6mo: 9,
        utilization: 0.36,
      },
      identity: clean,
      fraud: { score: 21, signals: ["velocity_9_inquiries_6mo"] },
      flags: noFlags,
    },
  },
  {
    personaId: "P14",
    name: "Bartholomew Nkemelu",
    hint: "Good score, asking for far more than the stated income supports.",
    defaultIntake: { purpose: "boat", amountRequested: 30000, statedIncome: 28000 },
    bundle: {
      credit: {
        fico9: 720,
        vantage4: 715,
        tradelines: [tl("credit_card", 800, "open", "2015-07-07"), tl("student_loan", 12000, "open", "2012-09-01")],
        inquiries6mo: 1,
        utilization: 0.2,
      },
      identity: clean,
      fraud: { score: 7, signals: [] },
      flags: noFlags,
    },
  },
  {
    personaId: "P15",
    name: "Lucinda Petrosyan",
    hint: "Good credit; moderate fraud signals around a recent phone change.",
    defaultIntake: { purpose: "home improvement", amountRequested: 10000, statedIncome: 90000 },
    bundle: {
      credit: {
        fico9: 710,
        vantage4: 704,
        tradelines: [tl("credit_card", 2600, "open", "2014-04-22"), tl("mortgage", 210000, "open", "2019-08-30")],
        inquiries6mo: 1,
        utilization: 0.24,
      },
      identity: { verified: true, flags: ["phone_recently_ported"] },
      fraud: { score: 55, signals: ["phone_recently_ported", "new_email_domain"] },
      flags: noFlags,
    },
  },
  {
    personaId: "P16",
    name: "Kwame Delacroix-Osei",
    hint: "Near-prime: a few dings, improving over the last year.",
    defaultIntake: { purpose: "debt consolidation", amountRequested: 9000, statedIncome: 64000 },
    bundle: {
      credit: {
        fico9: 625,
        vantage4: 633,
        tradelines: [
          tl("credit_card", 3300, "open", "2018-01-18"),
          tl("credit_card", 2100, "open_30dpd_12mo_ago", "2020-11-02"),
          tl("auto", 8700, "open", "2022-09-14"),
        ],
        inquiries6mo: 3,
        utilization: 0.6,
      },
      identity: clean,
      fraud: { score: 13, signals: [] },
      flags: noFlags,
    },
  },
  {
    personaId: "P17",
    name: "Beatrix Oyinlola",
    hint: "Excellent score, but rate-shopped three lenders recently.",
    defaultIntake: { purpose: "solar panels", amountRequested: 22000, statedIncome: 130000 },
    bundle: {
      credit: {
        fico9: 760,
        vantage4: 766,
        tradelines: [
          tl("mortgage", 398000, "open", "2018-05-25"),
          tl("credit_card", 2100, "open", "2010-10-10"),
          tl("auto", 19000, "open", "2025-12-01"),
        ],
        inquiries6mo: 3,
        utilization: 0.15,
      },
      identity: clean,
      fraud: { score: 6, signals: [] },
      flags: noFlags,
    },
  },
  {
    personaId: "P18",
    name: "Vance Thibodeaux",
    hint: "Low score plus a cluster of synthetic-identity signals.",
    defaultIntake: { purpose: "electronics", amountRequested: 3000, statedIncome: 45000 },
    bundle: {
      credit: {
        fico9: 560,
        vantage4: 571,
        tradelines: [tl("credit_card", 1400, "open", "2025-09-01"), tl("credit_card", 980, "open", "2025-10-20")],
        inquiries6mo: 6,
        utilization: 0.88,
      },
      identity: { verified: true, flags: ["authorized_user_pile_on"] },
      fraud: { score: 81, signals: ["authorized_user_pile_on", "ssn_thin_history", "velocity_6_inquiries_6mo"] },
      flags: noFlags,
    },
  },
  {
    personaId: "P19",
    name: "Eleanor Vasquez-Stroud",
    hint: "Spotless prime file. Read the whole record.",
    defaultIntake: { purpose: "kitchen remodel", amountRequested: 35000, statedIncome: 160000 },
    bundle: {
      credit: {
        fico9: 812,
        vantage4: 819,
        tradelines: [
          tl("mortgage", 0, "closed", "1998-04-01"),
          tl("credit_card", 90, "open", "2003-02-14"),
          tl("credit_card", 0, "open", "2008-08-08"),
        ],
        inquiries6mo: 0,
        utilization: 0.01,
      },
      identity: { verified: true, flags: ["deceased_indicator"] },
      fraud: { score: 30, signals: ["deceased_indicator", "no_activity_18mo"] },
      flags: { ...noFlags, deceased: true },
    },
  },
  {
    personaId: "P20",
    name: "Desmond Achterberg",
    hint: "Old bankruptcy, score recovered into the mid 600s.",
    defaultIntake: { purpose: "debt consolidation", amountRequested: 6000, statedIncome: 72000 },
    bundle: {
      credit: {
        fico9: 655,
        vantage4: 661,
        tradelines: [
          tl("credit_card", 1900, "open", "2021-05-05"),
          tl("auto", 13500, "open", "2023-07-12"),
          tl("credit_card", 0, "discharged_bk7", "2012-01-30"),
        ],
        inquiries6mo: 1,
        utilization: 0.27,
      },
      identity: clean,
      fraud: { score: 9, signals: [] },
      flags: { ...noFlags, bankruptcy: true },
    },
  },
];

// ---------------------------------------------------------------------------
// Serving layer. Default = fixtures captured from the live CRS sandbox
// (convex/crs.fixtures.ts, full raw in convex/fixtures/crs/Pxx.json). The old
// synthetic generator above is only a fallback for a persona with no fixture.
// ---------------------------------------------------------------------------
import { CRS_FIXTURES } from "./crs.fixtures.ts";
import { personaCodes } from "./crs.personas.ts";

// What the eval types into the intake form for each real CRS persona.
const INTAKE: Record<string, { purpose: string; amountRequested: number; statedIncome: number }> = {
  P01: { purpose: "home improvement", amountRequested: 20000, statedIncome: 142000 },
  P02: { purpose: "home improvement", amountRequested: 30000, statedIncome: 210000 },
  P03: { purpose: "first car repair", amountRequested: 5000, statedIncome: 38000 },
  P04: { purpose: "moving costs", amountRequested: 8000, statedIncome: 52000 },
  P05: { purpose: "debt consolidation", amountRequested: 7000, statedIncome: 41000 },
  P06: { purpose: "debt consolidation", amountRequested: 9000, statedIncome: 58000 },
  P07: { purpose: "debt consolidation", amountRequested: 8000, statedIncome: 47000 },
  P08: { purpose: "debt consolidation", amountRequested: 15000, statedIncome: 96000 },
  P09: { purpose: "personal", amountRequested: 10000, statedIncome: 64000 },
  P10: { purpose: "home improvement", amountRequested: 12000, statedIncome: 72000 },
  P11: { purpose: "moving costs", amountRequested: 6000, statedIncome: 44000 },
  P12: { purpose: "debt consolidation", amountRequested: 18000, statedIncome: 82000 },
  P13: { purpose: "personal", amountRequested: 10000, statedIncome: 55000 },
  P14: { purpose: "personal", amountRequested: 10000, statedIncome: 60000 },
  P15: { purpose: "home improvement", amountRequested: 15000, statedIncome: 88000 },
  P16: { purpose: "medical expenses", amountRequested: 12000, statedIncome: 79000 },
  P17: { purpose: "home improvement", amountRequested: 20000, statedIncome: 105000 },
  P18: { purpose: "debt consolidation", amountRequested: 9000, statedIncome: 62000 },
  P19: { purpose: "business equipment", amountRequested: 25000, statedIncome: 130000 },
  P20: { purpose: "medical expenses", amountRequested: 5000, statedIncome: 34000 },
};

/** The old synthetic generator (kept for rules.test.ts and as a per-persona fallback). */
export const PERSONAS = SYNTHETIC_PERSONAS;

export function findSynthetic(personaId: string): Persona | undefined {
  return SYNTHETIC_PERSONAS.find((p) => p.personaId === personaId);
}

export function findPersona(personaId: string): Persona | undefined {
  const fx = CRS_FIXTURES[personaId];
  const syn = findSynthetic(personaId);
  if (!fx) return syn;
  return {
    personaId,
    name: fx.displayName,
    hint: fx.about, // never the label: the deck must not reveal the outcome
    defaultIntake: INTAKE[personaId] ?? syn?.defaultIntake ?? { purpose: "personal", amountRequested: 10000, statedIncome: 60000 },
    bundle: fx.bundle,
  };
}

export function listPersonaSummaries() {
  const ids = [...new Set([...Object.keys(CRS_FIXTURES), ...SYNTHETIC_PERSONAS.map((p) => p.personaId)])].sort();
  return ids.map((id) => {
    const p = findPersona(id)!;
    return { personaId: p.personaId, name: p.name, hint: p.hint, code: personaCodes[id] ?? null };
  });
}

export function mockBundle(personaId: string): BundleData & { raw: unknown } {
  const fx = CRS_FIXTURES[personaId];
  if (fx) {
    return {
      ...JSON.parse(JSON.stringify(fx.bundle)),
      raw: { provider: "fixture", personaId, bureaus: fx.bureaus, notes: fx.notes, extras: fx.extras, fixture: `convex/fixtures/crs/${personaId}.json` },
    };
  }
  const p = findSynthetic(personaId);
  if (!p) throw new Error(`unknown personaId ${personaId}`);
  return { ...p.bundle, raw: { provider: "mock-synthetic", personaId, name: p.name } };
}
