export const PAGE_CHANNEL = "schnellbuch:page";
export const EXTENSION_CHANNEL = "schnellbuch:extension";
export const READ_BOOKMARKS = "read-bookmarks";

export type BookmarksReply = { html: string } | { error: string };

export function isBookmarksRequest(message: unknown) {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === READ_BOOKMARKS
  );
}
