// Run: npm test   (node --test, Node 22+ strips types natively)
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateHardStops, FRAUD_HARD_STOP_THRESHOLD } from "./rules.ts";
import { PERSONAS } from "./crs.mock.ts";
import type { BundleData } from "./types.ts";

const base = (): BundleData => ({
  credit: { fico9: 720, vantage4: 715, tradelines: [], inquiries6mo: 1, utilization: 0.2 },
  identity: { verified: true, flags: [] },
  fraud: { score: 10, signals: [] },
  flags: { deceased: false, frozen: false, bankruptcy: false, eviction: false },
});

test("clean bundle passes", () => {
  assert.deepEqual(evaluateHardStops(base()), { stop: false });
});

test("deceased stops with flags.deceased", () => {
  const b = base();
  b.flags.deceased = true;
  const r = evaluateHardStops(b);
  assert.equal(r.stop, true);
  if (r.stop) assert.equal(r.field, "flags.deceased");
});

test("frozen stops only when no bureau returned a score", () => {
  const b = base();
  b.flags.frozen = true;
  b.credit.fico9 = null;
  b.credit.vantage4 = null;
  const r = evaluateHardStops(b);
  assert.equal(r.stop && r.field, "flags.frozen");
});

test("frozen at one bureau with a score elsewhere does not stop", () => {
  const b = base();
  b.flags.frozen = true;
  b.credit.fico9 = null;
  b.credit.vantage4 = 740;
  assert.equal(evaluateHardStops(b).stop, false);
});

test("identity not verified stops with identity.verified", () => {
  const b = base();
  b.identity.verified = false;
  const r = evaluateHardStops(b);
  assert.equal(r.stop && r.field, "identity.verified");
});

test("fraud score at threshold stops; one below does not; null does not", () => {
  const at = base();
  at.fraud.score = FRAUD_HARD_STOP_THRESHOLD;
  assert.equal(evaluateHardStops(at).stop, true);

  const below = base();
  below.fraud.score = FRAUD_HARD_STOP_THRESHOLD - 1;
  assert.equal(evaluateHardStops(below).stop, false);

  const nul = base();
  nul.fraud.score = null;
  assert.equal(evaluateHardStops(nul).stop, false);
});

test("bankruptcy and eviction are NOT hard stops (underwriters decide)", () => {
  const b = base();
  b.flags.bankruptcy = true;
  b.flags.eviction = true;
  assert.equal(evaluateHardStops(b).stop, false);
});

test("multiple rules all recorded, first wins as field", () => {
  const b = base();
  b.flags.deceased = true;
  b.fraud.score = 99;
  const r = evaluateHardStops(b);
  assert.equal(r.stop, true);
  if (r.stop) {
    assert.equal(r.field, "flags.deceased");
    assert.deepEqual(r.all.map((x) => x.field), ["flags.deceased", "fraud.score"]);
  }
});

test("mock personas: exactly the hard-stop personas stop", () => {
  const stopped = PERSONAS.filter((p) => evaluateHardStops(p.bundle).stop).map((p) => p.personaId);
  assert.deepEqual(stopped, ["P08", "P09", "P10", "P11", "P18", "P19"]);
});

test("flags.lienOrJudgment is true only for P08's fixture (unsatisfied lien + judgment); eviction judgments do not count", async () => {
  const { mockBundle } = await import("./crs.mock.ts");
  const { lienOrJudgmentFromPublicRecords } = await import("./crs.core.ts");
  for (let i = 1; i <= 20; i++) {
    const id = `P${String(i).padStart(2, "0")}`;
    const b = mockBundle(id) as unknown as BundleData;
    assert.equal(b.flags.lienOrJudgment, id === "P08", `${id} lienOrJudgment`);
  }
  assert.equal(lienOrJudgmentFromPublicRecords(undefined), false);
  assert.equal(lienOrJudgmentFromPublicRecords({ lienDetail: [{ status: "Released" }], judgmentDetail: [{ status: "Satisfied", type: "Civil Judgment" }] }), false);
  assert.equal(lienOrJudgmentFromPublicRecords({ lienDetail: [], judgmentDetail: [{ status: "Unsatisfied", type: "Civil Judgment - Unlawful Detainer" }] }), false);
  assert.equal(lienOrJudgmentFromPublicRecords({ lienDetail: [{ status: "Unreleased" }], judgmentDetail: [] }), true);
});
