import { describe, expect, test as it } from "vitest";
import { createTest } from "../testing/convex";
import { api } from "./_generated/api";
import { mcp } from "./mcp";

type TestClient = ReturnType<typeof createTest>;

describe("MCP server", () => {
  it("has no risky tool setups", () => {
    expect(mcp.lint()).toEqual([]);
  });

  it("rejects requests without credentials and points to sign-in", async () => {
    const t = createTest();

    const response = await t.fetch("/mcp", {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain(
      "oauth-protected-resource/mcp"
    );
  });

  it("an agent files a bookmark into a folder it created, and the UI sees it", async () => {
    const t = createTest();
    const owner = await connectAgent(t, "owner");

    const folder = await owner.call("create_folder", { name: "Reading" });
    const saved = await owner.call("add_bookmark", {
      url: "https://example.com/essay",
      title: "An essay",
      folderId: folder.structuredContent.id,
    });

    expect(saved.structuredContent).toMatchObject({
      title: "An essay",
      folderPath: "Reading",
    });
    const listed = await owner.call("list_folders");
    expect(listed.structuredContent.folders).toEqual([
      expect.objectContaining({ path: "Reading", bookmarkCount: 1 }),
    ]);
    const inApp = await t
      .withIdentity({ subject: "owner" })
      .query(api.bookmarks.list, {});
    expect(inApp.map((bookmark) => bookmark.title)).toEqual(["An essay"]);
  });

  it("search finds bookmarks by abbreviation", async () => {
    const t = createTest();
    const owner = await connectAgent(t, "owner");
    await owner.call("add_bookmark", {
      url: "https://docs.convex.dev",
      title: "Convex Developer Hub",
    });
    await owner.call("add_bookmark", {
      url: "https://bun.sh",
      title: "Bun runtime",
    });

    const found = await owner.call("search_bookmarks", { query: "cnvx hub" });

    expect(found.structuredContent.bookmarks).toEqual([
      expect.objectContaining({ title: "Convex Developer Hub" }),
    ]);
  });

  it("list_bookmarks is newest saved first and reports each saved date", async () => {
    const t = createTest();
    const owner = await connectAgent(t, "owner");
    await t.run((ctx) =>
      ctx.db.insert("bookmarks", {
        userId: "owner",
        url: "https://example.com/old",
        title: "Imported long ago",
        savedAt: Date.UTC(2012, 4, 1),
      })
    );
    await owner.call("add_bookmark", {
      url: "https://example.com/new",
      title: "Saved today",
    });

    const listed = await owner.call("list_bookmarks");

    expect(listed.structuredContent.bookmarks).toEqual([
      expect.objectContaining({ title: "Saved today" }),
      expect.objectContaining({
        title: "Imported long ago",
        savedAt: "2012-05-01T00:00:00.000Z",
      }),
    ]);
  });

  it("a malformed ID gets a message the model can act on", async () => {
    const t = createTest();
    const owner = await connectAgent(t, "owner");

    const result = await owner.call("update_folder", {
      folderId: "nope",
      name: "x",
    });

    expect(result).toMatchObject({
      isError: true,
      content: [
        {
          type: "text",
          text: "No folder with id nope. Call list_folders to see folder IDs.",
        },
      ],
    });
  });

  it("another user's folder and bookmark are invisible to an agent", async () => {
    const t = createTest();
    const owner = await connectAgent(t, "owner");
    const intruder = await connectAgent(t, "intruder");
    const folder = await owner.call("create_folder", { name: "Private" });
    const bookmark = await owner.call("add_bookmark", {
      url: "https://example.com",
      title: "Secret",
    });

    const rename = await intruder.call("update_folder", {
      folderId: folder.structuredContent.id,
      name: "Mine",
    });
    const remove = await intruder.call("delete_bookmark", {
      bookmarkId: bookmark.structuredContent.id,
    });
    const listed = await intruder.call("list_bookmarks");

    expect(rename.content[0].text).toBe("Folder not found.");
    expect(remove.content[0].text).toBe("Bookmark not found.");
    expect(listed.structuredContent.bookmarks).toEqual([]);
  });

  it("a read-only connection can read but not write", async () => {
    const t = createTest();
    const reader = await connectAgent(t, "owner", ["bookmarks:read"]);

    const read = await reader.request("list_folders");
    const write = await reader.request("create_folder", { name: "Nope" });

    expect(read.status).toBe(200);
    expect(write.status).toBe(403);
  });

  it("a disconnected agent loses access", async () => {
    const t = createTest();
    const owner = await connectAgent(t, "owner");
    const asOwner = t.withIdentity({ subject: "owner" });
    const [connection] = await asOwner.query(api.mcp.listConnections, {});

    await asOwner.mutation(api.mcp.revokeConnection, {
      id: connection?.id ?? "",
    });

    expect((await owner.request("list_folders")).status).toBe(401);
  });
});

async function connectAgent(t: TestClient, subject: string, scopes?: string[]) {
  const { apiKey } = await t
    .withIdentity({ subject })
    .action(api.mcp.createApiKey, { name: "test", scopes });
  const request = (name: string, args: Record<string, unknown> = {}) =>
    t.fetch("/mcp", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "mcp-protocol-version": "2025-06-18",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const body = await (await request(name, args)).json();
    return body.result;
  };
  return { request, call };
}
