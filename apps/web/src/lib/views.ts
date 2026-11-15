export const UNSORTED = "unsorted";

const WWW_PREFIX = /^www\./u;

export type View =
  | { kind: "all" }
  | { kind: "unsorted" }
  | { kind: "folder"; folderId: string };

export function parseView(folder: string | undefined): View {
  if (!folder) {
    return { kind: "all" };
  }
  if (folder === UNSORTED) {
    return { kind: "unsorted" };
  }
  return { kind: "folder", folderId: folder };
}

export function bookmarksInView<Bookmark extends { folderId?: string }>(
  bookmarks: Bookmark[],
  view: View
) {
  switch (view.kind) {
    case "all":
      return bookmarks;
    case "unsorted":
      return bookmarks.filter((bookmark) => !bookmark.folderId);
    case "folder":
      return bookmarks.filter(
        (bookmark) => bookmark.folderId === view.folderId
      );
    default:
      return view satisfies never;
  }
}

export function displayHost(url: string) {
  return URL.parse(url)?.hostname.replace(WWW_PREFIX, "") ?? url;
}
