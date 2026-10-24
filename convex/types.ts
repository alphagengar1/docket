// Plain TypeScript + Zod mirrors of the shapes in design/contracts.md.
// schema.ts is the source of truth for the database; these are for pure
// functions (rules.ts, agents.ts, crs normalizers, tests) that must not import
// Convex server code.
import { z } from "zod";

export type Tier = "excellent" | "good" | "fair" | "poor";
export type Lender = "cu" | "fintech" | "prime";
export type Provider = "claude" | "creao";
export const LENDERS: Lender[] = ["cu", "fintech", "prime"];

export type Tradeline = { type: string; balance: number; status: string; openedAt: string };

export type BundleData = {
  credit: {
    fico9: number | null;
    vantage4: number | null;
    tradelines: Tradeline[];
    inquiries6mo: number;
    utilization: number | null;
  };
  identity: { verified: boolean; flags: string[] };
  fraud: { score: number | null; signals: string[] };
  flags: { deceased: boolean; frozen: boolean; bankruptcy: boolean; eviction: boolean };
};

export type Reason = { text: string; field: string; verified?: boolean | null };
export type Classification = "approve" | "counteroffer" | "deny";
export type MarketAnchor = { tier: Tier; aprLow: number; aprHigh: number };

// Underwriter agent output (contracts.md). Zod-validated on every provider.
export const ReasonSchema = z.object({
  text: z.string().min(1),
  field: z.string().min(1),
});

export const UnderwriterOutputSchema = z
  .object({
    decision: z.enum(["approve", "decline"]),
    apr: z.number().nullable(),
    termMonths: z.number().int().nullable(),
    amount: z.number().nullable(),
    conditions: z.array(z.string()),
    reasons: z.array(ReasonSchema),
  })
  .superRefine((o, ctx) => {
    if (o.decision === "decline" && o.reasons.length < 2) {
      ctx.addIssue({ code: "custom", message: "a decline needs at least two reasons" });
    }
    if (o.decision === "approve") {
      if (o.apr == null || o.termMonths == null || o.amount == null) {
        ctx.addIssue({ code: "custom", message: "an approval needs apr, termMonths and amount" });
      }
    }
  });
export type UnderwriterOutput = z.infer<typeof UnderwriterOutputSchema>;

export const ComplianceOutputSchema = z.object({ text: z.string().min(20) });
export type ComplianceOutput = z.infer<typeof ComplianceOutputSchema>;

export type UnderwriterInput = {
  bundle: BundleData;
  policy: string;
  statedIncome: number;
  amountRequested: number;
  purpose: string;
  marketAnchor?: MarketAnchor | null;
};

export type ComplianceInput = {
  applicant: { name: string; purpose: string; amountRequested: number; statedIncome: number };
  // "declines" = every lender response that needs a notice: deny or counteroffer.
  declines: Array<{
    lender: Lender;
    classification?: Classification;
    offered?: { amount: number; apr: number; termMonths: number } | null;
    reasons: Reason[];
  }>;
};

export function tierForScore(score: number | null): Tier {
  if (score == null) return "poor";
  if (score >= 740) return "excellent";
  if (score >= 670) return "good";
  if (score >= 580) return "fair";
  return "poor";
}
