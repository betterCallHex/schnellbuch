import { afterEach, describe, expect, test as it, vi } from "vitest";
import { createTest } from "../testing/convex";
import { components, internal } from "./_generated/api";

type TestClient = ReturnType<typeof createTest>;

const PASSWORD = "correct horse battery";

afterEach(() => {
  vi.useRealTimers();
});

describe("deleting an account", () => {
  it("removes the library, history and agent access, and nobody else's", async () => {
    vi.useFakeTimers();
    const t = createTest();
    const owner = await signUp(t, "owner@example.com");
    const other = await signUp(t, "kid@family.test");
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

    const response = await post(
      t,
      "/api/auth/delete-user",
      { password: PASSWORD },
      owner.cookie
    );
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
    expect((await signIn(t, "owner@example.com", PASSWORD)).status).not.toBe(
      200
    );
  });

  it("needs the account's password", async () => {
    const t = createTest();
    const owner = await signUp(t, "owner@example.com");

    const response = await post(
      t,
      "/api/auth/delete-user",
      { password: "not the password" },
      owner.cookie
    );

    expect(response.status).not.toBe(200);
    expect((await signIn(t, "owner@example.com", PASSWORD)).status).toBe(200);
  });
});

describe("setPassword", () => {
  it("lets the deployment's owner reset a forgotten password", async () => {
    const t = createTest();
    await signUp(t, "owner@example.com");

    await t.action(internal.account.setPassword, {
      email: "Owner@Example.com",
      password: "a brand new passphrase",
    });

    expect((await signIn(t, "owner@example.com", PASSWORD)).status).toBe(401);
    expect(
      (await signIn(t, "owner@example.com", "a brand new passphrase")).status
    ).toBe(200);
  });

  it("refuses an unknown address or a short password", async () => {
    const t = createTest();
    await signUp(t, "owner@example.com");

    await expect(
      t.action(internal.account.setPassword, {
        email: "nobody@example.com",
        password: "a brand new passphrase",
      })
    ).rejects.toThrow("No account for nobody@example.com.");
    await expect(
      t.action(internal.account.setPassword, {
        email: "owner@example.com",
        password: "short",
      })
    ).rejects.toThrow("A password needs");
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

async function signUp(t: TestClient, email: string) {
  const response = await post(t, "/api/auth/sign-up/email", {
    email,
    password: PASSWORD,
    name: "Test",
  });
  const { user } = (await response.json()) as { user: { id: string } };
  const cookie = response.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");
  return { userId: user.id, cookie };
}

function signIn(t: TestClient, email: string, password: string) {
  return post(t, "/api/auth/sign-in/email", { email, password });
}

function post(t: TestClient, path: string, body: unknown, cookie?: string) {
  return t.fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}
