// Table shapes mirror design/contracts.md exactly. Do not change field names
// here without changing the contract (which needs both teammates).
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const applicantStatus = v.union(
  v.literal("intake"),
  v.literal("pulling"),
  v.literal("guardrails"),
  v.literal("underwriting"),
  v.literal("compliance"),
  v.literal("awaiting_human"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("hard_stop"),
);

export const lender = v.union(v.literal("cu"), v.literal("fintech"), v.literal("prime"), v.literal("regional"), v.literal("subprime"));
export const provider = v.union(v.literal("claude"), v.literal("creao"));
export const tier = v.union(
  v.literal("excellent"),
  v.literal("good"),
  v.literal("fair"),
  v.literal("poor"),
);

// `verified` is set by verify.ts: true = counterfactual flipped the decision,
// false = did not flip (unsupported, kept visible but dropped from the notice),
// null/absent = not tested (no passing-value mapping for the field).
export const reason = v.object({
  text: v.string(),
  field: v.string(),
  verified: v.optional(v.union(v.boolean(), v.null())),
});
export const classification = v.union(v.literal("approve"), v.literal("counteroffer"), v.literal("deny"));
export const marketAnchor = v.object({ tier, aprLow: v.number(), aprHigh: v.number() });

export const tradeline = v.object({
  type: v.string(),
  balance: v.number(),
  status: v.string(),
  openedAt: v.string(),
});

export const credit = v.object({
  fico9: v.union(v.number(), v.null()),
  vantage4: v.union(v.number(), v.null()),
  tradelines: v.array(tradeline),
  inquiries6mo: v.number(),
  utilization: v.union(v.number(), v.null()),
});
export const identity = v.object({ verified: v.boolean(), flags: v.array(v.string()) });
export const fraud = v.object({ score: v.union(v.number(), v.null()), signals: v.array(v.string()) });
export const flags = v.object({
  deceased: v.boolean(),
  frozen: v.boolean(),
  bankruptcy: v.boolean(),
  eviction: v.boolean(),
  // Unsatisfied lien or non-eviction judgment in BLJ public records. Optional: bundles stored before 2026-10-24 lack it (read as false).
  lienOrJudgment: v.optional(v.boolean()),
});

export const actor = v.union(
  v.literal("intake"),
  v.literal("desk"),
  v.literal("crs"),
  v.literal("rules"),
  v.literal("underwriter:cu"),
  v.literal("underwriter:fintech"),
  v.literal("underwriter:prime"),
  v.literal("underwriter:regional"),
  v.literal("underwriter:subprime"),
  v.literal("compliance"),
  v.literal("human"),
  v.literal("applicant"), // dispute events (design/differentiators.md #3)
);

export const expectedOutcome = v.union(
  v.literal("approve"),
  v.literal("decline"),
  v.literal("hard_stop"),
);

export const perLenderOutcome = v.union(v.literal("approve"), v.literal("counteroffer"), v.literal("decline"), v.literal("none"));

export default defineSchema({
  applicants: defineTable({
    personaId: v.string(),
    name: v.string(),
    purpose: v.string(),
    amountRequested: v.number(),
    statedIncome: v.number(),
    consentAt: v.number(),
    status: applicantStatus,
    createdAt: v.number(),
    // Dispute-and-replay: this row re-runs the desk for `replayOf` with a corrected bundle.
    replayOf: v.optional(v.id("applicants")),
    replayNote: v.optional(v.string()),
    // Demo Day Kit additions (all optional).
    cardCode: v.optional(v.string()),
    chosenOfferId: v.optional(v.id("offers")),
    overrideAttempts: v.optional(v.number()),
    overrideResult: v.optional(v.string()),
  })
    .index("by_personaId", ["personaId"])
    .index("by_replayOf", ["replayOf"])
    .index("by_createdAt", ["createdAt"]),

  bundles: defineTable({
    applicantId: v.id("applicants"),
    source: v.union(v.literal("crs"), v.literal("nessie"), v.literal("mock")),
    pulledAt: v.number(),
    credit,
    identity,
    fraud,
    flags,
    raw: v.any(),
  }).index("by_applicantId", ["applicantId"]),

  offers: defineTable({
    applicantId: v.id("applicants"),
    lender,
    provider,
    status: v.union(v.literal("pending"), v.literal("done"), v.literal("failed")),
    decision: v.union(v.literal("approve"), v.literal("decline"), v.null()),
    apr: v.union(v.number(), v.null()),
    termMonths: v.union(v.number(), v.null()),
    amount: v.union(v.number(), v.null()),
    conditions: v.array(v.string()),
    reasons: v.array(reason),
    marketAnchor: v.union(marketAnchor, v.null()),
    // Computed in code (classify.ts) from requested vs offered terms. ECOA: deny and
    // counteroffer both require an adverse-action notice.
    classification: v.optional(classification),
    // Set when status is "failed": "timeout" (LENDER_TIMEOUT_MS exceeded) or "error".
    failureReason: v.optional(v.string()),
    // Computed when an approving offer is written (classify.ts).
    monthlyPayment: v.optional(v.number()),
    costToBorrow: v.optional(v.number()),
    runId: v.union(v.string(), v.null()),
    shareUrl: v.union(v.string(), v.null()),
    latencyMs: v.union(v.number(), v.null()),
    createdAt: v.number(),
  })
    .index("by_applicantId", ["applicantId"])
    .index("by_runId", ["runId"]),

  notices: defineTable({
    applicantId: v.id("applicants"),
    text: v.string(),
    lendersDeclined: v.array(v.string()), // deny + counteroffer lenders (both require notice)
    createdAt: v.number(),
    lendersCounteroffered: v.optional(v.array(v.string())),
    required: v.optional(v.boolean()),
    requiredBecause: v.optional(v.string()),
    droppedReasons: v.optional(v.array(v.object({ lender: v.string(), field: v.string(), text: v.string() }))),
    fcraSource: v.optional(v.string()),
    approvedAt: v.optional(v.number()), // human approved sending this notice (desk:approveNotice)
  }).index("by_applicantId", ["applicantId"]),

  // Counterfactual reason tests (design/differentiators.md #1, pre-approved).
  reasonChecks: defineTable({
    offerId: v.id("offers"),
    applicantId: v.id("applicants"),
    lender,
    field: v.string(),
    original: v.any(),
    counterfactual: v.any(),
    flipped: v.boolean(), // did the decision change in THIS test
    counterfactualDecision: v.union(v.literal("approve"), v.literal("decline"), v.literal("failed")),
    latencyMs: v.number(),
    createdAt: v.number(),
    // single: only this field set to passing (verified = flipped).
    // leave_one_out: every OTHER reason's field set to passing, this one kept (verified = still declined).
    // all_fixed: sanity test with every field passing; must approve for leave_one_out to count.
    method: v.optional(v.union(v.literal("single"), v.literal("leave_one_out"), v.literal("all_fixed"))),
    verified: v.optional(v.union(v.boolean(), v.null())),
  })
    .index("by_offerId", ["offerId"])
    .index("by_applicantId", ["applicantId"]),

  decisions: defineTable({
    applicantId: v.id("applicants"),
    chosenOfferId: v.union(v.string(), v.null()),
    outcome: v.union(v.literal("approved"), v.literal("declined"), v.literal("hard_stop")),
    approvedBy: v.literal("human"),
    at: v.number(),
    note: v.string(),
  }).index("by_applicantId", ["applicantId"]),

  auditEvents: defineTable({
    applicantId: v.id("applicants"),
    at: v.number(),
    actor,
    action: v.string(),
    ref: v.union(v.string(), v.null()),
    note: v.string(),
  }).index("by_applicantId", ["applicantId"]),

  // Replay recordings (desk:recordedRun). Survive desk:resetBoard. `data` is the recordedRun payload.
  recordings: defineTable({
    personaId: v.string(),
    recordedAt: v.number(),
    data: v.any(),
  }).index("by_personaId", ["personaId"]),

  evalCases: defineTable({
    personaId: v.string(),
    expected: expectedOutcome,
    expectedReasonsIncludes: v.array(v.string()),
    // Per-lender answer key (none = hard stop, no lender ran). Optional for older rows.
    expectedPerLender: v.optional(
      v.object({ cu: perLenderOutcome, fintech: perLenderOutcome, prime: perLenderOutcome, regional: v.optional(perLenderOutcome), subprime: v.optional(perLenderOutcome) }),
    ),
    note: v.string(),
  }).index("by_personaId", ["personaId"]),

  evalRuns: defineTable({
    startedAt: v.number(),
    finishedAt: v.union(v.number(), v.null()),
    cases: v.number(),
    agreement: v.number(),
    fraudZeroOffers: v.boolean(),
    avgReasonsPerDenial: v.number(),
    failures: v.array(
      v.object({
        personaId: v.string(),
        expected: v.string(),
        got: v.string(),
        why: v.string(),
      }),
    ),
    reasonsVerifiedPct: v.optional(v.number()),
    // Per-lender agreement (fraction of the cases x lender slots named in expectedPerLender); optional for older runs.
    perLenderAgreement: v.optional(v.union(v.number(), v.null())),
    perLenderMatched: v.optional(v.number()),
    perLenderTotal: v.optional(v.number()),
    perLenderMismatches: v.optional(v.array(v.object({ personaId: v.string(), lender: v.string(), expected: v.string(), got: v.string() }))),
    latencyP50Ms: v.optional(v.record(v.string(), v.union(v.number(), v.null()))), // one entry per lender id
  }).index("by_startedAt", ["startedAt"]),

  marketRates: defineTable({
    tier,
    aprLow: v.number(),
    aprHigh: v.number(),
    source: v.string(),
    fetchedAt: v.number(),
  }).index("by_tier", ["tier"]),

  // Not in contracts.md (internal plumbing, never shown in the UI).
  // agentRuns: one row per asynchronous agent run (CREAO) so the unsigned
  // webhook can be routed by runId to the offer or notice it completes.
  agentRuns: defineTable({
    applicantId: v.id("applicants"),
    role: v.union(v.literal("underwriter"), v.literal("compliance")),
    lender: v.union(lender, v.null()),
    offerId: v.union(v.id("offers"), v.null()),
    provider,
    runId: v.string(),
    status: v.union(v.literal("pending"), v.literal("done"), v.literal("failed")),
    attempts: v.number(),
    input: v.any(),
    startedAt: v.number(),
    finishedAt: v.union(v.number(), v.null()),
    error: v.union(v.string(), v.null()),
  })
    .index("by_runId", ["runId"])
    .index("by_applicantId", ["applicantId"]),

  // secretsCache: caches the CRS sandbox bearer token so we log in exactly once.
  secretsCache: defineTable({
    key: v.string(),
    value: v.string(),
    expiresAt: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
});
