// Plain-language labels shared by the backend (notice text, prompts) and the web board.
// Pure module: no Convex imports, so web/ can import it directly.

/** Short labels for bundle fields (board chips, tables). Keys without the "credit." prefix. */
export const FIELD_LABELS: Record<string, string> = {
  fico9: "score",
  vantage4: "score (V4)",
  utilization: "utilization",
  inquiries6mo: "inquiries",
  "fraud.score": "fraud",
  "identity.verified": "identity",
  "flags.deceased": "deceased indicator",
  "flags.frozen": "frozen file",
  "flags.bankruptcy": "bankruptcy",
  "flags.eviction": "eviction",
  policy: "policy",
  timeout: "timeout",
};

export function fieldLabel(field: string): string {
  const key = field.replace(/^credit\./, "");
  return FIELD_LABELS[key] ?? key;
}

/** Letter-style labels for hard-stop rule fields, used in the adverse-action notice. */
export const STOP_LABELS: Record<string, string> = {
  "flags.deceased": "Deceased indicator on the bureau file",
  "flags.frozen": "Every bureau file is frozen",
  "identity.verified": "Identity could not be verified",
  "fraud.score": "Fraud risk score above the threshold",
};

export const STOP_FALLBACK_LABEL = "The application stopped at an automated safety check";

export function stopLabel(field: string): string {
  return STOP_LABELS[field] ?? STOP_FALLBACK_LABEL;
}

/** Human descriptions of raw bureau identity codes. */
export const IDENTITY_CODE_TEXT: Record<string, string> = {
  "2201": "SSN not associated with the name",
  "2202": "date of birth mismatch",
  "2301": "SSN belongs to a deceased person",
  "2401": "identity verified but step-up authentication recommended (fraud alert on file)",
};

/** Translate raw identity flags to short descriptions. Non-code strings pass through unchanged. */
export function describeIdentityFlag(flag: string): string {
  const m = /^\s*(\d{4})\s*$/.exec(flag);
  if (!m) return flag;
  return IDENTITY_CODE_TEXT[m[1]] ?? `bureau identity code ${m[1]}`;
}
