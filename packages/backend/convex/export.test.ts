import { describe, expect, test as it } from "vitest";
import { createTest } from "../testing/convex";
import { api } from "./_generated/api";
import { parseBookmarkFile } from "./model/netscape";

const SAVED = Date.UTC(2019, 6, 4, 12);
const FILE_HEADER = /^<!DOCTYPE NETSCAPE-Bookmark-file-1>/u;

describe("export", () => {
  it("keeps nested folders, top-level bookmarks and saved dates", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    const dev = await owner.mutation(api.folders.create, { name: "Dev" });
    const convex = await owner.mutation(api.folders.create, {
      name: "Convex",
      parentId: dev,
    });
    await owner.mutation(api.bookmarks.add, {
      url: "https://docs.convex.dev",
      title: "Convex docs",
      folderId: convex,
      savedAt: SAVED,
    });
    await owner.mutation(api.bookmarks.add, {
      url: "https://example.com",
      title: "Top level",
    });

    const html = await owner.query(api.bookmarks.exportFile, {});

    expect(html).toMatch(FILE_HEADER);
    expect(html).toContain(
      `<DT><A HREF="https://docs.convex.dev/" ADD_DATE="${SAVED / 1000}">Convex docs</A>`
    );
    const parsed = parseBookmarkFile(html);
    expect(parsed.source).toBe("SchnellBuch");
    expect(parsed.children).toEqual([
      expect.objectContaining({
        kind: "folder",
        title: "Dev",
        children: [
          expect.objectContaining({
            kind: "folder",
            title: "Convex",
            children: [
              {
                kind: "bookmark",
                title: "Convex docs",
                url: "https://docs.convex.dev/",
                addedAt: SAVED,
              },
            ],
          }),
        ],
      }),
      expect.objectContaining({ kind: "bookmark", title: "Top level" }),
    ]);
  });

  it("escapes HTML special characters in titles and links", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    await owner.mutation(api.folders.create, { name: `Tom & "Jerry"` });
    await owner.mutation(api.bookmarks.add, {
      url: "https://example.com/?a=1&b=<2>",
      title: `<script>alert('x')</script>`,
    });

    const html = await owner.query(api.bookmarks.exportFile, {});

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(html).toContain("Tom &amp; &quot;Jerry&quot;");
    const [folder, bookmark] = parseBookmarkFile(html).children;
    expect(folder?.title).toBe(`Tom & "Jerry"`);
    expect(bookmark).toMatchObject({
      title: `<script>alert('x')</script>`,
      url: "https://example.com/?a=1&b=%3C2%3E",
    });
  });

  it("an empty library exports a valid empty file", async () => {
    const t = createTest();

    const html = await t
      .withIdentity({ subject: "owner" })
      .query(api.bookmarks.exportFile, {});

    expect(parseBookmarkFile(html).children).toEqual([]);
  });

  it("another user's folders and bookmarks never appear", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    await owner.mutation(api.folders.create, { name: "Private" });
    await owner.mutation(api.bookmarks.add, {
      url: "https://secret.example.com",
      title: "Secret",
    });

    const html = await t
      .withIdentity({ subject: "intruder" })
      .query(api.bookmarks.exportFile, {});

    expect(html).not.toContain("Private");
    expect(html).not.toContain("secret.example.com");
  });

  it("needs a signed-in user", async () => {
    const t = createTest();

    await expect(t.query(api.bookmarks.exportFile, {})).rejects.toThrow(
      "Sign in to continue."
    );
  });
});
