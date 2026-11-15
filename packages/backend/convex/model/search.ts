import uFuzzy from "@leeoniya/ufuzzy";

const OUT_OF_ORDER_TERMS = 1;
const RANKING_LIMIT = 1000;

const abbreviationMatcher = new uFuzzy({ intraIns: Number.POSITIVE_INFINITY });
const typoMatcher = new uFuzzy({ intraMode: 1 });

export function searchBookmarks<
  Bookmark extends { title: string; url: string },
>(bookmarks: Bookmark[], query: string, limit: number) {
  const needle = query.trim();
  if (!needle) {
    return bookmarks.slice(0, limit);
  }
  const haystack = bookmarks.map(
    (bookmark) => `${bookmark.title} ${bookmark.url}`
  );
  const abbreviationMatches = rank(abbreviationMatcher, haystack, needle);
  const ranked =
    abbreviationMatches.length > 0
      ? abbreviationMatches
      : rank(typoMatcher, haystack, needle);
  return ranked
    .slice(0, limit)
    .map((index) => bookmarks[index])
    .filter((bookmark) => bookmark !== undefined);
}

function rank(matcher: uFuzzy, haystack: string[], needle: string) {
  const [matches, info, order] = matcher.search(
    haystack,
    needle,
    OUT_OF_ORDER_TERMS,
    RANKING_LIMIT
  );
  if (!matches) {
    return [];
  }
  if (!(info && order)) {
    return matches;
  }
  return order
    .map((position) => info.idx[position])
    .filter((index) => index !== undefined);
}
