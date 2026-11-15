const WWW_PREFIX = /^www\./u;

export function bookmarksIn<Bookmark extends { folderId?: string }>(
  bookmarks: Bookmark[],
  folderId: string | undefined
) {
  return bookmarks.filter((bookmark) => bookmark.folderId === folderId);
}

export function displayHost(url: string) {
  return URL.parse(url)?.hostname.replace(WWW_PREFIX, "") ?? url;
}
