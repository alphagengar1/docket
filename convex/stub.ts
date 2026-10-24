// Deterministic underwriter + compliance used when no ANTHROPIC_API_KEY is set
// (or AGENT_PROVIDER_*=stub). It applies the SAME thresholds written in
// policies/*.md so the board has believable data without an LLM. Pure functions.
import type { ComplianceInput, Lender, Reason, UnderwriterInput, UnderwriterOutput } from "./types";
import { LENDER_NAMES } from "./policies";

type Band = { min: number; apr: number };

const pct = (x: number | null) => (x == null ? "n/a" : `${Math.round(x * 100)}%`);
const usd = (x: number) => `$${Math.round(x).toLocaleString("en-US")}`;

type PolicyNumbers = {
  minScore: number;
  requireFico: boolean;
  maxUtil: number;
  maxInq: number;
  fraudDecline: number;
  fraudCondition: [number, number] | null;
  fraudConditionText: string;
  bankruptcy: "decline" | { minScore: number; condition: string };
  incomePct: number;
  cap: number;
  minAmount: number;
  bands: Band[];
  term: (amount: number) => number;
  always: string[];
};

const P: Record<Lender, PolicyNumbers> = {
  cu: {
    minScore: 660,
    requireFico: true,
    maxUtil: 0.5,
    maxInq: 3,
    fraudDecline: 60,
    fraudCondition: [40, 59],
    fraudConditionText: "Manual identity review by a loan officer before funding.",
    bankruptcy: "decline",
    incomePct: 0.35,
    cap: 35000,
    minAmount: 1000,
    bands: [
      { min: 740, apr: 7.9 },
      { min: 700, apr: 9.9 },
      { min: 660, apr: 12.9 },
    ],
    term: (a) => (a <= 10000 ? 36 : a <= 20000 ? 48 : 60),
    always: [
      "Open a Pacific Ridge share account (membership required before funding).",
      "Provide two most recent pay stubs or equivalent proof of the stated income.",
    ],
  },
  fintech: {
    minScore: 600,
    requireFico: false,
    maxUtil: 0.8,
    maxInq: 6,
    fraudDecline: 70,
    fraudCondition: [40, 69],
    fraudConditionText: "Complete step-up identity verification (government ID plus selfie).",
    bankruptcy: { minScore: 640, condition: "Provide the bankruptcy discharge letter." },
    incomePct: 0.5,
    cap: 25000,
    minAmount: 1000,
    bands: [
      { min: 720, apr: 10.9 },
      { min: 680, apr: 15.9 },
      { min: 640, apr: 21.9 },
      { min: 600, apr: 29.9 },
    ],
    term: (a) => (a <= 5000 ? 24 : a <= 15000 ? 36 : 48),
    always: ["E-sign the loan agreement; funds arrive in 1-2 business days."],
  },
  prime: {
    minScore: 720,
    requireFico: true,
    maxUtil: 0.3,
    maxInq: 2,
    fraudDecline: 50,
    fraudCondition: [30, 49],
    fraudConditionText: "Enhanced identity verification by the fraud team before funding.",
    bankruptcy: "decline",
    incomePct: 0.4,
    cap: 100000,
    minAmount: 2500,
    bands: [
      { min: 780, apr: 6.49 },
      { min: 740, apr: 7.49 },
      { min: 720, apr: 8.49 },
    ],
    term: (a) => (a <= 15000 ? 36 : a <= 40000 ? 60 : 84),
    always: [
      "Verify income with a W-2 or two years of tax returns.",
      "Enroll in autopay from a Meridian checking account to keep the quoted APR (otherwise +0.50%).",
    ],
  },
};

/** The APR the policy table advertises for this score (null = no band). Used by classify.ts. */
export function advertisedApr(lender: Lender, score: number | null, thinFile = false): number | null {
  if (thinFile) return lender === "fintech" ? 24.9 : null;
  if (score == null) return null;
  const band = P[lender].bands.find((b) => score >= b.min);
  return band ? band.apr : null;
}

export function stubUnderwrite(lender: Lender, input: UnderwriterInput): UnderwriterOutput {
  const p = P[lender];
  const { bundle, statedIncome, amountRequested } = input;
  const reasons: Reason[] = [];
  const conditions: string[] = [...p.always];

  // ---- score -------------------------------------------------------------
  const fico = bundle.credit.fico9;
  const vantage = bundle.credit.vantage4;
  let thinFile = false;
  let score: number | null = fico;
  let scoreField = "credit.fico9";
  if (fico == null) {
    if (p.requireFico) {
      reasons.push({ text: "No TransUnion score score is on file; this policy does not underwrite thin files.", field: "credit.fico9" });
      if (bundle.credit.tradelines.length <= 2) {
        reasons.push({
          text: `Only ${bundle.credit.tradelines.length} tradeline(s) on file; the credit history is too thin to evaluate.`,
          field: "credit.tradelines",
        });
      }
    } else if (vantage != null && bundle.credit.tradelines.length <= 2) {
      thinFile = true;
      score = vantage;
      scoreField = "credit.vantage4";
      if (vantage < 620) {
        reasons.push({ text: `VantageScore 4 of ${vantage} is below the 620 thin-file minimum.`, field: "credit.vantage4" });
      }
    } else if (vantage != null) {
      score = vantage;
      scoreField = "credit.vantage4";
    } else {
      reasons.push({ text: "Neither a TransUnion score nor a VantageScore 4 is on file.", field: "credit.fico9" });
      reasons.push({ text: "No score means the file cannot be priced.", field: "credit.vantage4" });
    }
  }
  if (score != null && !thinFile && score < p.minScore) {
    reasons.push({ text: `Score ${score} is below the ${p.minScore} minimum.`, field: scoreField });
  }

  // ---- utilization / inquiries ------------------------------------------
  const util = bundle.credit.utilization;
  if (util == null || util > p.maxUtil) {
    reasons.push({
      text: `Revolving utilization of ${pct(util)} exceeds the ${pct(p.maxUtil)} limit.`,
      field: "credit.utilization",
    });
  }
  if (bundle.credit.inquiries6mo > p.maxInq) {
    reasons.push({
      text: `${bundle.credit.inquiries6mo} hard inquiries in six months exceeds the limit of ${p.maxInq}.`,
      field: "credit.inquiries6mo",
    });
  }

  // ---- public records ----------------------------------------------------
  if (bundle.flags.bankruptcy) {
    if (p.bankruptcy === "decline") {
      reasons.push({ text: "A bankruptcy is on file; this policy declines any bankruptcy.", field: "flags.bankruptcy" });
    } else if (score == null || score < p.bankruptcy.minScore) {
      reasons.push({
        text: `A bankruptcy is on file and the score ${score ?? "n/a"} is below the ${p.bankruptcy.minScore} post-bankruptcy floor.`,
        field: "flags.bankruptcy",
      });
    } else {
      conditions.push(p.bankruptcy.condition);
    }
  }
  if (bundle.flags.eviction) {
    reasons.push({ text: "An eviction judgment is in the public records.", field: "flags.eviction" });
  }

  // ---- fraud -------------------------------------------------------------
  const fs = bundle.fraud.score;
  if (fs != null && fs >= p.fraudDecline) {
    reasons.push({ text: `Fraud score ${fs} is at or above this policy's ${p.fraudDecline} cutoff.`, field: "fraud.score" });
  } else if (fs != null && p.fraudCondition && fs >= p.fraudCondition[0] && fs <= p.fraudCondition[1]) {
    conditions.push(p.fraudConditionText);
  }

  // ---- capacity ----------------------------------------------------------
  let max = Math.min(statedIncome * p.incomePct, p.cap);
  if (thinFile) max = Math.min(max, 5000);
  let amount = amountRequested;
  if (amountRequested > max * 1.25) {
    reasons.push({
      text: `${usd(amountRequested)} requested exceeds the ${usd(max)} maximum for a stated income of ${usd(statedIncome)}.`,
      field: "statedIncome",
    });
    reasons.push({
      text: `The request is more than 25% above the policy maximum, so no counter-offer is available.`,
      field: "amountRequested",
    });
  } else if (amountRequested > max) {
    amount = Math.floor(max / 100) * 100;
    conditions.push(`Approved at the policy maximum of ${usd(amount)} instead of the ${usd(amountRequested)} requested.`);
  }
  if (amountRequested < p.minAmount) {
    reasons.push({ text: `${usd(amountRequested)} is below the ${usd(p.minAmount)} minimum loan.`, field: "amountRequested" });
  }

  // ---- decision ----------------------------------------------------------
  if (reasons.length > 0) {
    if (reasons.length === 1) {
      reasons.push({
        text:
          score == null
            ? "No score is available to offset the finding above."
            : `Score ${score} sits in the ${score >= 740 ? "excellent" : score >= 670 ? "good" : score >= 580 ? "fair" : "poor"} band, which does not offset the finding above under this policy.`,
        field: scoreField,
      });
    }
    return { decision: "decline", apr: null, termMonths: null, amount: null, conditions: [], reasons };
  }

  let apr: number;
  if (thinFile) {
    apr = 24.9;
    conditions.push("Verify income by linking a bank account before funding.");
  } else {
    const band = p.bands.find((b) => (score as number) >= b.min);
    apr = band ? band.apr : p.bands[p.bands.length - 1].apr;
  }
  const supporting: Reason[] = [
    { text: `Score ${score} meets the ${thinFile ? "620 thin-file" : p.minScore} minimum.`, field: scoreField },
    { text: `Utilization ${pct(util)} and ${bundle.credit.inquiries6mo} inquiries are within policy.`, field: "credit.utilization" },
  ];
  return { decision: "approve", apr, termMonths: p.term(amount), amount, conditions, reasons: supporting };
}

export function stubCompliance(input: ComplianceInput): { text: string } {
  const { applicant, declines } = input;
  const lines: string[] = [];
  lines.push(
    `Dear ${applicant.name}, thank you for applying for a ${usd(applicant.amountRequested)} loan for ${applicant.purpose}. This notice explains which lenders declined your request or offered different terms, and exactly why.`,
  );
  for (const d of declines) {
    const name = LENDER_NAMES[d.lender];
    const why = d.reasons.map((r) => r.text.replace(/\.$/, "")).join("; ");
    if (d.classification === "counteroffer" && d.offered) {
      lines.push(
        `${name} did not approve the terms you requested but offered ${usd(d.offered.amount)} at ${d.offered.apr}% APR for ${d.offered.termMonths} months instead${why ? `, because: ${why}` : ""}.`,
      );
    } else {
      lines.push(`${name} declined because: ${why}.`);
    }
  }
  lines.push("Fixing the items named above, or applying for a smaller amount, would change the outcome at one or more of these lenders.");
  return { text: lines.join("\n\n") };
}
