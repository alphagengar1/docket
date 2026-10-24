// marketRates: APR bands by credit tier. Seeded with static defaults; the
// optional Apify Actor (design/open.md) would overwrite them with live data.
import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULTS = [
  { tier: "excellent" as const, aprLow: 6.5, aprHigh: 10.5 },
  { tier: "good" as const, aprLow: 10.5, aprHigh: 16.0 },
  { tier: "fair" as const, aprLow: 16.0, aprHigh: 25.0 },
  { tier: "poor" as const, aprLow: 25.0, aprHigh: 36.0 },
];

export const rates = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("marketRates").collect();
  },
});

/** Idempotent: inserts the static bands only when the table is empty. */
export const ensureSeeded = internalMutation({
  args: {},
  handler: async (ctx) => {
    const any = await ctx.db.query("marketRates").first();
    if (any) return false;
    for (const d of DEFAULTS) {
      await ctx.db.insert("marketRates", { ...d, source: "seed:static", fetchedAt: Date.now() });
    }
    return true;
  },
});

export const upsertRate = internalMutation({
  args: {
    tier: v.union(v.literal("excellent"), v.literal("good"), v.literal("fair"), v.literal("poor")),
    aprLow: v.number(),
    aprHigh: v.number(),
    source: v.string(),
  },
  handler: async (ctx, a) => {
    const existing = await ctx.db
      .query("marketRates")
      .withIndex("by_tier", (q) => q.eq("tier", a.tier))
      .first();
    const doc = { ...a, fetchedAt: Date.now() };
    if (existing) await ctx.db.replace(existing._id, doc);
    else await ctx.db.insert("marketRates", doc);
  },
});
