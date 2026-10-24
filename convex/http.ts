import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

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

export default http;
