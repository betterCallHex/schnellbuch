import { isEmoji } from "@schnellbuch/backend/folder-style";

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function firstEmoji(text: string) {
  for (const { segment } of graphemes.segment(text)) {
    if (isEmoji(segment)) {
      return segment;
    }
  }
}
