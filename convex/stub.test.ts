// Regression test for the deterministic stub (convex/stub.ts), which mirrors every policies/*.md.
// 1. For every persona the stub's top-level outcome agrees with personas/map.json.
// 2. The regional and subprime per-lender key entries were derived from the stub and must keep matching it.
//    (cu, fintech and prime entries come from real Claude runs and may differ from the stub on edge cases.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stubUnderwrite } from "./stub.ts";
import { evaluateHardStops } from "./rules.ts";
import { PERSONAS, mockBundle } from "./crs.mock.ts";
import { POLICIES, LENDER_NAMES } from "./policies.ts";
import { LENDERS, type Lender } from "./types.ts";

type Outcome = "approve" | "counteroffer" | "decline" | "none";
type KeyCase = { personaId: string; expected: string; expectedPerLender: Record<string, Outcome> };
const map = JSON.parse(readFileSync(new URL("../personas/map.json", import.meta.url), "utf8")) as { cases: KeyCase[] };

function stubOutcome(lender: Lender, personaId: string): Outcome {
  const p = PERSONAS.find((x) => x.personaId === personaId);
  assert.ok(p, `persona ${personaId} exists`);
  const bundle = mockBundle(personaId);
  if (evaluateHardStops(bundle).stop) return "none";
  const r = stubUnderwrite(lender, { bundle, policy: POLICIES[lender], ...p.defaultIntake });
  if (r.decision === "decline") {
    assert.ok(r.reasons.length >= 2, `${personaId}/${lender}: a decline carries ${r.reasons.length} reason(s)`);
    return "decline";
  }
  return (r.amount ?? 0) < p.defaultIntake.amountRequested ? "counteroffer" : "approve";
}

test("stub: every persona's top-level outcome across all lenders matches the answer key", () => {
  assert.equal(map.cases.length, 20);
  for (const c of map.cases) {
    const per = LENDERS.map((l) => stubOutcome(l, c.personaId));
    const top = per.every((o) => o === "none") ? "hard_stop" : per.some((o) => o === "approve" || o === "counteroffer") ? "approve" : "decline";
    assert.equal(top, c.expected, `${c.personaId}: stub says ${top} (${per.join(", ")}), key says ${c.expected}`);
  }
});

test("stub: regional and subprime per-lender key entries match the stub", () => {
  for (const c of map.cases) {
    for (const l of ["regional", "subprime"] as const) {
      assert.equal(stubOutcome(l, c.personaId), c.expectedPerLender[l], `${c.personaId}/${l}`);
    }
  }
});

test("every lender has a policy text that names it and an entry in the key", () => {
  for (const l of LENDERS) {
    assert.ok(POLICIES[l].includes(LENDER_NAMES[l]), `${l} policy names ${LENDER_NAMES[l]}`);
    assert.ok(map.cases.every((c) => c.expectedPerLender[l] != null), `${l} is in every expectedPerLender`);
  }
});
