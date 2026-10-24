import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { applicantStatus } from "./schema";

const http = httpRouter();

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => new Response("ok", { status: 200 })),
});

// CREAO completion webhook. Payloads are unsigned, so this handler only treats
// the body as a hint: it looks up the runId we started, re-fetches the run from
// CREAO with our API key, and completes the offer/notice from THAT response.
http.route({
  path: "/creao/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return new Response("bad json", { status: 400 });
    }
    const runId = body?.runId ?? body?.id ?? body?.run_id;
    if (!runId) return new Response("missing runId", { status: 400 });
    const run = await ctx.runQuery(internal.agents.getRunByRunId, { runId: String(runId) });
    if (!run) return new Response("unknown run (ignored)", { status: 200 });
    if (run.status !== "pending") return new Response("already handled", { status: 200 });
    try {
      const r = await ctx.runAction(internal.agents.verifyAndCompleteRun, { runId: String(runId) });
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    } catch (err: any) {
      // 5xx makes CREAO retry (up to 3 attempts); the poll loop also covers us.
      return new Response(String(err?.message ?? err), { status: 500 });
    }
  }),
});

// ---------------------------------------------------------------------------
// Public API: /api/v1/*  (Authorization: Bearer <DOCKET_API_KEY>)
// ---------------------------------------------------------------------------
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-max-age": "86400",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } });
const text = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", ...CORS } });
const fail = (status: number, message: string) => json({ error: message }, status);

/** Constant-time-ish string compare. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Returns an error Response when the caller is not allowed in, else null. Unset key = closed (503). */
function authError(req: Request): Response | null {
  const key = process.env.DOCKET_API_KEY;
  if (!key) return fail(503, "The Docket API is disabled: DOCKET_API_KEY is not set on this deployment.");
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!m || !safeEqual(m[1].trim(), key)) return fail(401, "Missing or invalid bearer token. Send Authorization: Bearer <DOCKET_API_KEY>.");
  return null;
}

/** Convex wraps thrown errors; pull the human message out and map it to a status. */
function errorResponse(err: unknown): Response {
  const raw = String((err as any)?.data ?? (err as any)?.message ?? err);
  const m = /Uncaught Error: (.*?)(?:\n|$)/.exec(raw);
  const msg = (m ? m[1] : raw.split("\n")[0]).replace(/^\[Request ID: [^\]]*\]\s*/, "").trim() || "request failed";
  if (/not found|unknown personaId/.test(msg)) return fail(msg.startsWith("unknown personaId") ? 400 : 404, msg);
  if (/not awaiting_human|only an approved offer|no offer from/.test(msg)) return fail(409, msg);
  if (/must be|required|invalid/i.test(msg)) return fail(400, msg);
  return fail(500, msg);
}

async function readBody(req: Request): Promise<Record<string, unknown> | Response> {
  try {
    const b: unknown = await req.json();
    if (b && typeof b === "object" && !Array.isArray(b)) return b as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  return fail(400, "Body must be a JSON object.");
}

const api1 = (fn: (ctx: any, req: Request, url: URL) => Promise<Response>) =>
  httpAction(async (ctx, req) => {
    const denied = authError(req);
    if (denied) return denied;
    try {
      return await fn(ctx, req, new URL(req.url));
    } catch (err) {
      return errorResponse(err);
    }
  });

/** Plain-English trace, written by convex/narrate.ts (deterministic, no LLM). */
function traceText(t: { applicantName: string; status: string; narrative: string }): string {
  return `Audit trail for ${t.applicantName} (status: ${t.status})\n${t.narrative}`;
}

const preflight = httpAction(async () => new Response(null, { status: 204, headers: CORS }));
for (const path of ["/api/v1/applicants", "/api/v1/applications", "/api/v1/eval"]) http.route({ path, method: "OPTIONS", handler: preflight });
for (const pathPrefix of ["/api/v1/decisions/", "/api/v1/traces/"]) http.route({ pathPrefix, method: "OPTIONS", handler: preflight });

http.route({
  path: "/api/v1/applicants",
  method: "GET",
  handler: api1(async (ctx, _req, url) => {
    const status = url.searchParams.get("status");
    if (status && !(applicantStatus as any).members.some((m: any) => m.value === status)) return fail(400, `invalid status ${status}`);
    const rows = await ctx.runQuery(internal.api.listApplicants, { ...(status ? { status } : {}) });
    return json(rows);
  }),
});

const idFrom = (url: URL, prefix: string) => url.pathname.slice(prefix.length).split("/").filter(Boolean);

http.route({
  pathPrefix: "/api/v1/decisions/",
  method: "GET",
  handler: api1(async (ctx, _req, url) => {
    const parts = idFrom(url, "/api/v1/decisions/");
    if (parts.length === 1) {
      const rec = await ctx.runQuery(internal.api.decisionRecord, { applicantId: parts[0] });
      return rec ? json(rec) : fail(404, "applicant not found");
    }
    if (parts.length === 2 && parts[1] === "summary") {
      const exists = await ctx.runQuery(internal.api.trace, { applicantId: parts[0] });
      if (!exists) return fail(404, "applicant not found");
      return json(await ctx.runAction(api.assistant.summarize, { applicantId: parts[0] }));
    }
    return fail(404, "no such route");
  }),
});

http.route({
  pathPrefix: "/api/v1/decisions/",
  method: "POST",
  handler: api1(async (ctx, req, url) => {
    const parts = idFrom(url, "/api/v1/decisions/");
    if (parts.length !== 2 || !["approve", "decline"].includes(parts[1])) return fail(404, "no such route");
    const body = await readBody(req);
    if (body instanceof Response) return body;
    const note = typeof body.note === "string" ? body.note.slice(0, 500) : undefined;
    if (parts[1] === "approve") {
      if (typeof body.lender !== "string" || !body.lender) return fail(400, "lender is required");
      return json(await ctx.runMutation(internal.api.approve, { applicantId: parts[0], lender: body.lender, ...(note ? { note } : {}) }));
    }
    return json(await ctx.runMutation(internal.api.decline, { applicantId: parts[0], ...(note ? { note } : {}) }));
  }),
});

http.route({
  pathPrefix: "/api/v1/traces/",
  method: "GET",
  handler: api1(async (ctx, _req, url) => {
    const parts = idFrom(url, "/api/v1/traces/");
    if (parts.length !== 1) return fail(404, "no such route");
    const format = url.searchParams.get("format") ?? "json";
    if (format !== "json" && format !== "text") return fail(400, "format must be json or text");
    const t = await ctx.runQuery(internal.api.trace, { applicantId: parts[0] });
    if (!t) return fail(404, "applicant not found");
    return format === "json" ? json(t.events) : text(traceText(t));
  }),
});

http.route({
  path: "/api/v1/applications",
  method: "POST",
  handler: api1(async (ctx, req) => {
    const b = await readBody(req);
    if (b instanceof Response) return b;
    if (typeof b.personaId !== "string" || typeof b.purpose !== "string" || typeof b.amountRequested !== "number" || typeof b.statedIncome !== "number") {
      return fail(400, "personaId (string), purpose (string), amountRequested (number) and statedIncome (number) are required");
    }
    return json(
      await ctx.runMutation(internal.api.createApplication, {
        personaId: b.personaId,
        purpose: b.purpose.slice(0, 200),
        amountRequested: b.amountRequested,
        statedIncome: b.statedIncome,
      }),
      202,
    );
  }),
});

const OUTCOMES = new Set(["approve", "decline", "hard_stop"]);
const PER_LENDER = new Set(["approve", "counteroffer", "decline", "none"]);

http.route({
  path: "/api/v1/eval",
  method: "POST",
  handler: api1(async (ctx, req) => {
    let body: Record<string, unknown> = {};
    const raw = await req.text();
    if (raw.trim()) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fail(400, "Body must be a JSON object.");
        body = parsed as Record<string, unknown>;
      } catch {
        return fail(400, "Body must be valid JSON.");
      }
    }
    let r: any;
    if (body.cases === undefined) {
      r = await ctx.runAction(api.eval.runEval, {});
    } else {
      if (!Array.isArray(body.cases) || body.cases.length === 0) return fail(400, "cases must be a non-empty array");
      const cases: any[] = [];
      for (const c of body.cases as any[]) {
        if (!c || typeof c.personaId !== "string" || !OUTCOMES.has(c.expected)) return fail(400, "each case needs personaId and expected (approve|decline|hard_stop)");
        const epl: Record<string, string> = {};
        for (const [k, val] of Object.entries(c.expectedPerLender ?? {})) {
          if (!["cu", "fintech", "prime", "regional", "subprime"].includes(k) || !PER_LENDER.has(val as string)) return fail(400, `bad expectedPerLender entry ${k}`);
          epl[k] = val as string;
        }
        cases.push({
          personaId: c.personaId,
          expected: c.expected,
          ...(Array.isArray(c.expectedReasonsIncludes) ? { expectedReasonsIncludes: c.expectedReasonsIncludes.map(String) } : {}),
          ...(Object.keys(epl).length ? { expectedPerLender: epl } : {}),
        });
      }
      r = await ctx.runAction(internal.eval.runEvalWithCases, { cases });
    }
    return json({
      runId: r.runId,
      cases: r.cases,
      agreement: r.agreement,
      perLenderAgreement: r.perLenderAgreement,
      reasonsVerifiedPct: r.reasonsVerifiedPct,
      latencyP50Ms: r.latencyP50Ms,
      perLenderMismatches: r.perLenderMismatches,
      failures: r.failures,
    });
  }),
});

export default http;
