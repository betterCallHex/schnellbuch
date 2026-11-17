import { afterEach, describe, expect, test as it, vi } from "vitest";
import { post, session, signIn, signInWith } from "../testing/auth";
import { createTest } from "../testing/convex";
import { components, internal } from "./_generated/api";

type TestClient = ReturnType<typeof createTest>;

const SIX_DIGITS = /^\d{6}$/u;

afterEach(() => {
  vi.useRealTimers();
});

describe("deleting an account", () => {
  it("removes the library, history and agent access, and nobody else's", async () => {
    vi.useFakeTimers();
    const t = createTest();
    const owner = await session(await signIn(t, "owner@example.com"));
    const other = await session(await signIn(t, "kid@family.test"));
    for (const userId of [owner.userId, other.userId]) {
      // biome-ignore lint/performance/noAwaitInLoops: two users, one after the other
      await t.run(async (ctx) => {
        const folderId = await ctx.db.insert("folders", {
          userId,
          name: "Dev",
        });
        await ctx.db.insert("bookmarks", {
          userId,
          url: "https://example.com/",
          title: "Example",
          folderId,
          savedAt: 1,
        });
        await ctx.db.insert("changes", { userId, summary: "x", undo: [] });
      });
      await t.action(internal.mcp.createApiKeyForUser, { userId });
    }

    const response = await post(t, "/api/auth/delete-user", {}, owner.cookie);
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(response.status).toBe(200);
    expect(await countOwned(t, owner.userId)).toEqual({
      bookmarks: 0,
      folders: 0,
      changes: 0,
      connections: 0,
    });
    expect(await countOwned(t, other.userId)).toEqual({
      bookmarks: 1,
      folders: 1,
      changes: 1,
      connections: 1,
    });
  });

  it("needs a sign-in code from the last five minutes", async () => {
    vi.useFakeTimers();
    const t = createTest();
    const owner = await session(await signIn(t, "owner@example.com"));
    vi.advanceTimersByTime(6 * 60 * 1000);

    const stale = await post(t, "/api/auth/delete-user", {}, owner.cookie);
    const fresh = await session(await signIn(t, "owner@example.com"));
    const confirmed = await post(t, "/api/auth/delete-user", {}, fresh.cookie);

    expect(stale.status).toBe(400);
    expect(fresh.userId).toBe(owner.userId);
    expect(confirmed.status).toBe(200);
  });
});

describe("signInCode", () => {
  it("gives the deployment's owner a code that replaces the emailed one", async () => {
    const t = createTest();
    const first = await t.action(internal.account.signInCode, {
      email: "owner@example.com",
    });

    const second = await t.action(internal.account.signInCode, {
      email: "Owner@Example.com",
    });

    expect(second).toMatch(SIX_DIGITS);
    expect((await signInWith(t, "owner@example.com", second)).status).toBe(200);
    expect(first === second).toBe(false);
  });
});

async function countOwned(t: TestClient, userId: string) {
  const counts = await t.run(async (ctx) => ({
    bookmarks: (
      await ctx.db
        .query("bookmarks")
        .withIndex("by_user_folder", (q) => q.eq("userId", userId))
        .collect()
    ).length,
    folders: (
      await ctx.db
        .query("folders")
        .withIndex("by_user_parent", (q) => q.eq("userId", userId))
        .collect()
    ).length,
    changes: (
      await ctx.db
        .query("changes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    ).length,
  }));
  const grants = await t.run((ctx) =>
    ctx.runQuery(components.mcp.grants.list, { userId })
  );
  return { ...counts, connections: grants.length };
}
