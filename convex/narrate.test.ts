// Run: npm test   (node --test, Node 22+ strips types natively)
import { test } from "node:test";
import assert from "node:assert/strict";
import { narrateTrace } from "./narrate.ts";

type Ev = { at: number; actor: string; action: string; ref?: string | null; note?: string | null };
const T0 = 1_700_000_000_000;
const ev = (s: number, actor: string, action: string, note = "", ref: string | null = null): Ev => ({ at: T0 + s * 1000, actor, action, ref, note });
const ID = "k57abcdefghjkmnpqrstvwxyz12345ab";
const show = (title: string, r: ReturnType<typeof narrateTrace>) => {
  if (process.env.NARRATE_SHOW) console.log(`\n== ${title}\n` + r.lines.map((l) => `[${l.tone}] ${l.text}`).join("\n"));
};

const head = [
  ev(0, "intake", "intake.submitted", "Maya Ortiz: $12000 for debt consolidation, stated income $64000, consent recorded"),
  ev(0.1, "desk", "step.pull.start", "persona P01"),
  ev(2.4, "desk", "step.pull.done", "source=crs; 3 tradelines"),
  ev(2.5, "desk", "step.guardrails.start"),
];

test("clean approval", () => {
  const events = [
    ...head,
    ev(2.6, "rules", "rules.pass", "no hard-stop rule fired"),
    ev(2.6, "desk", "step.guardrails.done", "passed"),
    ev(2.7, "desk", "step.underwrite.start", "cu, fintech"),
    ev(5.1, "underwriter:fintech", "underwrite.approve", "2300ms [provider=creao]", ID),
    ev(5.0, "underwriter:cu", "underwrite.approve", "2200ms [provider=creao]", ID),
    ev(5.2, "desk", "step.underwrite.done", "2 approve (0 counteroffer), 0 decline, 0 failed"),
    ev(5.3, "desk", "step.compliance.skipped", "all lenders approved"),
    ev(5.4, "desk", "step.human.start", "awaiting loan officer"),
    ev(200.4, "human", "step.human.done", "approved fintech offer: $12000 at 15.9% for 36 months", ID),
  ];
  const r = narrateTrace(events, { name: "Maya" });
  show("clean approval", r);
  const t = r.lines.map((l) => l.text);
  assert.ok(t.includes("Bureau file pulled from the CRS sandbox in 2.3 s."));
  assert.ok(t.includes("No hard-stop rule fired."));
  assert.ok(t.includes("Pacific Ridge Credit Union approved in 2.2 s."));
  assert.ok(t.indexOf("Pacific Ridge Credit Union approved in 2.2 s.") < t.findIndex((x) => x.startsWith("Northstar Lending approved")));
  assert.ok(t.includes("Waiting on the loan officer for 3 min 15 s."));
  assert.ok(t.includes("Approved the Northstar Lending offer at 15.9%: $12,000 over 36 months."));
  assert.equal(r.lines.at(-1)!.tone, "human");
  assert.ok(!r.paragraph.includes(ID));
  assert.ok(r.lines.find((l) => l.text.startsWith("Bureau file"))!.events.length === 2);
});

test("hard stop names the rule and the notice", () => {
  const events = [
    ...head,
    ev(2.6, "rules", "rules.hard_stop", "fraud risk score 88 is at or above the 80 threshold", "identity.verified"),
    ev(2.6, "desk", "step.guardrails.done", "HARD STOP on identity.verified"),
    ev(2.7, "compliance", "compliance.notice", "adverse-action notice generated at hard stop (code template, no model); awaiting human sign-off", ID),
    ev(2.8, "human", "override.blocked", "Override blocked: fraud review required (rule identity.verified); attempt 1", "identity.verified"),
  ];
  const r = narrateTrace(events, { noticeText: "Dear applicant, we could not approve." });
  show("hard stop", r);
  const t = r.lines.map((l) => l.text);
  assert.ok(t.includes("Hard stop: identity could not be verified. Fraud risk score 88 is at or above the 80 threshold."));
  assert.ok(t.includes("Override refused and logged."));
  assert.ok(t.some((x) => /^The compliance agent drafted the adverse-action notice \(from the code template\), awaiting sign-off\.$/.test(x)));
  assert.equal(r.lines.find((l) => l.text.startsWith("Hard stop"))!.tone, "bad");
  assert.equal(r.lines.find((l) => l.text.startsWith("The compliance agent"))!.details![0].label, "Notice text");
  assert.ok(!/identity\.verified|FICO/i.test(r.paragraph));
});

test("decline with verification and notice", () => {
  const events = [
    ...head,
    ev(2.6, "rules", "rules.pass", "no hard-stop rule fired"),
    ev(2.7, "desk", "step.underwrite.start", "cu"),
    ev(5.1, "underwriter:cu", "underwrite.decline", "2400ms [provider=creao]", ID),
    ev(5.2, "desk", "step.underwrite.done", "0 approve, 1 decline"),
    ev(5.3, "desk", "step.verify.start", "1 decline(s) to test"),
    ev(6, "underwriter:cu", "verify.supported", "[flip] credit.fico9: 560 → 720 ⇒ approve (900ms) flipped", "credit.fico9"),
    ev(6, "underwriter:cu", "verify.supported", "[flip] credit.utilization: 0.55 → 0.2 ⇒ approve (900ms) flipped", "credit.utilization"),
    ev(6, "underwriter:cu", "verify.unsupported", "[flip] credit.inquiries6mo: 5 → 1 ⇒ decline (900ms) no change", "credit.inquiries6mo"),
    ev(6.1, "desk", "step.verify.done", "3 reasons tested: 2 flipped (verified), 1 unsupported (withheld from notice)"),
    ev(6.2, "desk", "step.compliance.start", "a lender declined"),
    ev(10.8, "compliance", "compliance.notice", "4600ms [provider=creao runId=r1]"),
    ev(10.9, "desk", "step.compliance.done", "ok"),
    ev(11, "desk", "step.human.start", "awaiting loan officer"),
    ev(31, "human", "step.human.done", "declined by loan officer — thin file"),
  ];
  const r = narrateTrace(events);
  show("decline with verification", r);
  const t = r.lines.map((l) => l.text);
  const d = t.find((x) => x.startsWith("Pacific Ridge Credit Union declined in 2.4 s"))!;
  assert.ok(d, "lender line");
  assert.ok(d.includes("score") && d.includes("utilization"));
  assert.ok(t.includes("Counterfactual test: 2 of 3 reasons held up; 1 withheld from the notice."));
  assert.ok(t.includes("The compliance agent drafted the adverse-action notice (4.6 s), awaiting sign-off."));
  assert.ok(t.includes("Waiting on the loan officer for 20.0 s."));
  assert.ok(t.includes("Declined. Rationale: Thin file."));
  const v = r.lines.find((l) => l.text.startsWith("Counterfactual"))!;
  assert.equal(v.events.length, 3);
  assert.ok(v.details!.some((x) => x.label.includes("score") && /720/.test(x.value)));
  assert.ok(!/fico|credit\./i.test(r.paragraph));
});

test("replay after a dispute", () => {
  const events = [
    ev(0, "applicant", "dispute.tradeline", "disputed credit_card 90dpd $4200 opened 2021-03-01 — not mine", "credit.tradelines[2]"),
    ev(0.1, "desk", "replay.started", `re-running all 5 lenders on the corrected bundle`, ID),
    ev(0.2, "intake", "intake.replay", `replay of ${ID}: tradeline 2 removed`, ID),
    ev(1, "desk", "step.underwrite.start"),
    ev(3, "underwriter:prime", "underwrite.failed", "timed out waiting for async agent"),
  ];
  const r = narrateTrace(events, { lenders: { prime: "Meridian Bank Prime" } });
  show("replay after dispute", r);
  const t = r.lines.map((l) => l.text);
  assert.ok(t[0].startsWith("Applicant disputed a tradeline"));
  assert.ok(t.some((x) => x.startsWith("Replay started on the corrected file: tradeline 2 removed")));
  assert.ok(t.includes("Meridian Bank Prime did not answer (timed out waiting for async agent)."));
  assert.equal(r.lines.at(-1)!.tone, "bad");
  assert.ok(!r.paragraph.includes(ID));
  assert.ok(!r.paragraph.includes("credit.tradelines"));
});

test("unknown action falls back to a sentence", () => {
  const r = narrateTrace([ev(0, "desk", "foo.bar_baz", "something odd")]);
  assert.equal(r.lines[0].text, "Foo bar baz: Something odd.");
  assert.equal(r.paragraph, r.lines[0].text);
});
