import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, observedOutcome, scoreCase } from "./evalScore.ts";

const decl = (fields: string[]) => ({ status: "done", decision: "decline" as const, reasons: fields.map((field) => ({ field })) });
const appr = () => ({ status: "done", decision: "approve" as const, reasons: [] });

test("hard stop with zero offers passes", () => {
  const r = scoreCase("P09", "hard_stop", ["flags.deceased"], { status: "hard_stop", offers: [], hardStopRefs: ["flags.deceased"] });
  assert.equal(r.pass, true);
});

test("hard stop with an offer row fails", () => {
  const r = scoreCase("P09", "hard_stop", [], { status: "hard_stop", offers: [appr()], hardStopRefs: ["flags.deceased"] });
  assert.equal(r.pass, false);
  assert.match(r.why, /offer row/);
});

test("approve when any lender approves", () => {
  assert.equal(observedOutcome({ status: "awaiting_human", offers: [decl(["a", "b"]), appr(), decl(["a", "b"])], hardStopRefs: [] }), "approve");
});

test("decline requires expected reason fields and two reasons each", () => {
  const ok = scoreCase("P12", "decline", ["credit.utilization"], {
    status: "awaiting_human",
    offers: [decl(["credit.utilization", "credit.fico9"]), decl(["credit.utilization", "x"]), decl(["credit.utilization", "y"])],
    hardStopRefs: [],
  });
  assert.equal(ok.pass, true);
  const missing = scoreCase("P12", "decline", ["credit.utilization"], {
    status: "awaiting_human",
    offers: [decl(["a", "b"]), decl(["c", "d"]), decl(["e", "f"])],
    hardStopRefs: [],
  });
  assert.match(missing.why, /missing reason fields/);
  const one = scoreCase("P12", "decline", [], { status: "awaiting_human", offers: [decl(["a"])], hardStopRefs: [] });
  assert.match(one.why, /fewer than two/);
});

test("aggregate", () => {
  const agg = aggregate([
    scoreCase("A", "approve", [], { status: "awaiting_human", offers: [appr()], hardStopRefs: [] }),
    scoreCase("B", "decline", [], { status: "awaiting_human", offers: [decl(["a", "b", "c"]), decl(["a", "b"])], hardStopRefs: [] }),
    scoreCase("C", "hard_stop", [], { status: "hard_stop", offers: [], hardStopRefs: ["fraud.score"] }),
    scoreCase("D", "approve", [], { status: "awaiting_human", offers: [decl(["a", "b"])], hardStopRefs: [] }),
  ]);
  assert.equal(agg.cases, 4);
  assert.equal(agg.agreement, 0.75);
  assert.equal(agg.fraudZeroOffers, true);
  assert.equal(agg.avgReasonsPerDenial, (3 + 2 + 2) / 3);
  assert.equal(agg.failures.length, 1);
  assert.equal(agg.failures[0].personaId, "D");
});

test("per-lender key: counts matches per lender slot, hard stop is none", () => {
  const offer = (lender: string, decision: "approve" | "decline", classification?: "approve" | "counteroffer" | "deny") => ({
    status: "done",
    lender,
    decision,
    classification,
    reasons: decision === "decline" ? [{ field: "a" }, { field: "b" }] : [],
  });
  const r = scoreCase(
    "P02",
    "approve",
    [],
    { status: "awaiting_human", offers: [offer("cu", "approve", "approve"), offer("fintech", "approve", "counteroffer"), offer("prime", "decline", "deny")], hardStopRefs: [] },
    { cu: "approve", fintech: "counteroffer", prime: "approve" },
  );
  assert.deepEqual(r.perLender?.map((s) => s.match), [true, true, false]);
  const hs = scoreCase("P12", "hard_stop", [], { status: "hard_stop", offers: [], hardStopRefs: ["identity.verified"] }, { cu: "none", fintech: "none", prime: "none" });
  assert.equal(hs.perLender?.every((s) => s.match), true);
  const agg = aggregate([r, hs]);
  assert.equal(agg.perLenderTotal, 6);
  assert.equal(agg.perLenderMatched, 5);
  assert.equal(agg.perLenderMismatches[0].lender, "prime");
});
