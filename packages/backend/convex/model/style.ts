import { ConvexError, type Infer, v } from "convex/values";

export const FOLDER_COLORS = [
  "blue",
  "graphite",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "purple",
  "pink",
] as const;

export const FOLDER_SYMBOLS = [
  "star",
  "heart",
  "bookmark",
  "book",
  "newspaper",
  "code",
  "briefcase",
  "graduation-cap",
  "lightbulb",
  "palette",
  "music",
  "film",
  "camera",
  "gamepad",
  "shopping-cart",
  "wallet",
  "plane",
  "house",
  "utensils",
  "coffee",
  "dumbbell",
  "leaf",
  "globe",
  "rocket",
  "wrench",
  "flask",
  "lock",
] as const;

export const DEFAULT_FOLDER_COLOR = "blue";

export const folderColor = v.union(
  ...FOLDER_COLORS.map((color) => v.literal(color))
);

export const folderMark = v.union(
  v.object({ kind: v.literal("emoji"), emoji: v.string() }),
  v.object({
    kind: v.literal("symbol"),
    symbol: v.union(...FOLDER_SYMBOLS.map((symbol) => v.literal(symbol))),
  })
);

export type FolderColor = Infer<typeof folderColor>;
export type FolderMark = Infer<typeof folderMark>;
export type FolderSymbol = (typeof FOLDER_SYMBOLS)[number];

const MAX_EMOJI_LENGTH = 16;
const PICTOGRAPH = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const WHITESPACE = /\s/u;

export function cleanFolderMark(mark: FolderMark): FolderMark {
  if (mark.kind === "symbol") {
    return mark;
  }
  const emoji = mark.emoji.trim();
  if (!isEmoji(emoji)) {
    throw new ConvexError("Pick an emoji for the folder.");
  }
  return { kind: "emoji", emoji };
}

export function isEmoji(text: string) {
  return (
    text.length > 0 &&
    text.length <= MAX_EMOJI_LENGTH &&
    PICTOGRAPH.test(text) &&
    !WHITESPACE.test(text)
  );
}
