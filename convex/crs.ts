// Credit bundle pull with a provider switch.
//   CRS_PROVIDER = "mock" (default; serves the captured sandbox fixtures) | "crs" (live)
// "crs" targets the CRS (StitchCredit) sandbox. Login happens ONCE and the bearer
// token is cached in secretsCache (refreshToken too); a failed login is recorded
// and never retried for 30 min (repeated failures disable the sandbox account).
// A 401 on a data call clears the cached token and surfaces an error. It never
// triggers a login loop; the next pull refreshes via /users/refresh-token first.
//
// Product calls, normalization and the fraud-score mapping live in crs.core.ts.
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { BundleData } from "./types";
import { mockBundle, findPersona } from "./crs.mock";
import { credit, identity, fraud, flags } from "./schema";
import { CRS_PERSONAS } from "./crs.personas";
import { CrsAuthError, normalizeProducts, pullRaw, type CrsHttp, type CrsRequests, type HttpResult, type PullOptions } from "./crs.core";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CRS_BASE_URL = () => (process.env.CRS_BASE_URL ?? "https://api-sandbox.stitchcredit.com/api").replace(/\/$/, "");
const CRS_PATH_LOGIN = "/users/login";
const CRS_PATH_REFRESH = "/users/refresh-token";

const TOKEN_KEY = "crs_token";
const REFRESH_KEY = "crs_refresh_token";
const LOGIN_FAILED_KEY = "crs_login_failed_at";
const TOKEN_TTL_MS = 50 * 60 * 1000; // sandbox tokens last 3600 s; refresh at 50 min
const REFRESH_TTL_MS = 12 * 3600 * 1000;
const LOGIN_COOLDOWN_MS = 30 * 60 * 1000; // after a failed login, do not try again for 30 min

// ---------------------------------------------------------------------------
// secretsCache helpers
// ---------------------------------------------------------------------------
export const getSecret = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const row = await ctx.db
      .query("secretsCache")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (!row) return null;
    if (row.expiresAt < Date.now()) return null;
    return row.value;
  },
});

export const setSecret = internalMutation({
  args: { key: v.string(), value: v.string(), ttlMs: v.number() },
  handler: async (ctx, { key, value, ttlMs }) => {
    const existing = await ctx.db
      .query("secretsCache")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    const doc = { key, value, expiresAt: Date.now() + ttlMs, updatedAt: Date.now() };
    if (existing) await ctx.db.replace(existing._id, doc);
    else await ctx.db.insert("secretsCache", doc);
  },
});

export const clearSecret = internalMutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const existing = await ctx.db
      .query("secretsCache")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

// ---------------------------------------------------------------------------
// CRS client
// ---------------------------------------------------------------------------
async function storeTokens(ctx: any, json: any): Promise<string> {
  const token: string | undefined = json?.token ?? json?.accessToken ?? json?.access_token;
  if (!token) throw new Error("CRS auth response had no token field");
  const ttl = typeof json?.expires === "number" ? Math.max(60_000, json.expires * 1000 - 600_000) : TOKEN_TTL_MS;
  await ctx.runMutation(internal.crs.setSecret, { key: TOKEN_KEY, value: token, ttlMs: ttl });
  if (json?.refreshToken) await ctx.runMutation(internal.crs.setSecret, { key: REFRESH_KEY, value: String(json.refreshToken), ttlMs: REFRESH_TTL_MS });
  return token;
}

/** Cached bearer -> refresh token -> exactly one login (guarded by a 30 min failure cooldown). */
async function getToken(ctx: any): Promise<string> {
  const cached: string | null = await ctx.runQuery(internal.crs.getSecret, { key: TOKEN_KEY });
  if (cached) return cached;

  const refresh: string | null = await ctx.runQuery(internal.crs.getSecret, { key: REFRESH_KEY });
  if (refresh) {
    try {
      const res = await fetch(`${CRS_BASE_URL()}${CRS_PATH_REFRESH}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (res.ok) return await storeTokens(ctx, await res.json());
    } catch {
      /* fall through to login */
    }
    await ctx.runMutation(internal.crs.clearSecret, { key: REFRESH_KEY });
  }

  const failedAt: string | null = await ctx.runQuery(internal.crs.getSecret, { key: LOGIN_FAILED_KEY });
  if (failedAt) {
    throw new CrsAuthError(
      `CRS login failed at ${new Date(Number(failedAt)).toISOString()}; refusing to retry for ${LOGIN_COOLDOWN_MS / 60000} min to protect the sandbox account. Clear secretsCache/${LOGIN_FAILED_KEY} to force.`,
    );
  }
  const username = process.env.CRS_USERNAME;
  const password = process.env.CRS_PASSWORD;
  if (!username || !password) throw new CrsAuthError("CRS_USERNAME / CRS_PASSWORD not set");

  const res = await fetch(`${CRS_BASE_URL()}${CRS_PATH_LOGIN}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    // Record the failure BEFORE throwing so no other action retries a bad login.
    await ctx.runMutation(internal.crs.setSecret, { key: LOGIN_FAILED_KEY, value: String(Date.now()), ttlMs: LOGIN_COOLDOWN_MS });
    const body = await res.text().catch(() => "");
    throw new CrsAuthError(`CRS login ${res.status}: ${body.slice(0, 200)}`);
  }
  return await storeTokens(ctx, await res.json());
}

function makeHttp(ctx: any, token: string): CrsHttp {
  return {
    async request(method, path, body): Promise<HttpResult> {
      const t0 = Date.now();
      const res = await fetch(`${CRS_BASE_URL()}${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
        body: method === "GET" || body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.status === 401) {
        // Drop the bearer; NEVER log in again inside this pull.
        await ctx.runMutation(internal.crs.clearSecret, { key: TOKEN_KEY });
        throw new CrsAuthError(`CRS ${method} ${path} returned 401; cached token cleared, no login retry`);
      }
      const text = await res.text().catch(() => "");
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        /* non-JSON */
      }
      return { status: res.status, ms: Date.now() - t0, requestId: res.headers.get("requestid"), json, text: json ? undefined : text.slice(0, 300) };
    },
  };
}

export type CrsPull = {
  bundle: BundleData;
  raw: any;
  calls: number;
  ms: number;
};

async function pullFromCrs(ctx: any, personaId: string, opts: PullOptions = {}): Promise<CrsPull> {
  const envMap = process.env.CRS_PERSONA_MAP ? (JSON.parse(process.env.CRS_PERSONA_MAP) as Record<string, CrsRequests>) : {};
  const requests: CrsRequests | undefined = envMap[personaId] ?? CRS_PERSONAS[personaId]?.requests;
  if (!requests) throw new Error(`No CRS sandbox consumer mapped for personaId ${personaId} (see convex/crs.personas.ts)`);
  const token = await getToken(ctx);
  const t0 = Date.now();
  const rawPull = await pullRaw(makeHttp(ctx, token), requests, {
    includeCriminal: opts.includeCriminal ?? process.env.CRS_INCLUDE_CRIMINAL === "1",
    includeEviction: opts.includeEviction ?? process.env.CRS_INCLUDE_EVICTION === "1",
    delayMs: opts.delayMs ?? 200,
    alwaysRetrieve: opts.alwaysRetrieve ?? process.env.CRS_ALWAYS_RETRIEVE === "1",
  });
  const everyAuthFailed = Object.values(rawPull.products).length > 0 && Object.values(rawPull.products).every((p) => p.status === 401);
  if (everyAuthFailed) throw new CrsAuthError(Object.values(rawPull.products)[0].error ?? "CRS 401");
  const n = normalizeProducts(rawPull.products);
  const ms = Date.now() - t0;
  return {
    bundle: n.bundle,
    calls: rawPull.calls,
    ms,
    raw: {
      provider: "crs",
      personaId,
      bureaus: n.bureaus,
      notes: n.notes,
      extras: n.extras,
      timing: { wallMs: ms, calls: rawPull.calls },
      products: Object.fromEntries(Object.entries(rawPull.products).map(([k, p]) => [k, { ok: p.ok, status: p.status, ms: p.ms, requestId: p.requestId, error: p.error, retrieved: p.retrieved, json: p.json }])),
    },
  };
}

const crsOptionsArg = v.optional(v.object({ includeCriminal: v.optional(v.boolean()), includeEviction: v.optional(v.boolean()), alwaysRetrieve: v.optional(v.boolean()) }));

/** `convex run crs:captureFixture '{"personaId":"P01"}'` -> full live pull + normalization as JSON (used to refresh convex/fixtures/crs). */
export const captureFixture = internalAction({
  args: { personaId: v.string(), options: crsOptionsArg },
  handler: async (ctx, { personaId, options }) => {
    const pull = await pullFromCrs(ctx, personaId, options ?? {});
    const p = CRS_PERSONAS[personaId];
    return { personaId, displayName: p?.displayName, label: p?.label, about: p?.about, source: "crs", calls: pull.calls, sandboxMs: pull.ms, bundle: pull.bundle, bureaus: pull.raw.bureaus, notes: pull.raw.notes, extras: pull.raw.extras, raw: Object.fromEntries(Object.entries(pull.raw.products).map(([k, p]: any) => [k, p.json])) };
  },
});

// ---------------------------------------------------------------------------
// Persist
// ---------------------------------------------------------------------------
export const insertBundle = internalMutation({
  args: {
    applicantId: v.id("applicants"),
    source: v.union(v.literal("crs"), v.literal("nessie"), v.literal("mock")),
    credit,
    identity,
    fraud,
    flags,
    raw: v.any(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("bundles", { ...args, pulledAt: Date.now() });
  },
});

export type PullResult = { source: "crs" | "mock"; bundle: BundleData; note: string };

export const latestBundleFor = internalQuery({
  args: { applicantId: v.id("applicants") },
  handler: async (ctx, { applicantId }) =>
    await ctx.db
      .query("bundles")
      .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
      .order("desc")
      .first(),
});

/**
 * Dispute-and-replay on mock data: remove the disputed tradeline and apply a
 * deterministic, documented correction so the replay can differ:
 *  - revolving utilization is rescaled by the removed card balance's share;
 *  - scores rise 25 points if the removed line was derogatory, else 5.
 * (With CRS_PROVIDER=crs the bundle is simply re-pulled.)
 */
export function removeTradeline(bundle: BundleData, index: number): { bundle: BundleData; removed: BundleData["credit"]["tradelines"][number]; note: string } {
  const tls = bundle.credit.tradelines;
  if (index < 0 || index >= tls.length) throw new Error(`tradelineIndex ${index} out of range (0..${tls.length - 1})`);
  const removed = tls[index];
  const next: BundleData = JSON.parse(JSON.stringify(bundle));
  next.credit.tradelines.splice(index, 1);
  const derog = /dpd|discharged|collection|charge.?off|late/i.test(removed.status);
  const bump = derog ? 25 : 5;
  if (next.credit.fico9 != null) next.credit.fico9 = Math.min(850, next.credit.fico9 + bump);
  if (next.credit.vantage4 != null) next.credit.vantage4 = Math.min(850, next.credit.vantage4 + bump);
  if (removed.type === "credit_card" && next.credit.utilization != null) {
    const revolving = tls.filter((t) => t.type === "credit_card").reduce((a, t) => a + t.balance, 0);
    if (revolving > 0) next.credit.utilization = Math.round(next.credit.utilization * (1 - removed.balance / revolving) * 100) / 100;
  }
  return { bundle: next, removed, note: `removed ${removed.type} ${removed.status} $${removed.balance} (opened ${removed.openedAt}); score +${bump}` };
}

const disputeArg = v.object({ fromApplicantId: v.id("applicants"), tradelineIndex: v.number() });

/** Step 1 of runDesk. Pulls the bundle, stores it, returns it without raw. */
export const pullBundle = internalAction({
  args: { applicantId: v.id("applicants"), personaId: v.string(), dispute: v.optional(disputeArg), options: crsOptionsArg },
  handler: async (ctx, { applicantId, personaId, dispute, options }): Promise<PullResult> => {
    const provider = (process.env.CRS_PROVIDER ?? "mock").toLowerCase();
    let source: "crs" | "mock" = "mock";
    let note = "";
    let data: BundleData & { raw: unknown };

    if (dispute && provider !== "crs") {
      const prev = await ctx.runQuery(internal.crs.latestBundleFor, { applicantId: dispute.fromApplicantId });
      if (!prev) throw new Error("original bundle not found for dispute replay");
      const { raw: _r, _id, _creationTime, applicantId: _a, source: prevSource, pulledAt: _p, ...prevBundle } = prev;
      const fixed = removeTradeline(prevBundle as BundleData, dispute.tradelineIndex);
      data = { ...fixed.bundle, raw: { provider: "mock", personaId, dispute, removed: fixed.removed, basedOnBundle: _id } };
      source = prevSource === "crs" ? "mock" : "mock";
      note = `dispute replay (mock): ${fixed.note}`;
    } else if (provider === "crs") {
      try {
        const pulled = await pullFromCrs(ctx, personaId, options ?? {});
        data = { ...pulled.bundle, raw: pulled.raw };
        source = "crs";
        note = (dispute ? "live CRS sandbox re-pull after dispute (bureau-side correction is out of scope)" : "live CRS sandbox") + ` (${pulled.calls} calls, ${pulled.ms} ms)`;
      } catch (err: any) {
        if (process.env.CRS_STRICT === "1") throw err;
        await ctx.runMutation(internal.audit.log, {
          applicantId,
          actor: "crs",
          action: "crs.error",
          ref: null,
          note: `CRS pull failed, falling back to mock: ${String(err?.message ?? err).slice(0, 300)}`,
        });
        data = mockBundle(personaId);
        note = `fixture fallback after CRS error`;
      }
    } else {
      if (!findPersona(personaId)) throw new Error(`unknown personaId ${personaId}`);
      data = mockBundle(personaId);
      note = "mock provider (CRS sandbox fixture)";
    }

    const { raw, ...bundle } = data;
    await ctx.runMutation(internal.crs.insertBundle, { applicantId, source, ...bundle, raw });
    return { source, bundle, note };
  },
});
