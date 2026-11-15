/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as bookmarks from "../bookmarks.js";
import type * as env from "../env.js";
import type * as folders from "../folders.js";
import type * as functions from "../functions.js";
import type * as http from "../http.js";
import type * as mcp from "../mcp.js";
import type * as metadata from "../metadata.js";
import type * as model_bookmarks from "../model/bookmarks.js";
import type * as model_folders from "../model/folders.js";
import type * as model_page from "../model/page.js";
import type * as model_search from "../model/search.js";
import type * as model_tokens from "../model/tokens.js";
import type * as model_tree from "../model/tree.js";
import type * as model_url from "../model/url.js";
import type * as tokens from "../tokens.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  bookmarks: typeof bookmarks;
  env: typeof env;
  folders: typeof folders;
  functions: typeof functions;
  http: typeof http;
  mcp: typeof mcp;
  metadata: typeof metadata;
  "model/bookmarks": typeof model_bookmarks;
  "model/folders": typeof model_folders;
  "model/page": typeof model_page;
  "model/search": typeof model_search;
  "model/tokens": typeof model_tokens;
  "model/tree": typeof model_tree;
  "model/url": typeof model_url;
  tokens: typeof tokens;
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
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
