// Deterministic hard stops. Pure function: no Convex imports, no I/O, so it can
// be unit-tested with node:test and reasoned about without a deployment.
//
// contracts.md: flags.deceased || flags.frozen || !identity.verified ||
//   (fraud.score != null && fraud.score >= 80)
//   → status "hard_stop", zero offers, auditEvent with the triggering field.
import type { BundleData } from "./types";

export const FRAUD_HARD_STOP_THRESHOLD = 80;

export type HardStop = {
  stop: true;
  /** Bundle field reference that triggered the stop, e.g. "flags.deceased". */
  field: string;
  /** Plain-English explanation shown to the loan officer. */
  reason: string;
  /** Every rule that fired, in rule order (the first is `field`). */
  all: Array<{ field: string; reason: string }>;
};
export type NoStop = { stop: false };
export type RulesResult = HardStop | NoStop;

export function evaluateHardStops(bundle: BundleData): RulesResult {
  const fired: Array<{ field: string; reason: string }> = [];

  if (bundle.flags.deceased) {
    fired.push({ field: "flags.deceased", reason: "The credit file carries a deceased indicator." });
  }
  if (bundle.flags.frozen) {
    fired.push({ field: "flags.frozen", reason: "The credit file is frozen; the applicant must lift the freeze before any lender can review it." });
  }
  if (!bundle.identity.verified) {
    fired.push({ field: "identity.verified", reason: "Identity could not be verified against the bureau record." });
  }
  if (bundle.fraud.score != null && bundle.fraud.score >= FRAUD_HARD_STOP_THRESHOLD) {
    fired.push({
      field: "fraud.score",
      reason: `Fraud score ${bundle.fraud.score} is at or above the ${FRAUD_HARD_STOP_THRESHOLD} hard-stop threshold.`,
    });
  }

  if (fired.length === 0) return { stop: false };
  return { stop: true, field: fired[0].field, reason: fired[0].reason, all: fired };
}
