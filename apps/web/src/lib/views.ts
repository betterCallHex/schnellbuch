import { normalizeUrl } from "@schnellbuch/backend/url";

const WWW_PREFIX = /^www\./u;

export type SortOrder = "name" | "saved";

export function bookmarksIn<Bookmark extends { folderId?: string }>(
  bookmarks: Bookmark[],
  folderId: string | undefined
) {
  return bookmarks.filter((bookmark) => bookmark.folderId === folderId);
}

export function displayHost(url: string) {
  return URL.parse(url)?.hostname.replace(WWW_PREFIX, "") ?? url;
}

// The bookmark already saved under this link, the way the backend would
// store it. Imports and agents skip such links; so does saving by hand.
export function findSaved<Bookmark extends { url: string }>(
  bookmarks: Bookmark[],
  url: string
) {
  let normalized: string;
  try {
    normalized = normalizeUrl(url);
  } catch {
    return;
  }
  return bookmarks.find((bookmark) => bookmark.url === normalized);
}

// Bookmarks come newest first; "name" sorts them by title instead.
export function sortBookmarks<Bookmark extends { title: string }>(
  bookmarks: Bookmark[],
  order: SortOrder
) {
  return order === "name"
    ? bookmarks.toSorted((first, second) =>
        first.title.localeCompare(second.title, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      )
    : bookmarks;
}
