/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents from "../agents.js";
import type * as audit from "../audit.js";
import type * as classify from "../classify.js";
import type * as crons from "../crons.js";
import type * as crs from "../crs.js";
import type * as desk from "../desk.js";
import type * as eval from "../eval.js";
import type * as evalScore from "../evalScore.js";
import type * as http from "../http.js";
import type * as market from "../market.js";
import type * as personas from "../personas.js";
import type * as pii from "../pii.js";
import type * as policies from "../policies.js";
import type * as rules from "../rules.js";
import type * as stub from "../stub.js";
import type * as types from "../types.js";
import type * as verify from "../verify.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  audit: typeof audit;
  classify: typeof classify;
  crons: typeof crons;
  crs: typeof crs;
  desk: typeof desk;
  eval: typeof eval;
  evalScore: typeof evalScore;
  http: typeof http;
  market: typeof market;
  personas: typeof personas;
  pii: typeof pii;
  policies: typeof policies;
  rules: typeof rules;
  stub: typeof stub;
  types: typeof types;
  verify: typeof verify;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
};
