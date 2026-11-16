const WWW_PREFIX = /^www\./u;
const TRAILING_SLASHES = /\/+$/u;
const DEFAULT_INDEX = /\/(?:index|default)\.(?:html?|php|aspx?)$/iu;
// Tracking parameters that don't change which page a link opens.
const TRACKING_PARAMETER =
  /^(?:utm_\w+|fbclid|gclid|dclid|msclkid|mc_[ce]id|ref|ref_src|igshid|si)$/iu;

// Two links that open the same page get the same key: scheme, `www.`,
// fragments, tracking parameters, parameter order, a trailing slash and
// `index.html` don't matter.
export function samePageKey(url: string) {
  const parsed = URL.parse(url);
  if (!parsed) {
    return url;
  }
  const host = parsed.hostname.toLowerCase().replace(WWW_PREFIX, "");
  const path = parsed.pathname
    .replace(DEFAULT_INDEX, "/")
    .replace(TRAILING_SLASHES, "");
  const parameters = [...parsed.searchParams]
    .filter(([name]) => !TRACKING_PARAMETER.test(name))
    .toSorted(([first], [second]) => first.localeCompare(second));
  const query = new URLSearchParams(parameters).toString();
  const port = parsed.port ? `:${parsed.port}` : "";
  return `${host}${port}${path}${query ? `?${query}` : ""}`;
}

// Groups of two or more links that open the same page, biggest group first.
export function findDuplicateGroups<Bookmark extends { url: string }>(
  bookmarks: Bookmark[]
) {
  return [...Map.groupBy(bookmarks, (bookmark) => samePageKey(bookmark.url))]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, bookmarks: group }))
    .toSorted(
      (first, second) => second.bookmarks.length - first.bookmarks.length
    );
}
