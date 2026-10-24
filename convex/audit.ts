// One internal mutation every step uses to append to auditEvents.
// Pipeline-rail convention (web/ reads these): actor "desk" with action
// `step.<pull|guardrails|underwrite|compliance|human>.start|done`.
import { internalMutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { actor } from "./schema";
import type { Id } from "./_generated/dataModel";
import type { Infer } from "convex/values";

export type Actor = Infer<typeof actor>;

export async function writeAudit(
  ctx: MutationCtx,
  args: { applicantId: Id<"applicants">; actor: Actor; action: string; ref?: string | null; note?: string },
) {
  return await ctx.db.insert("auditEvents", {
    applicantId: args.applicantId,
    at: Date.now(),
    actor: args.actor,
    action: args.action,
    ref: args.ref ?? null,
    note: args.note ?? "",
  });
}

export const log = internalMutation({
  args: {
    applicantId: v.id("applicants"),
    actor,
    action: v.string(),
    ref: v.optional(v.union(v.string(), v.null())),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await writeAudit(ctx, args);
  },
});
