import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyOffer, fcraParagraph, noticeRequired } from "./classify.ts";

test("approve at requested terms", () => {
  assert.equal(classifyOffer({ decision: "approve", amount: 20000, apr: 7.9 }, { amountRequested: 20000 }, 7.9).classification, "approve");
});
test("lower amount is a counteroffer", () => {
  const r = classifyOffer({ decision: "approve", amount: 15000, apr: 7.9 }, { amountRequested: 20000 }, 7.9);
  assert.equal(r.classification, "counteroffer");
  assert.match(r.why, /below/);
});
test("APR above advertised band is a counteroffer; unknown band is not", () => {
  assert.equal(classifyOffer({ decision: "approve", amount: 20000, apr: 9.9 }, { amountRequested: 20000 }, 7.9).classification, "counteroffer");
  assert.equal(classifyOffer({ decision: "approve", amount: 20000, apr: 9.9 }, { amountRequested: 20000 }, null).classification, "approve");
});
test("decline is deny", () => {
  assert.equal(classifyOffer({ decision: "decline", amount: null, apr: null }, { amountRequested: 1 }, null).classification, "deny");
});
test("notice required for deny or counteroffer only", () => {
  assert.equal(noticeRequired(["approve", "approve", "approve"]).required, false);
  assert.equal(noticeRequired(["approve", "counteroffer", "approve"]).required, true);
  assert.equal(noticeRequired(["deny", undefined]).required, true);
});
test("fcra paragraph names the source and the date", () => {
  const p = fcraParagraph("crs", Date.UTC(2026, 9, 24));
  assert.match(p, /CRS Credit API sandbox, pulled 2026-10-24/);
  assert.match(p, /did not make the decision/);
});
