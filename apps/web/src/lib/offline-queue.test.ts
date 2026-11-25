import { describe, expect, test as it } from "bun:test";
import type { Doc, Id } from "@schnellbuch/backend/data-model";
import {
  applyEdits,
  checkEdits,
  copyFolderEdits,
  type LibraryData,
  newTempId,
  type QueuedEdit,
  resolveIds,
} from "./offline-queue";

const USER = "user-ada";
const AT = 1_700_000_000_000;

function folder(id: string, name: string, parentId?: string): Doc<"folders"> {
  return {
    _id: id as Id<"folders">,
    _creationTime: 1,
    userId: USER,
    name,
    parentId: parentId as Id<"folders"> | undefined,
  };
}

function bookmark(
  id: string,
  url: string,
  folderId?: string
): Doc<"bookmarks"> {
  return {
    _id: id as Id<"bookmarks">,
    _creationTime: 1,
    userId: USER,
    url,
    title: url,
    folderId: folderId as Id<"folders"> | undefined,
  };
}

const library: LibraryData = {
  folders: [
    folder("dev", "Dev"),
    folder("convex", "Convex", "dev"),
    folder("reading", "Reading"),
  ],
  bookmarks: [
    bookmark("docs", "https://docs.convex.dev/", "convex"),
    bookmark("blog", "https://stack.convex.dev/", "dev"),
  ],
};

const devId = "dev" as Id<"folders">;
const convexId = "convex" as Id<"folders">;
const readingId = "reading" as Id<"folders">;

describe("applyEdits", () => {
  it("shows a bookmark saved offline in its folder, titled by its host until it syncs", () => {
    const id = newTempId<Id<"bookmarks">>();
    const view = applyEdits(
      library,
      [
        {
          kind: "addBookmark",
          id,
          at: AT,
          args: { url: "www.example.com/page", folderId: readingId },
        },
      ],
      USER
    );
    expect(view.bookmarks[0]).toMatchObject({
      _id: id,
      url: "https://www.example.com/page",
      title: "example.com",
      folderId: readingId,
      savedAt: AT,
    });
    expect(view.pendingIds.has(id)).toBe(true);
  });

  it("moves a removed folder's contents up a level, or removes them with it", () => {
    const keepContents = applyEdits(
      library,
      [{ kind: "removeFolder", at: AT, args: { folderId: devId } }],
      USER
    );
    expect(keepContents.folders.map(({ _id }) => _id)).toEqual([
      convexId,
      readingId,
    ]);
    expect(keepContents.folders[0]?.parentId).toBeUndefined();
    expect(
      keepContents.bookmarks.find(({ _id }) => _id === "blog")?.folderId
    ).toBeUndefined();

    const withContents = applyEdits(
      library,
      [{ kind: "removeFolderWithContents", at: AT, args: { folderId: devId } }],
      USER
    );
    expect(withContents.folders.map(({ _id }) => _id)).toEqual([readingId]);
    expect(withContents.bookmarks).toEqual([]);
  });

  it("skips an edit whose bookmark or folder is already gone", () => {
    const view = applyEdits(
      library,
      [
        {
          kind: "updateBookmark",
          at: AT,
          args: { bookmarkId: "gone" as Id<"bookmarks">, title: "Renamed" },
        },
        {
          kind: "updateFolder",
          at: AT,
          args: { folderId: readingId, name: " Later " },
        },
      ],
      USER
    );
    expect(view.bookmarks).toEqual(library.bookmarks);
    expect(view.folders.find(({ _id }) => _id === readingId)?.name).toBe(
      "Later"
    );
    expect([...view.pendingIds]).toEqual([readingId]);
  });

  it("shows tags edited offline the way the server will store them", () => {
    const view = applyEdits(
      library,
      [
        {
          kind: "updateBookmark",
          at: AT,
          args: {
            bookmarkId: "docs" as Id<"bookmarks">,
            tags: ["Reviewed", "to read, reviewed"],
          },
        },
        {
          kind: "updateBookmark",
          at: AT,
          args: { bookmarkId: "blog" as Id<"bookmarks">, tags: [] },
        },
      ],
      USER
    );
    expect(view.bookmarks.map((saved) => saved.tags)).toEqual([
      ["reviewed", "to read"],
      undefined,
    ]);
  });
});

describe("checkEdits", () => {
  it("refuses tags the server would refuse", () => {
    const tooLong: QueuedEdit = {
      kind: "updateBookmark",
      at: AT,
      args: { bookmarkId: "docs" as Id<"bookmarks">, tags: ["x".repeat(41)] },
    };
    expect(() => checkEdits(library, [tooLong], USER)).toThrow(
      "A tag can be at most 40 characters."
    );
  });

  it("refuses what the server would refuse, with the server's words", () => {
    const intoItself: QueuedEdit = {
      kind: "updateFolder",
      at: AT,
      args: { folderId: devId, parentId: convexId },
    };
    const notALink: QueuedEdit = {
      kind: "addBookmark",
      id: newTempId(),
      at: AT,
      args: { url: "not a link" },
    };
    const missingFolder: QueuedEdit = {
      kind: "createFolder",
      id: newTempId(),
      at: AT,
      args: { name: "New", parentId: "gone" as Id<"folders"> },
    };
    expect(() => checkEdits(library, [intoItself], USER)).toThrow(
      "A folder can't move inside itself."
    );
    expect(() => checkEdits(library, [notALink], USER)).toThrow(
      "is not a web link."
    );
    expect(() => checkEdits(library, [missingFolder], USER)).toThrow(
      "Folder not found."
    );
  });

  it("checks each edit against the ones queued before it", () => {
    const folderId = newTempId<Id<"folders">>();
    expect(() =>
      checkEdits(
        library,
        [
          { kind: "createFolder", id: folderId, at: AT, args: { name: "New" } },
          {
            kind: "addBookmark",
            id: newTempId(),
            at: AT,
            args: { url: "https://example.com", folderId },
          },
        ],
        USER
      )
    ).not.toThrow();
  });
});

describe("copyFolderEdits", () => {
  it("copies a folder with everything in it, each parent before its contents", () => {
    const { rootId, edits } = copyFolderEdits(library, { folderId: devId }, AT);
    const view = applyEdits(library, edits, USER);
    const root = view.folders.find(({ _id }) => _id === rootId);
    const child = view.folders.find(({ parentId }) => parentId === rootId);
    expect(root).toMatchObject({ name: "Dev copy", parentId: undefined });
    expect(child?.name).toBe("Convex");
    expect(
      view.bookmarks
        .filter(({ folderId }) => folderId === root?._id)
        .map(({ url }) => url)
    ).toEqual(["https://stack.convex.dev/"]);
    expect(
      view.bookmarks
        .filter(({ folderId }) => folderId === child?._id)
        .map(({ url }) => url)
    ).toEqual(["https://docs.convex.dev/"]);
    expect(view.pendingIds.size).toBe(edits.length);
  });

  it("refuses to copy a folder into itself", () => {
    expect(() =>
      copyFolderEdits(library, { folderId: devId, parentId: convexId }, AT)
    ).toThrow("A folder can't move inside itself.");
  });
});

describe("resolveIds", () => {
  it("swaps IDs made offline for the ones the server gave them", () => {
    const folderId = newTempId<Id<"folders">>();
    expect(
      resolveIds({ folderId, title: "x" }, { [folderId]: "real-folder" })
    ).toEqual({ folderId: "real-folder" as Id<"folders">, title: "x" });
  });

  it("gives up on an ID whose item never reached the server", () => {
    expect(
      resolveIds({ parentId: newTempId<Id<"folders">>() }, {})
    ).toBeUndefined();
  });
});
