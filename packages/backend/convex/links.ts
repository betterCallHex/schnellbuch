import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { userMutation } from "./functions";
import { fetchPublic } from "./model/fetching";
import {
  classifyFailure,
  classifyResponse,
  queueLinkChecks,
} from "./model/links";

const CHECK_TIMEOUT_MS = 8000;
const USER_CHECK_LIMIT = 200;
const HTTP_METHOD_NOT_ALLOWED = 405;
const HTTP_NOT_IMPLEMENTED = 501;
const linkStatus = v.union(
  v.literal("ok"),
  v.literal("gone"),
  v.literal("unsure")
);

// The user asks, from the library health page, for their least recently
// checked links to be checked.
export const check = userMutation({
  args: {},
  handler: async (ctx) => {
    const { queued } = await queueLinkChecks(ctx, {
      folderId: undefined,
      limit: USER_CHECK_LIMIT,
    });
    return { queued };
  },
});

export const checkBatch = internalAction({
  args: { userId: v.string(), bookmarkIds: v.array(v.id("bookmarks")) },
  handler: async (ctx, { userId, bookmarkIds }) => {
    const targets = await ctx.runQuery(internal.links.urlsToCheck, {
      userId,
      bookmarkIds,
    });
    const results = await Promise.all(
      targets.map(async ({ bookmarkId, url }) => ({
        bookmarkId,
        url,
        ...(await checkUrl(url)),
      }))
    );
    await ctx.runMutation(internal.links.recordResults, {
      userId,
      results,
    });
  },
});

export const urlsToCheck = internalQuery({
  args: { userId: v.string(), bookmarkIds: v.array(v.id("bookmarks")) },
  handler: async (ctx, { userId, bookmarkIds }) => {
    const found = await Promise.all(bookmarkIds.map((id) => ctx.db.get(id)));
    return found.flatMap((bookmark) =>
      bookmark?.userId === userId
        ? [{ bookmarkId: bookmark._id, url: bookmark.url }]
        : []
    );
  },
});

export const recordResults = internalMutation({
  args: {
    userId: v.string(),
    results: v.array(
      v.object({
        bookmarkId: v.id("bookmarks"),
        url: v.string(),
        status: linkStatus,
        httpStatus: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, { userId, results }) => {
    const checkedAt = Date.now();
    await Promise.all(
      results.map(async ({ bookmarkId, url, status, httpStatus }) => {
        const bookmark = await ctx.db.get(bookmarkId);
        // Skip bookmarks deleted, re-owned or re-pointed since the check.
        if (bookmark?.userId !== userId || bookmark.url !== url) {
          return;
        }
        await ctx.db.patch(bookmarkId, {
          linkCheck: { checkedAt, status, httpStatus },
        });
      })
    );
  },
});

async function checkUrl(url: string) {
  try {
    let { response } = await request(url, "HEAD");
    if (
      response.status === HTTP_METHOD_NOT_ALLOWED ||
      response.status === HTTP_NOT_IMPLEMENTED
    ) {
      await response.body?.cancel();
      ({ response } = await request(url, "GET"));
    }
    await response.body?.cancel();
    return {
      status: classifyResponse(response.status),
      httpStatus: response.status,
    };
  } catch (error) {
    return { status: classifyFailure(error) };
  }
}

function request(url: string, method: "HEAD" | "GET") {
  return fetchPublic(url, {
    method,
    timeoutMs: CHECK_TIMEOUT_MS,
    headers: { "user-agent": "SchnellBuch/1.0 (link check)" },
  });
}
