// Deterministic plain-English narration of an applicant's audit events. No LLM, no Convex imports,
// so the web Inspector and the HTTP API can both use it.
import { fieldLabel, stopLabel } from "./labels.ts";

export type NarrEvent = { at: number; actor: string; action: string; ref?: string | null; note?: string | null };
export type NarrTone = "info" | "good" | "bad" | "human";
export type NarrDetail = { label: string; value: string };
/** `events` are the raw audit events this sentence collapsed; `details` is extra evidence for the expanded view. */
export type NarrLine<E extends NarrEvent = NarrEvent> = { at: number; text: string; tone: NarrTone; events: E[]; details?: NarrDetail[] };

const LENDER_ORDER = ["cu", "fintech", "prime", "regional", "subprime"];
const DEFAULT_LENDERS: Record<string, string> = {
  cu: "Pacific Ridge Credit Union",
  fintech: "Northstar Lending",
  prime: "Meridian Bank Prime",
  regional: "Cascade Regional Bank",
  subprime: "Harbor Second Chance Finance",
};

const CONVEX_ID = /\b[a-z0-9]{30,34}\b/g;

/** Strip ids, the word FICO and raw field paths from any text that reaches the reader. */
function clean(s: string): string {
  return s
    .replace(CONVEX_ID, "")
    .replace(/\bfico9\b/gi, "TransUnion score")
    .replace(/\bFICO(?:\s*9)?\b/gi, "TransUnion score")
    .replace(/\bcredit\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+|\[\d+\])*/g, (m) => (m.includes("tradelines") ? "a tradeline" : fieldLabel(m)))
    .replace(/\b(flags|identity|fraud)\.(deceased|frozen|bankruptcy|eviction|verified|score)\b/g, (m) => fieldLabel(m))
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

function dur(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s - m * 60);
  return r === 60 ? `${m + 1} min` : `${m} min ${r} s`;
}

const sentence = (s: string) => {
  const t = clean(s);
  return t ? t[0].toUpperCase() + t.slice(1) : t;
};
const stop = (s: string) => (/[.!?]$/.test(s) ? s : s + ".");
const lower = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const money = (n: string) => "$" + Number(n).toLocaleString("en-US");

function fallback(e: NarrEvent): string {
  const base = sentence(e.action.replace(/[._]+/g, " "));
  const note = sentence(e.note ?? "");
  return stop(note ? `${base}: ${note}` : base);
}

const VERDICT: Record<string, string> = {
  "verify.supported": "held up: changing it flipped the decision",
  "verify.unsupported": "did not hold up: changing it left the decision unchanged",
  "verify.inconclusive": "inconclusive",
};

export function narrateTrace<E extends NarrEvent = NarrEvent>(
  events: E[],
  ctx: { name?: string; lenders?: Record<string, string>; noticeText?: string } = {},
): { lines: NarrLine<E>[]; paragraph: string } {
  const names = { ...DEFAULT_LENDERS, ...(ctx.lenders ?? {}) };
  const lenderName = (id: string) => names[id] ?? sentence(id);
  const rows = events.map((e, i) => ({ e, i })).sort((a, b) => a.e.at - b.e.at || a.i - b.i).map((x) => x.e);
  const lines: NarrLine<E>[] = [];
  const say = (at: number, text: string, tone: NarrTone = "info", evs: E[] = [], details?: NarrDetail[]) =>
    lines.push({ at, text: clean(text), tone, events: evs, ...(details && details.length ? { details } : {}) });

  // Reasons that were counterfactual-tested, per lender (latest verdict per field).
  const tested: Record<string, Map<string, E>> = {};
  for (const e of rows) {
    const m = /^underwriter:(\w+)$/.exec(e.actor);
    if (m && e.action.startsWith("verify.") && e.action !== "verify.requested" && e.action !== "verify.sanity" && e.ref) {
      (tested[m[1]] ??= new Map()).set(e.ref, e);
    }
  }

  type L = { outcome: string; ms?: number; at: number; prose: string; failed?: boolean };
  let lenders: Record<string, L> = {};
  let lenderEvents: Record<string, E[]> = {};
  let verdicts = new Map<string, string>();
  let verifyEvents: E[] = [];
  let verifyAt = 0;
  let underwriteStart: number | null = null;
  let humanStart: number | null = null;
  let noticeLine = false;

  const flushLenders = (at: number) => {
    const ids = Object.keys(lenders).sort((a, b) => (LENDER_ORDER.indexOf(a) + 1 || 99) - (LENDER_ORDER.indexOf(b) + 1 || 99));
    for (const id of ids) {
      const l = lenders[id];
      const name = lenderName(id);
      const took = l.ms ?? (underwriteStart != null && l.at >= underwriteStart ? l.at - underwriteStart : undefined);
      const inTime = took != null ? ` in ${dur(took)}` : "";
      const evs = lenderEvents[id] ?? [];
      const details: NarrDetail[] = [{ label: "Outcome", value: l.failed ? "no answer" : l.outcome }];
      if (took != null) details.push({ label: "Time taken", value: dur(took) });
      if (l.prose) details.push({ label: "Lender note", value: clean(l.prose) });
      for (const [ref, ve] of tested[id] ?? []) {
        details.push({ label: fieldLabel(ref), value: VERDICT[ve.action] ?? ve.action });
      }
      if (l.failed) {
        say(at, `${name} did not answer${l.prose ? ` (${lower(l.prose)})` : ""}.`, "bad", evs, details);
        continue;
      }
      if (l.outcome === "approve") say(at, `${name} approved${inTime}.`, "good", evs, details);
      else if (l.outcome === "counteroffer") say(at, `${name} made a counteroffer${inTime}.`, "good", evs, details);
      else {
        const fields = [...(tested[id]?.keys() ?? [])].map(fieldLabel);
        const why = l.prose ? `: ${l.prose}` : fields.length ? `: ${plural(fields.length, "reason")} cited (${fields.join(", ")})` : "";
        say(at, `${name} declined${inTime}${why}.`, "info", evs, details);
      }
    }
    lenders = {};
    lenderEvents = {};
  };

  const flushVerify = (at: number) => {
    if (verdicts.size === 0) return;
    const all = verdicts.size;
    const held = [...verdicts.values()].filter((v) => v === "verify.supported").length;
    const withheld = [...verdicts.values()].filter((v) => v === "verify.unsupported").length;
    const unsure = all - held - withheld;
    let t = `Counterfactual test: ${held} of ${all} reasons held up`;
    if (withheld) t += `; ${withheld} withheld from the notice`;
    if (unsure) t += `; ${unsure} inconclusive`;
    const details: NarrDetail[] = [];
    for (const ve of verifyEvents) {
      if (ve.action === "verify.requested") continue;
      const who = /^underwriter:(\w+)$/.exec(ve.actor)?.[1];
      const m = /:\s*(.*?)\s*→\s*(.*?)\s*⇒\s*(\w+)/.exec(ve.note ?? "");
      const flip = m ? `${clean(m[1])} changed to ${clean(m[2])}, decision became ${m[3]}; ` : "";
      const verdict = ve.action === "verify.sanity" ? "sanity check" : VERDICT[ve.action] ?? ve.action;
      details.push({ label: `${who ? lenderName(who) + ": " : ""}${fieldLabel(ve.ref ?? "")}`, value: flip + verdict });
    }
    say(at, t + ".", withheld ? "bad" : "good", verifyEvents, details);
    verdicts = new Map();
    verifyEvents = [];
  };

  for (const e of rows) {
    const note = (e.note ?? "").trim();
    const a = e.action;
    const uw = /^underwriter:(\w+)$/.exec(e.actor);

    if (uw && /^underwrite\./.test(a)) {
      const id = uw[1];
      const outcome = a.slice("underwrite.".length);
      (lenderEvents[id] ??= []).push(e);
      if (outcome === "started") continue;
      const msM = /\b(\d+)\s*ms\b/.exec(note);
      const prose = note.replace(/\[[^\]]*\]/g, "").replace(/\b\d+\s*ms\b/g, "").replace(/classification=.*$/, "").trim();
      lenders[id] = { outcome, at: e.at, ms: msM ? Number(msM[1]) : undefined, prose: /^[\s\d.,;:-]*$/.test(prose) ? "" : prose.slice(0, 200), failed: outcome === "failed" || outcome === "undefined" };
      continue;
    }
    if (a.startsWith("verify.") && a !== "verify.requested") {
      verifyEvents.push(e);
      if (a !== "verify.sanity") {
        verdicts.set(`${e.actor}|${e.ref ?? ""}`, a);
        verifyAt = e.at;
      }
      continue;
    }

    switch (a) {
      case "intake.submitted":
        say(e.at, stop(`Application received${note ? `: ${note.replace(/,?\s*consent recorded/, "")}` : ""}`), "info", [e]);
        break;
      case "intake.replay": {
        const why = note.replace(/^replay of \S+:?\s*/, "");
        say(e.at, stop(`Replay started on the corrected file${why ? `: ${why}` : ""}`), "info", [e]);
        break;
      }
      case "replay.started":
        say(e.at, stop(sentence(note || "Re-running all lenders on the corrected file")), "info", [e]);
        break;
      case "dispute.tradeline": {
        const d = note.replace(/^disputed\s*/, "");
        say(e.at, stop(`Applicant disputed a tradeline${d ? `: ${d}` : ""}`), "info", [e]);
        break;
      }
      case "step.pull.start":
      case "step.guardrails.start":
      case "step.verify.start":
      case "step.compliance.start":
      case "step.compliance.done":
        break;
      case "step.underwrite.start":
        underwriteStart = e.at;
        break;
      case "step.pull.done": {
        const start = rows.find((r) => r.action === "step.pull.start" && r.at <= e.at);
        const src = /source=(\w+)/.exec(note)?.[1];
        const from = src === "crs" ? "the CRS sandbox" : src ? "a stored fixture" : "the bureau";
        say(e.at, `Bureau file pulled from ${from}${start ? ` in ${dur(e.at - start.at)}` : ""}.`, "info", start ? [start, e] : [e]);
        break;
      }
      case "step.guardrails.done":
        break; // the rules.pass / rules.hard_stop events carry the story
      case "rules.pass":
        say(e.at, "No hard-stop rule fired.", "good", [e]);
        break;
      case "rules.hard_stop": {
        const label = stop(lower(stopLabel(e.ref ?? "")));
        say(e.at, `Hard stop: ${label}${note ? " " + stop(sentence(note)) : ""}`, "bad", [e]);
        break;
      }
      case "step.underwrite.done":
        flushLenders(e.at);
        break;
      case "step.verify.done":
        flushVerify(e.at);
        break;
      case "verify.requested":
        say(e.at, "Loan officer asked for the counterfactual test to be re-run.", "human", [e]);
        break;
      case "compliance.notice": {
        const ms = /\b(\d+)\s*ms\b/.exec(note);
        const model = /model=([\w.-]+)/.exec(note)?.[1] ?? /provider=([\w.-]+)/.exec(note)?.[1];
        const how = /no model/.test(note) ? "from the code template, no model" : [model, ms ? dur(Number(ms[1])) : ""].filter(Boolean).join(", ");
        say(e.at, `Adverse-action notice drafted${how ? ` (${how})` : ""}, awaiting sign-off.`, "good", [e], ctx.noticeText ? [{ label: "Notice text", value: clean(ctx.noticeText).slice(0, 300) }] : undefined);
        noticeLine = true;
        break;
      }
      case "compliance.failed":
        say(e.at, stop(`Adverse-action notice could not be drafted${note ? `: ${sentence(note.replace(/\[[^\]]*\]/g, ""))}` : ""}`), "bad", [e]);
        break;
      case "compliance.unverified_reasons_used":
        say(e.at, "The notice uses the lenders' stated reasons because none passed the counterfactual test.", "bad", [e]);
        break;
      case "step.compliance.skipped":
        say(e.at, stop(`No adverse-action notice is required${note ? `: ${lower(sentence(note))}` : ""}`), "info", [e]);
        break;
      case "notice.approved":
        say(e.at, "Loan officer signed off on the adverse-action notice.", "human", [e]);
        break;
      case "step.human.start":
        humanStart = e.at;
        if (/errored/.test(note)) break;
        {
          const end = rows.find((r) => r.at >= e.at && (r.action === "step.human.done" || r.action === "notice.approved"));
          say(e.at, end ? `Waiting on the loan officer for ${dur(end.at - e.at)}.` : "Waiting on the loan officer.", "human", end ? [e, end] : [e]);
        }
        break;
      case "step.human.done": {
        const m = /approved (\w+) offer: \$(\d+(?:\.\d+)?) at ([\d.]+)% for (\d+) months/.exec(note);
        if (m) say(e.at, `Approved the ${lenderName(m[1])} offer at ${m[3]}%: ${money(m[2])} over ${m[4]} months.`, "human", [e]);
        else if (/declined/.test(note)) {
          const why = note.replace(/^declined by loan officer\s*[—-]?\s*/, "");
          say(e.at, why ? `Declined. Rationale: ${stop(sentence(why))}` : "Declined.", "human", [e]);
        } else say(e.at, fallback(e), "human", [e]);
        humanStart = null;
        break;
      }
      case "offer.chosen": {
        const m = /chose (\w+):\s*\$(\d+(?:\.\d+)?) at ([\d.]+)% for (\d+) months/.exec(note);
        say(e.at, m ? `Borrower chose the ${lenderName(m[1])} offer at ${m[3]}%: ${money(m[2])} over ${m[4]} months.` : fallback(e), "info", [e]);
        break;
      }
      case "override.blocked": {
        const n = /attempt (\d+)/.exec(note)?.[1];
        say(e.at, `Override refused and logged${n && Number(n) > 1 ? ` (attempt ${n})` : ""}.`, "bad", [e]);
        break;
      }
      case "crs.error":
        say(e.at, "Bureau pull failed; the desk fell back to a stored fixture.", "bad", [e]);
        break;
      case "desk.error":
        say(e.at, stop(`The desk hit an error${note ? `: ${sentence(note)}` : ""}`), "bad", [e]);
        break;
      default:
        say(e.at, fallback(e), /fail|error|timeout|timed out/i.test(a + note) ? "bad" : e.actor === "human" ? "human" : "info", [e]);
    }
  }
  void humanStart;
  void noticeLine;
  const lastAt = rows.length ? rows[rows.length - 1].at : 0;
  flushLenders(lastAt);
  flushVerify(verifyAt || lastAt);

  lines.sort((a, b) => a.at - b.at); // stable: keeps the fixed lender order
  return { lines, paragraph: lines.map((l) => l.text).join(" ") };
}
