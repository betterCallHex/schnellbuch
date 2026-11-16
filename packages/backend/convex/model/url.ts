import { ConvexError } from "convex/values";

const SCHEME = /^[a-z][a-z\d+.-]*:/iu;
const WWW_PREFIX = /^www\./u;
const WEB_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_URL_LENGTH = 4096;

export function normalizeUrl(input: string) {
  const trimmed = input.trim();
  if (trimmed.length > MAX_URL_LENGTH) {
    throw new ConvexError(
      `A link can be at most ${MAX_URL_LENGTH} characters.`
    );
  }
  const candidate = SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = URL.parse(candidate);
  if (!(url && WEB_PROTOCOLS.has(url.protocol) && url.hostname.includes("."))) {
    throw new ConvexError(`"${input}" is not a web link.`);
  }
  return url.href;
}

export function placeholderTitle(url: string) {
  return new URL(url).hostname.replace(WWW_PREFIX, "");
}
