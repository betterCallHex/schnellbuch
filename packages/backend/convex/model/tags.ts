import { ConvexError } from "convex/values";

export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;
const TAG_SEPARATOR = ",";
const WHITESPACE_RUN = /\s+/gu;

export function cleanTags(tags: readonly string[]) {
  const cleaned = [...new Set(tags.flatMap(splitTags).map(checkedTag))].sort();
  if (cleaned.length > MAX_TAGS) {
    throw new ConvexError(`A bookmark can have at most ${MAX_TAGS} tags.`);
  }
  return cleaned;
}

export function storedTags(tags: readonly string[]) {
  const cleaned = cleanTags(tags);
  return cleaned.length > 0 ? cleaned : undefined;
}

export function tagsOf(bookmark: { tags?: string[] }) {
  return bookmark.tags ?? [];
}

export function splitTags(text: string) {
  return text.split(TAG_SEPARATOR).map(normalizeTag).filter(Boolean);
}

function normalizeTag(tag: string) {
  return tag.trim().replace(WHITESPACE_RUN, " ").toLowerCase();
}

function checkedTag(tag: string) {
  if (tag.length > MAX_TAG_LENGTH) {
    throw new ConvexError(`A tag can be at most ${MAX_TAG_LENGTH} characters.`);
  }
  return tag;
}
