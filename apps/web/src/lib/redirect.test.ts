import { describe, expect, test as it } from "bun:test";
import { safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
  it("keeps same-site paths", () => {
    expect(safeRedirectPath("/add?url=https%3A%2F%2Fbun.sh")).toBe(
      "/add?url=https%3A%2F%2Fbun.sh"
    );
  });

  it("sends other sites and missing paths home", () => {
    expect(safeRedirectPath("https://evil.example")).toBe("/");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath(undefined)).toBe("/");
  });
});
