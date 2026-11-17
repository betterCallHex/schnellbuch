import { describe, expect, test as it } from "bun:test";
import type { Id } from "@schnellbuch/backend/data-model";
import { type Clip, claimsPaste } from "./clipboard";

const copiedBookmark: Clip = {
  mode: "copy",
  text: "https://docs.convex.dev",
  items: [
    {
      kind: "bookmark",
      id: "b1" as Id<"bookmarks">,
      name: "Convex docs",
    },
  ],
};

describe("claimsPaste", () => {
  it("claims a paste of exactly what SchnellBuch put on the clipboard", () => {
    expect(claimsPaste(copiedBookmark, "https://docs.convex.dev")).toBe(true);
  });

  it("leaves a paste alone once something else was copied", () => {
    expect(claimsPaste(copiedBookmark, "https://example.com")).toBe(false);
    expect(claimsPaste(undefined, "https://docs.convex.dev")).toBe(false);
  });
});
