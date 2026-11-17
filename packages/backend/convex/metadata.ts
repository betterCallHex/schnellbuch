import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { MAX_TITLE_LENGTH } from "./model/bookmarks";
import { fetchPublic, readTextUpTo } from "./model/fetching";
import {
  defaultFaviconUrl,
  type PageMetadata,
  parsePageMetadata,
} from "./model/page";
import { placeholderTitle } from "./model/url";

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 500_000;
// Pages fetched at once inside one batch.
const CONCURRENT_FETCHES = 8;

interface Target {
  bookmarkId: Id<"bookmarks">;
  needsTitle: boolean;
  url: string;
}

// Fills in titles and icons for a batch of bookmarks, then writes them all
// in one mutation, so open tabs get one update per batch rather than one
// per bookmark. Bookmarks that only need an icon share one page fetch per
// site.
export const fetchBatch = internalAction({
  args: { bookmarkIds: v.array(v.id("bookmarks")) },
  handler: async (ctx, { bookmarkIds }) => {
    const targets = await ctx.runQuery(internal.metadata.targets, {
      bookmarkIds,
    });
    const pages = await readPages(pagesToFetch(targets));
    await ctx.runMutation(internal.metadata.applyMetadata, {
      results: targets.map(({ bookmarkId, url, needsTitle }) => {
        const page = pages.get(needsTitle ? url : siteOf(url));
        return {
          bookmarkId,
          url,
          faviconUrl: page?.faviconUrl ?? defaultFaviconUrl(url),
          title: needsTitle
            ? page?.title?.slice(0, MAX_TITLE_LENGTH)
            : undefined,
        };
      }),
    });
  },
});

export const targets = internalQuery({
  args: { bookmarkIds: v.array(v.id("bookmarks")) },
  handler: async (ctx, { bookmarkIds }): Promise<Target[]> => {
    const found = await Promise.all(bookmarkIds.map((id) => ctx.db.get(id)));
    return found.flatMap((bookmark) =>
      bookmark && !bookmark.urlFromAgent
        ? [
            {
              bookmarkId: bookmark._id,
              url: bookmark.url,
              needsTitle: bookmark.title === placeholderTitle(bookmark.url),
            },
          ]
        : []
    );
  },
});

export const applyMetadata = internalMutation({
  args: {
    results: v.array(
      v.object({
        bookmarkId: v.id("bookmarks"),
        url: v.string(),
        title: v.optional(v.string()),
        faviconUrl: v.string(),
      })
    ),
  },
  handler: async (ctx, { results }) => {
    await Promise.all(
      results.map(async ({ bookmarkId, url, title, faviconUrl }) => {
        const bookmark = await ctx.db.get(bookmarkId);
        // Skip bookmarks deleted or pointed elsewhere since the fetch.
        if (!bookmark || bookmark.url !== url) {
          return;
        }
        const keepsPlaceholderTitle = bookmark.title === placeholderTitle(url);
        await ctx.db.patch(bookmarkId, {
          faviconUrl,
          ...(title && keepsPlaceholderTitle ? { title } : {}),
        });
      })
    );
  },
});

// Pages to fetch, keyed by what they answer: a bookmark's own URL when it
// needs a title, otherwise one page per site for the icon.
function pagesToFetch(wanted: Target[]) {
  const pages = new Map<string, string>();
  for (const { url, needsTitle } of wanted) {
    const key = needsTitle ? url : siteOf(url);
    if (!pages.has(key)) {
      pages.set(key, url);
    }
  }
  return pages;
}

function siteOf(url: string) {
  return new URL(url).origin;
}

async function readPages(pages: Map<string, string>) {
  const queue = [...pages];
  const results = new Map<string, PageMetadata>();
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [key, url] = next;
      // biome-ignore lint/performance/noAwaitInLoops: each worker fetches one page at a time; several workers run together
      results.set(key, await readPage(url));
    }
  };
  await Promise.all(Array.from({ length: CONCURRENT_FETCHES }, worker));
  return results;
}

async function readPage(url: string): Promise<PageMetadata> {
  try {
    const { response, url: finalUrl } = await fetchPublic(url, {
      timeoutMs: FETCH_TIMEOUT_MS,
      headers: { accept: "text/html", "user-agent": "SchnellBuch/1.0" },
    });
    const isHtml = response.headers.get("content-type")?.includes("text/html");
    if (!(response.ok && isHtml)) {
      await response.body?.cancel();
      return { faviconUrl: defaultFaviconUrl(finalUrl) };
    }
    const html = await readTextUpTo(response, MAX_HTML_BYTES);
    return parsePageMetadata(html, finalUrl);
  } catch {
    return { faviconUrl: defaultFaviconUrl(url) };
  }
}
