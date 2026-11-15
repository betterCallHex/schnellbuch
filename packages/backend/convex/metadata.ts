import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import {
  defaultFaviconUrl,
  type PageMetadata,
  parsePageMetadata,
} from "./model/page";
import { placeholderTitle } from "./model/url";

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_LENGTH = 500_000;

export const fetchMetadata = internalAction({
  // keepTitle: the title came from the user or an import; only fill the icon.
  args: { bookmarkId: v.id("bookmarks"), keepTitle: v.optional(v.boolean()) },
  handler: async (ctx, { bookmarkId, keepTitle }) => {
    const bookmark = await ctx.runQuery(internal.metadata.getBookmark, {
      bookmarkId,
    });
    if (!bookmark) {
      return;
    }
    const metadata = await readPage(bookmark.url);
    await ctx.runMutation(internal.metadata.applyMetadata, {
      bookmarkId,
      url: bookmark.url,
      faviconUrl: metadata.faviconUrl,
      title: keepTitle ? undefined : metadata.title,
    });
  },
});

export const getBookmark = internalQuery({
  args: { bookmarkId: v.id("bookmarks") },
  handler: (ctx, { bookmarkId }) => ctx.db.get(bookmarkId),
});

export const applyMetadata = internalMutation({
  args: {
    bookmarkId: v.id("bookmarks"),
    url: v.string(),
    title: v.optional(v.string()),
    faviconUrl: v.string(),
  },
  handler: async (ctx, { bookmarkId, url, title, faviconUrl }) => {
    const bookmark = await ctx.db.get(bookmarkId);
    if (!bookmark || bookmark.url !== url) {
      return;
    }
    const keepsPlaceholderTitle = bookmark.title === placeholderTitle(url);
    await ctx.db.patch(bookmarkId, {
      faviconUrl,
      ...(title && keepsPlaceholderTitle ? { title } : {}),
    });
  },
});

async function readPage(url: string): Promise<PageMetadata> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: "text/html", "user-agent": "SchnellBuch/1.0" },
    });
    const isHtml = response.headers.get("content-type")?.includes("text/html");
    if (!(response.ok && isHtml)) {
      return { faviconUrl: defaultFaviconUrl(response.url || url) };
    }
    const html = (await response.text()).slice(0, MAX_HTML_LENGTH);
    return parsePageMetadata(html, response.url || url);
  } catch {
    return { faviconUrl: defaultFaviconUrl(url) };
  }
}
