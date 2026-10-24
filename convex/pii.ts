// PII boundary for the agents. Pure functions (no Convex imports) so node:test can
// exercise them. Everything an LLM or CREAO agent receives is built here by
// allowlist projection: the applicant's name, address, ZIP, SSN, DOB, phone, email
// and the raw bureau blobs have no path into the agent input.
import { describeIdentityFlag } from "./labels.ts";
import type { BundleData, ComplianceInput, MarketAnchor, UnderwriterInput } from "./types";

/** Placeholder the compliance agent writes for the applicant's name; code swaps in the real name. */
export const NAME_TOKEN = "{{APPLICANT_NAME}}";

const SSN_DASHED = /\b\d{3}-\d{2}-\d{4}\b/g;
const DIGITS9 = /\b\d{9}\b/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g;
const ZIP = /\b\d{5}(?:-\d{4})\b/g; // ZIP+4 only; bare 5-digit numbers are indistinguishable from amounts

/** Redact PII-shaped substrings from a free-text string. */
export function scrubText(s: string): string {
  return s
    .replace(SSN_DASHED, "[redacted]")
    .replace(DIGITS9, "[redacted]")
    .replace(EMAIL, "[redacted]")
    .replace(PHONE, "[redacted]")
    .replace(ZIP, "[redacted]");
}

/** Allowlist projection of a bundle: only the fields the policies reference. Drops raw and any extra key. */
export function agentBundle(b: BundleData): BundleData {
  return {
    credit: {
      fico9: b.credit.fico9,
      vantage4: b.credit.vantage4,
      tradelines: b.credit.tradelines.map((t) => ({
        type: scrubText(t.type),
        balance: t.balance,
        status: scrubText(t.status),
        openedAt: scrubText(t.openedAt),
      })),
      inquiries6mo: b.credit.inquiries6mo,
      utilization: b.credit.utilization,
    },
    identity: { verified: b.identity.verified, flags: b.identity.flags.map((f) => scrubText(describeIdentityFlag(f))) },
    fraud: { score: b.fraud.score, signals: b.fraud.signals.map(scrubText) },
    flags: {
      deceased: b.flags.deceased,
      frozen: b.flags.frozen,
      bankruptcy: b.flags.bankruptcy,
      eviction: b.flags.eviction,
      lienOrJudgment: b.flags.lienOrJudgment ?? false,
    },
  };
}

export function buildUnderwriterInput(
  applicant: { purpose: string; amountRequested: number; statedIncome: number },
  bundle: BundleData,
  policy: string,
  marketAnchor: MarketAnchor | null,
): UnderwriterInput {
  return {
    bundle: agentBundle(bundle),
    policy,
    statedIncome: applicant.statedIncome,
    amountRequested: applicant.amountRequested,
    purpose: scrubText(applicant.purpose),
    marketAnchor,
  };
}

export function buildComplianceInput(
  applicant: { purpose: string; amountRequested: number; statedIncome: number },
  declines: ComplianceInput["declines"],
): ComplianceInput {
  return {
    applicant: {
      name: NAME_TOKEN,
      purpose: scrubText(applicant.purpose),
      amountRequested: applicant.amountRequested,
      statedIncome: applicant.statedIncome,
    },
    declines: declines.map((d) => ({
      ...d,
      reasons: d.reasons.map((r) => ({ ...r, text: scrubText(r.text) })),
    })),
  };
}

/** Swap the placeholder for the real name after the agent has written the notice. */
export function fillName(text: string, name: string): string {
  return text.split(NAME_TOKEN).join(name);
}

/** Mask an SSN-like value to its last four digits. */
export function maskSsn(s: string): string {
  const d = s.replace(/\D/g, "");
  return d.length >= 4 ? `***-**-${d.slice(-4)}` : "***";
}
