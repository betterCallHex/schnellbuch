const TITLE = /<title[^>]*>(?<title>[^<]*)<\/title>/iu;
const TAG = /<(?<name>meta|link)\b[^>]*>/giu;
const ATTRIBUTE =
  /(?<name>[a-z:-]+)\s*=\s*(?:"(?<double>[^"]*)"|'(?<single>[^']*)')/giu;
const ENTITY = /&(?<code>#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|#39);/giu;
const WHITESPACE_RUN = /\s+/gu;
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

export interface PageMetadata {
  faviconUrl: string;
  title?: string;
}

export function parsePageMetadata(html: string, pageUrl: string): PageMetadata {
  const tags = [...html.matchAll(TAG)].map((match) => ({
    name: match.groups?.name?.toLowerCase(),
    attributes: readAttributes(match[0]),
  }));
  const openGraphTitle = tags.find(
    (tag) => tag.name === "meta" && tag.attributes.property === "og:title"
  )?.attributes.content;
  const iconHref = tags.find(
    (tag) =>
      tag.name === "link" &&
      isIconRel(tag.attributes.rel) &&
      tag.attributes.href
  )?.attributes.href;
  const rawTitle = html.match(TITLE)?.groups?.title ?? openGraphTitle ?? "";
  const title = decodeEntities(rawTitle.replace(WHITESPACE_RUN, " ")).trim();
  return {
    title: title || undefined,
    faviconUrl: iconHref
      ? new URL(iconHref, pageUrl).href
      : defaultFaviconUrl(pageUrl),
  };
}

export function defaultFaviconUrl(pageUrl: string) {
  return new URL("/favicon.ico", pageUrl).href;
}

function isIconRel(rel: string | undefined) {
  return rel?.toLowerCase().split(WHITESPACE_RUN).includes("icon") ?? false;
}

function readAttributes(tag: string) {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(ATTRIBUTE)) {
    const { name, double, single } = match.groups ?? {};
    if (name) {
      attributes[name.toLowerCase()] = decodeEntities(double ?? single ?? "");
    }
  }
  return attributes;
}

function decodeEntities(text: string) {
  return text.replace(ENTITY, (entity, code: string) => {
    const lowered = code.toLowerCase();
    if (lowered === "#39") {
      return "'";
    }
    if (lowered.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(lowered.slice(2), 16));
    }
    if (lowered.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(lowered.slice(1), 10));
    }
    return NAMED_ENTITIES[lowered] ?? entity;
  });
}
