// ECOA classification of a lender response, computed in code (never by the LLM).
//   approve      = terms at or better than requested
//   counteroffer = approved, but a lower amount, or an APR above the policy's
//                  advertised rate for this score (a different term would also
//                  count, but intake does not capture a requested term)
//   deny         = declined (or no decision)
// Notice required for deny and for counteroffer.
import type { Classification } from "./types";

export function classifyOffer(
  offer: { decision: "approve" | "decline" | null; amount: number | null; apr: number | null },
  requested: { amountRequested: number },
  advertisedApr: number | null,
): { classification: Classification; why: string } {
  if (offer.decision !== "approve") return { classification: "deny", why: "declined" };
  const reasons: string[] = [];
  if (offer.amount != null && offer.amount < requested.amountRequested) {
    reasons.push(`amount $${offer.amount} is below the $${requested.amountRequested} requested`);
  }
  if (advertisedApr != null && offer.apr != null && offer.apr > advertisedApr + 0.005) {
    reasons.push(`APR ${offer.apr}% is above the policy's advertised ${advertisedApr}% for this score`);
  }
  if (reasons.length) return { classification: "counteroffer", why: reasons.join("; ") };
  return { classification: "approve", why: "terms at or better than requested" };
}

export function noticeRequired(classifications: Array<Classification | undefined>): { required: boolean; because: string } {
  const deny = classifications.filter((c) => c === "deny").length;
  const counter = classifications.filter((c) => c === "counteroffer").length;
  if (deny === 0 && counter === 0) return { required: false, because: "every lender approved the requested terms" };
  const parts: string[] = [];
  if (deny) parts.push(`${deny} denial${deny > 1 ? "s" : ""}`);
  if (counter) parts.push(`${counter} counteroffer${counter > 1 ? "s" : ""} (adverse action unless accepted)`);
  return { required: true, because: parts.join(" and ") };
}

/** FCRA notice paragraph, appended in code so the LLM cannot drop or reword it. */
export function fcraParagraph(source: "crs" | "nessie" | "mock", pulledAt: number): string {
  const name =
    source === "crs"
      ? "CRS Credit API sandbox"
      : source === "mock"
        ? "CRS Credit API sandbox (mock persona data standing in for the live pull)"
        : "Capital One Nessie sandbox";
  const date = new Date(pulledAt).toISOString().slice(0, 10);
  return (
    `Information from a consumer report obtained from ${name}, pulled ${date}, was used in these decisions. ` +
    `The consumer reporting agency did not make the decision and cannot explain why it was made. ` +
    `You have the right to a free copy of your report from that agency within 60 days of this notice and to dispute the accuracy or completeness of any information in it.`
  );
}

/** Fixed-rate amortized monthly payment, rounded to cents. */
export function monthlyPayment(amount: number, aprPct: number, months: number): number {
  const r = aprPct / 100 / 12;
  const pay = r === 0 ? amount / months : (amount * r) / (1 - Math.pow(1 + r, -months));
  return Math.round(pay * 100) / 100;
}

/** Total repaid minus amount borrowed (no fees in any current policy). */
export function costToBorrow(amount: number, aprPct: number, months: number): number {
  return Math.round((monthlyPayment(amount, aprPct, months) * months - amount) * 100) / 100;
}
