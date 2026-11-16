import { describe, expect, test as it } from "bun:test";
import { chooseLibrary, readMirror, tokenSubject, toMirror } from "./mirror";

const folders = [{ _id: "f1", name: "Dev" }];
const bookmarks = [{ _id: "b1", title: "Bun" }];

describe("mirror", () => {
  it("round-trips through storage as plain data", () => {
    const stored = JSON.parse(
      JSON.stringify(toMirror("ada", folders, bookmarks, 1000))
    );
    expect(readMirror(stored, "ada")).toEqual({
      version: 1,
      userId: "ada",
      savedAt: 1000,
      folders,
      bookmarks,
    });
  });

  it("another user's mirror, an old version or junk is ignored", () => {
    const stored = toMirror("ada", folders, bookmarks, 1000);
    expect(readMirror(stored, "bob")).toBeUndefined();
    expect(readMirror({ ...stored, version: 0 }, "ada")).toBeUndefined();
    expect(readMirror({ ...stored, folders: "x" }, "ada")).toBeUndefined();
    expect(readMirror(null, "ada")).toBeUndefined();
  });
});

describe("chooseLibrary", () => {
  const mirror = toMirror("ada", [{ _id: "old" }], [], 1000);

  it("live data wins, online or not", () => {
    const live = { folders: [{ _id: "new" }], bookmarks: [] };
    expect(chooseLibrary({ live, mirror, offline: true })).toEqual({
      source: "live",
      ...live,
    });
  });

  it("offline without live data shows the mirror", () => {
    expect(chooseLibrary({ live: {}, mirror, offline: true })).toMatchObject({
      source: "mirror",
      folders: [{ _id: "old" }],
      mirroredAt: 1000,
    });
  });

  it("online and still loading never shows stale data", () => {
    expect(chooseLibrary({ live: {}, mirror, offline: false }).source).toBe(
      "loading"
    );
  });

  it("offline with nothing mirrored is loading", () => {
    expect(chooseLibrary({ live: {}, offline: true }).source).toBe("loading");
  });
});

describe("tokenSubject", () => {
  it("reads the user ID from a JWT", () => {
    const payload = btoa(JSON.stringify({ sub: "user_123" }))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
    expect(tokenSubject(`header.${payload}.signature`)).toBe("user_123");
  });

  it("anything else has no subject", () => {
    expect(tokenSubject(null)).toBeUndefined();
    expect(tokenSubject("not-a-jwt")).toBeUndefined();
    expect(tokenSubject("a.%%%.c")).toBeUndefined();
  });
});
