import { describe, expect, test as it } from "bun:test";
import { parseViewPrefs } from "./view-prefs";

describe("parseViewPrefs", () => {
  it("reads a stored choice", () => {
    expect(parseViewPrefs('{"layout":"list","sort":"name"}')).toEqual({
      layout: "list",
      sort: "name",
    });
  });

  it("falls back to icons, newest first, for anything else", () => {
    const defaults = { layout: "grid", sort: "saved" } as const;
    expect(parseViewPrefs(null)).toEqual(defaults);
    expect(parseViewPrefs("not json")).toEqual(defaults);
    expect(parseViewPrefs('{"layout":"tiles","sort":7}')).toEqual(defaults);
  });
});
