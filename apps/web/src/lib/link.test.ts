import { describe, expect, test as it } from "bun:test";
import { looksLikeLink } from "./link";

describe("looksLikeLink", () => {
  it("recognises links with or without a scheme", () => {
    expect(looksLikeLink("https://bun.sh/docs")).toBe(true);
    expect(looksLikeLink("github.com/callmedeci")).toBe(true);
  });

  it("ignores search words", () => {
    expect(looksLikeLink("convex docs")).toBe(false);
    expect(looksLikeLink("react")).toBe(false);
    expect(looksLikeLink("v1.2")).toBe(false);
  });
});
