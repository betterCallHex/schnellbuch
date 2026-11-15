const SCHEME = /^https?:\/\//iu;
const WHITESPACE = /\s/u;
const DOMAIN = /^[^/]+\.[a-z]{2,}/iu;

export function looksLikeLink(text: string) {
  const trimmed = text.trim();
  if (!trimmed || WHITESPACE.test(trimmed)) {
    return false;
  }
  return SCHEME.test(trimmed) || DOMAIN.test(trimmed);
}
