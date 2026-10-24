// Credit bundle pull with a provider switch.
//   CRS_PROVIDER = "mock" (default) | "crs"
// "crs" targets the CRS (StitchCredit) sandbox. Login happens ONCE and the
// bearer token is cached in the secretsCache table; a failed login is also
// recorded so we never hammer /users/login (repeated failures disable the
// sandbox account).
//
// The prequal / identity / fraud endpoint paths are NOT known until the Postman
// collection arrives. They are env-overridable constants marked TODO below. The
// client refuses to call a TODO path instead of guessing one.
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { BundleData } from "./types";
import { mockBundle, findPersona } from "./crs.mock";
import { credit, identity, fraud, flags } from "./schema";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CRS_BASE_URL = () => (process.env.CRS_BASE_URL ?? "https://api-sandbox.stitchcredit.com/api").replace(/\/$/, "");

// Known from the onboarding email. Relative to CRS_BASE_URL (which already ends in /api).
const CRS_PATH_LOGIN = "/users/login";

// TODO(Swaraj, when the Postman collection lands): fill these three in, or set
// the matching env vars on the deployment (no redeploy needed). Leave as
// "TODO" to make pullBundle refuse the call with a clear error.
const CRS_PATH_PREQUAL = () => process.env.CRS_PATH_PREQUAL ?? "TODO";
const CRS_PATH_IDENTITY = () => process.env.CRS_PATH_IDENTITY ?? "TODO";
const CRS_PATH_FRAUD = () => process.env.CRS_PATH_FRAUD ?? "TODO";
// HTTP method for the three data calls; the sandbox may want POST with a consumer body.
const CRS_DATA_METHOD = () => (process.env.CRS_DATA_METHOD ?? "POST").toUpperCase();

// TODO(Swaraj): how a personaId maps to a sandbox test consumer. The sandbox
// ships fixed test subjects; put their request bodies here (or in env
// CRS_PERSONA_MAP as JSON {"P01": {...}}). Keys are our personaIds.
const CRS_PERSONA_REQUESTS: Record<string, Record<string, unknown>> = {
  // "P01": { firstName: "...", lastName: "...", ssn: "...", dob: "...", address: {...} },
};

const TOKEN_KEY = "crs_token";
const LOGIN_FAILED_KEY = "crs_login_failed_at";
const TOKEN_TTL_MS = 50 * 60 * 1000; // assume ~1h tokens; refresh at 50 min
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
type Ctx = { runQuery: Function; runMutation: Function };

async function crsLoginOnce(ctx: any): Promise<string> {
  const cached: string | null = await ctx.runQuery(internal.crs.getSecret, { key: TOKEN_KEY });
  if (cached) return cached;

  const failedAt: string | null = await ctx.runQuery(internal.crs.getSecret, { key: LOGIN_FAILED_KEY });
  if (failedAt) {
    throw new Error(
      `CRS login failed at ${new Date(Number(failedAt)).toISOString()}; refusing to retry for ${LOGIN_COOLDOWN_MS / 60000} min to protect the sandbox account. Clear secretsCache/${LOGIN_FAILED_KEY} to force.`,
    );
  }

  const username = process.env.CRS_USERNAME;
  const password = process.env.CRS_PASSWORD;
  if (!username || !password) throw new Error("CRS_USERNAME / CRS_PASSWORD not set");

  const res = await fetch(`${CRS_BASE_URL()}${CRS_PATH_LOGIN}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    // Record the failure BEFORE throwing so no other action retries a bad login.
    await ctx.runMutation(internal.crs.setSecret, {
      key: LOGIN_FAILED_KEY,
      value: String(Date.now()),
      ttlMs: LOGIN_COOLDOWN_MS,
    });
    const body = await res.text().catch(() => "");
    throw new Error(`CRS login ${res.status}: ${body.slice(0, 300)}`);
  }
  const json: any = await res.json();
  // TODO(Swaraj): confirm the token field name from the login response (common: token / accessToken / access_token).
  const token: string | undefined = json?.token ?? json?.accessToken ?? json?.access_token ?? json?.jwt;
  if (!token) throw new Error(`CRS login response had no token field: ${JSON.stringify(json).slice(0, 300)}`);
  const ttl = typeof json?.expiresIn === "number" ? Math.max(60_000, json.expiresIn * 1000 - 60_000) : TOKEN_TTL_MS;
  await ctx.runMutation(internal.crs.setSecret, { key: TOKEN_KEY, value: token, ttlMs: ttl });
  return token;
}

async function crsCall(ctx: any, path: string, body: Record<string, unknown>): Promise<unknown> {
  if (path === "TODO") {
    throw new Error("CRS endpoint path not configured (see TODO constants in convex/crs.ts or CRS_PATH_* env vars)");
  }
  const token = await crsLoginOnce(ctx);
  const method = CRS_DATA_METHOD();
  const url = `${CRS_BASE_URL()}${path}`;
  const res = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) {
    // Token expired or revoked. Drop the cache; the NEXT pull will log in once
    // more. We deliberately do not re-login inside this request.
    await ctx.runMutation(internal.crs.clearSecret, { key: TOKEN_KEY });
    throw new Error(`CRS ${method} ${path} returned 401; cached token cleared, will re-login on next pull`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CRS ${method} ${path} ${res.status}: ${text.slice(0, 300)}`);
  }
  return await res.json();
}

/**
 * Normalize CRS responses into the bundle shape from contracts.md.
 * TODO(Swaraj): map the real field names once the Postman collection arrives.
 * Each line below says what we need; the right-hand side is a best-effort read
 * of common shapes and must be checked against a real response.
 */
export function normalizeCrsBundle(prequal: any, identityRes: any, fraudRes: any): BundleData {
  const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
  const scores: any[] = prequal?.scores ?? prequal?.scoreModels ?? [];
  const findScore = (re: RegExp) => {
    const hit = scores.find((s: any) => re.test(String(s?.model ?? s?.name ?? s?.type ?? "")));
    return num(hit?.score ?? hit?.value);
  };
  const trades: any[] = prequal?.tradelines ?? prequal?.trades ?? prequal?.accounts ?? [];
  const inquiries: any[] = prequal?.inquiries ?? [];
  const sixMonthsAgo = Date.now() - 183 * 24 * 3600 * 1000;

  const idFlags: string[] = identityRes?.flags ?? identityRes?.alerts ?? [];
  const fraudSignals: string[] = (fraudRes?.signals ?? fraudRes?.indicators ?? fraudRes?.alerts ?? []).map((s: any) =>
    typeof s === "string" ? s : String(s?.code ?? s?.name ?? JSON.stringify(s)),
  );
  const publicRecords: any[] = prequal?.publicRecords ?? [];
  const hasRecord = (re: RegExp) => publicRecords.some((r: any) => re.test(JSON.stringify(r).toLowerCase()));
  const consumerFlags = JSON.stringify(prequal?.consumerStatements ?? prequal?.alerts ?? "").toLowerCase();

  return {
    credit: {
      fico9: findScore(/fico/i) ?? num(prequal?.fico9) ?? num(prequal?.ficoScore),
      vantage4: findScore(/vantage/i) ?? num(prequal?.vantage4) ?? num(prequal?.vantageScore),
      tradelines: trades.map((t: any) => ({
        type: String(t?.type ?? t?.accountType ?? "unknown"),
        balance: num(t?.balance ?? t?.currentBalance) ?? 0,
        status: String(t?.status ?? t?.paymentStatus ?? "unknown"),
        openedAt: String(t?.openedAt ?? t?.dateOpened ?? ""),
      })),
      inquiries6mo: inquiries.filter((i: any) => {
        const d = Date.parse(i?.date ?? i?.inquiryDate ?? "");
        return Number.isFinite(d) ? d >= sixMonthsAgo : true;
      }).length,
      utilization: num(prequal?.utilization ?? prequal?.revolvingUtilization),
    },
    identity: {
      verified: Boolean(identityRes?.verified ?? identityRes?.passed ?? identityRes?.match === true),
      flags: idFlags.map(String),
    },
    fraud: {
      score: num(fraudRes?.score ?? fraudRes?.riskScore),
      signals: fraudSignals,
    },
    flags: {
      deceased: /deceased/.test(consumerFlags) || Boolean(prequal?.deceased),
      frozen: /frozen|freeze/.test(consumerFlags) || Boolean(prequal?.frozen ?? prequal?.fileFrozen),
      bankruptcy: hasRecord(/bankrupt/) || Boolean(prequal?.bankruptcy),
      eviction: hasRecord(/evict/) || Boolean(prequal?.eviction),
    },
  };
}

async function pullFromCrs(ctx: any, personaId: string): Promise<BundleData & { raw: unknown }> {
  const envMap = process.env.CRS_PERSONA_MAP ? (JSON.parse(process.env.CRS_PERSONA_MAP) as Record<string, any>) : {};
  const consumer = envMap[personaId] ?? CRS_PERSONA_REQUESTS[personaId];
  if (!consumer) throw new Error(`No CRS sandbox consumer mapped for personaId ${personaId} (see CRS_PERSONA_REQUESTS in convex/crs.ts)`);
  const [prequal, identityRes, fraudRes] = await Promise.all([
    crsCall(ctx, CRS_PATH_PREQUAL(), consumer),
    crsCall(ctx, CRS_PATH_IDENTITY(), consumer),
    crsCall(ctx, CRS_PATH_FRAUD(), consumer),
  ]);
  const normalized = normalizeCrsBundle(prequal, identityRes, fraudRes);
  return { ...normalized, raw: { prequal, identity: identityRes, fraud: fraudRes } };
}

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

/** Step 1 of runDesk. Pulls the bundle, stores it, returns it without raw. */
export const pullBundle = internalAction({
  args: { applicantId: v.id("applicants"), personaId: v.string() },
  handler: async (ctx, { applicantId, personaId }): Promise<PullResult> => {
    const provider = (process.env.CRS_PROVIDER ?? "mock").toLowerCase();
    let source: "crs" | "mock" = "mock";
    let note = "";
    let data: BundleData & { raw: unknown };

    if (provider === "crs") {
      try {
        data = await pullFromCrs(ctx, personaId);
        source = "crs";
        note = "live CRS sandbox";
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
        note = `mock fallback after CRS error`;
      }
    } else {
      if (!findPersona(personaId)) throw new Error(`unknown personaId ${personaId}`);
      data = mockBundle(personaId);
      note = "mock provider";
    }

    const { raw, ...bundle } = data;
    await ctx.runMutation(internal.crs.insertBundle, { applicantId, source, ...bundle, raw });
    return { source, bundle, note };
  },
});
