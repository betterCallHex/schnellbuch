import { describe, expect, test as it } from "bun:test";
import { firstEmoji } from "./emoji";

describe("firstEmoji", () => {
  it("keeps a whole emoji, joined sequences and flags included", () => {
    expect(firstEmoji("👩‍💻")).toBe("👩‍💻");
    expect(firstEmoji("🇩🇪")).toBe("🇩🇪");
    expect(firstEmoji("👍🏽")).toBe("👍🏽");
  });

  it("takes the first emoji out of other text", () => {
    expect(firstEmoji("work 🚀 stuff 🔥")).toBe("🚀");
  });

  it("finds nothing in plain text", () => {
    expect(firstEmoji("abc 123")).toBeUndefined();
    expect(firstEmoji("")).toBeUndefined();
  });
});
