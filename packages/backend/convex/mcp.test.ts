import { describe, expect, test as it } from "vitest";
import { createTest } from "../testing/convex";
import { internal } from "./_generated/api";
import { hashToken, previewToken } from "./model/tokens";

const TOKEN = "sb_test-token";

describe("MCP endpoint", () => {
  it("rejects requests without a valid token", async () => {
    const t = createTest();

    const response = await t.fetch("/mcp", {
      method: "POST",
      headers: { authorization: "Bearer sb_wrong" },
      body: "{}",
    });

    expect(response.status).toBe(401);
  });

  it("an agent files a bookmark into a folder it created", async () => {
    const t = await createTestWithToken();

    const created = await callTool(t, "create_folder", { name: "Reading" });
    const { folderId } = JSON.parse(created.content[0].text);
    await callTool(t, "add_bookmark", {
      url: "https://example.com/essay",
      title: "An essay",
      folderId,
    });
    const listed = await callTool(t, "list_folders", {});

    expect(JSON.parse(listed.content[0].text)).toEqual([
      expect.objectContaining({
        id: folderId,
        path: "Reading",
        bookmarkCount: 1,
      }),
    ]);
  });

  it("search finds bookmarks by a fuzzy title match", async () => {
    const t = await createTestWithToken();
    await callTool(t, "add_bookmark", {
      url: "https://convex.dev",
      title: "Convex backend",
    });
    await callTool(t, "add_bookmark", {
      url: "https://bun.sh",
      title: "Bun runtime",
    });

    const found = await callTool(t, "search_bookmarks", { query: "convx" });

    expect(JSON.parse(found.content[0].text)).toEqual([
      expect.objectContaining({ title: "Convex backend" }),
    ]);
  });

  it("tool errors come back as readable messages", async () => {
    const t = await createTestWithToken();
    const created = await callTool(t, "create_folder", { name: "Dev" });
    const { folderId } = JSON.parse(created.content[0].text);
    const child = await callTool(t, "create_folder", {
      name: "Child",
      parentId: folderId,
    });
    const { folderId: childId } = JSON.parse(child.content[0].text);

    const result = await callTool(t, "update_folder", {
      folderId,
      parentId: childId,
    });

    expect(result).toEqual({
      isError: true,
      content: [{ type: "text", text: "A folder can't move inside itself." }],
    });
  });
});

type TestClient = ReturnType<typeof createTest>;

async function createTestWithToken() {
  const t = createTest();
  await t.mutation(internal.tokens.insert, {
    userId: "owner",
    name: "Test agent",
    tokenHash: await hashToken(TOKEN),
    preview: previewToken(TOKEN),
  });
  return t;
}

async function callTool(
  t: TestClient,
  name: string,
  args: Record<string, unknown>
) {
  const response = await t.fetch("/mcp", {
    method: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const body = await response.json();
  return body.result;
}
