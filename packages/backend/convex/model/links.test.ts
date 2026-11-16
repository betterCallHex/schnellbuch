import { describe, expect, test as it } from "vitest";
import { classifyFailure, classifyResponse } from "./links";

describe("link status", () => {
  it("404 and 410 are gone, 2xx and 3xx fine, other errors unsure", () => {
    expect([200, 301, 404, 410, 403, 429, 503].map(classifyResponse)).toEqual([
      "ok",
      "ok",
      "gone",
      "gone",
      "unsure",
      "unsure",
      "unsure",
    ]);
  });

  it("a timeout is unsure, a dead domain is gone", () => {
    expect(classifyFailure(new DOMException("slow", "TimeoutError"))).toBe(
      "unsure"
    );
    expect(classifyFailure(new TypeError("fetch failed"))).toBe("gone");
  });
});
