// The judge's deck. Never exposes the expected outcome.
import { query } from "./_generated/server";
import { listPersonaSummaries } from "./crs.mock";

export const deck = query({
  args: {},
  handler: async () => listPersonaSummaries(),
});

/** Alias of `deck` (task spec name). */
export const listPersonas = query({
  args: {},
  handler: async () => listPersonaSummaries(),
});
