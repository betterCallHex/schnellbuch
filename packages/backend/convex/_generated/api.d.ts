/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as agent from "../agent.js";
import type * as auth from "../auth.js";
import type * as bookmarks from "../bookmarks.js";
import type * as changes from "../changes.js";
import type * as crons from "../crons.js";
import type * as email from "../email.js";
import type * as env from "../env.js";
import type * as folders from "../folders.js";
import type * as functions from "../functions.js";
import type * as housekeeping from "../housekeeping.js";
import type * as http from "../http.js";
import type * as imports from "../imports.js";
import type * as links from "../links.js";
import type * as mcp from "../mcp.js";
import type * as metadata from "../metadata.js";
import type * as migrations from "../migrations.js";
import type * as model_backup from "../model/backup.js";
import type * as model_bookmarks from "../model/bookmarks.js";
import type * as model_changes from "../model/changes.js";
import type * as model_describe from "../model/describe.js";
import type * as model_duplicates from "../model/duplicates.js";
import type * as model_email from "../model/email.js";
import type * as model_env from "../model/env.js";
import type * as model_fetching from "../model/fetching.js";
import type * as model_folders from "../model/folders.js";
import type * as model_html from "../model/html.js";
import type * as model_import from "../model/import.js";
import type * as model_limits from "../model/limits.js";
import type * as model_links from "../model/links.js";
import type * as model_netscape from "../model/netscape.js";
import type * as model_page from "../model/page.js";
import type * as model_pool from "../model/pool.js";
import type * as model_search from "../model/search.js";
import type * as model_style from "../model/style.js";
import type * as model_tags from "../model/tags.js";
import type * as model_tree from "../model/tree.js";
import type * as model_url from "../model/url.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  agent: typeof agent;
  auth: typeof auth;
  bookmarks: typeof bookmarks;
  changes: typeof changes;
  crons: typeof crons;
  email: typeof email;
  env: typeof env;
  folders: typeof folders;
  functions: typeof functions;
  housekeeping: typeof housekeeping;
  http: typeof http;
  imports: typeof imports;
  links: typeof links;
  mcp: typeof mcp;
  metadata: typeof metadata;
  migrations: typeof migrations;
  "model/backup": typeof model_backup;
  "model/bookmarks": typeof model_bookmarks;
  "model/changes": typeof model_changes;
  "model/describe": typeof model_describe;
  "model/duplicates": typeof model_duplicates;
  "model/email": typeof model_email;
  "model/env": typeof model_env;
  "model/fetching": typeof model_fetching;
  "model/folders": typeof model_folders;
  "model/html": typeof model_html;
  "model/import": typeof model_import;
  "model/limits": typeof model_limits;
  "model/links": typeof model_links;
  "model/netscape": typeof model_netscape;
  "model/page": typeof model_page;
  "model/pool": typeof model_pool;
  "model/search": typeof model_search;
  "model/style": typeof model_style;
  "model/tags": typeof model_tags;
  "model/tree": typeof model_tree;
  "model/url": typeof model_url;
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
  mcp: import("@convex-dev/mcp/_generated/component.js").ComponentApi<"mcp">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  fetchPool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"fetchPool">;
};
