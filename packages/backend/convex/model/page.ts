import { decodeEntities, readAttributes } from "./html";

const TITLE = /<title[^>]*>(?<title>[^<]*)<\/title>/iu;
const TAG = /<(?<name>meta|link)\b[^>]*>/giu;
const WHITESPACE_RUN = /\s+/gu;

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
