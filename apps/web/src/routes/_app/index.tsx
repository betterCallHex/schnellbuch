import type { Id } from "@schnellbuch/backend/data-model";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import * as z from "zod";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  FinderGrid,
  type GridItem,
  gridItemKey,
} from "@/components/finder-grid";
import { FolderGlyph } from "@/components/folder-glyph";
import { Toolbar } from "@/components/toolbar";
import { type FolderEntry, useLibrary } from "@/lib/library";
import { useSyncedId } from "@/lib/offline-queue-store";
import { optionalText } from "@/lib/search-params";
import { useGoUpShortcut, usePaste } from "@/lib/shortcuts";
import { useViewPrefs } from "@/lib/view-prefs";
import { bookmarksIn, sortBookmarks } from "@/lib/views";

export const Route = createFileRoute("/_app/")({
  // select: a bookmark or folder to show selected, from "Show in folder".
  validateSearch: z.object({ folder: optionalText, select: optionalText }),
  component: BrowsePage,
});

function BrowsePage() {
  const { folder, select } = Route.useSearch();
  const { layout, sort } = useViewPrefs();
  const navigate = Route.useNavigate();
  const requestedId = folder as Id<"folders"> | undefined;
  const syncedFolder = useSyncedId(requestedId) as Id<"folders"> | undefined;
  const folderId = syncedFolder ?? requestedId;
  const { loaded, bookmarks, tree, flatFolders } = useLibrary();
  const current = flatFolders.find((entry) => entry._id === folderId);
  const missing = loaded && folderId !== undefined && current === undefined;
  const trail = folderTrail(flatFolders, current);
  const childFolders = current ? current.children : tree;
  const items: GridItem[] = [
    ...childFolders.map((child) => ({
      kind: "folder" as const,
      folder: child,
      itemCount:
        child.children.length + bookmarksIn(bookmarks, child._id).length,
    })),
    ...sortBookmarks(bookmarksIn(bookmarks, folderId), sort).map(
      (bookmark) => ({
        kind: "bookmark" as const,
        bookmark,
      })
    ),
  ];
  const revealed = select
    ? items.find((item) =>
        item.kind === "folder"
          ? item.folder._id === select
          : item.bookmark._id === select
      )
    : undefined;

  useEffect(() => {
    if (syncedFolder) {
      navigate({ search: { folder: syncedFolder }, replace: true });
    }
  }, [navigate, syncedFolder]);

  usePaste(current?._id);
  useGoUpShortcut(current?.parentId, current !== undefined);

  return (
    <>
      <Toolbar view>
        <Breadcrumbs trail={trail} />
      </Toolbar>
      <main className="flex flex-1 flex-col">
        {missing ? <MissingFolder /> : null}
        {loaded && !missing && items.length === 0 ? <EmptyFolder /> : null}
        {items.length > 0 ? (
          <FinderGrid
            items={items}
            key={`${folderId ?? "top-level"}:${layout}:${select ?? ""}`}
            label={current?.name ?? "Bookmarks"}
            layout={layout}
            revealKey={revealed ? gridItemKey(revealed) : undefined}
          />
        ) : null}
      </main>
    </>
  );
}

function folderTrail(folders: FolderEntry[], current: FolderEntry | undefined) {
  const byId = new Map(folders.map((folder) => [folder._id, folder]));
  const trail: FolderEntry[] = [];
  let cursor = current;
  while (cursor) {
    trail.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return trail;
}

function EmptyFolder() {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-3 px-6 py-24 text-center text-sm">
      <FolderGlyph className="h-16 w-20 opacity-60" />
      <p className="text-foreground font-medium">This folder is empty</p>
      <p>
        Copy a link and press ⌘V here, use ⌘K, or ask your agent to save one.
      </p>
    </div>
  );
}

function MissingFolder() {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-24 text-center text-sm">
      <p className="font-medium">This folder no longer exists.</p>
      <Link
        className="text-meta underline"
        search={{ folder: undefined }}
        to="/"
      >
        Back to Bookmarks
      </Link>
    </div>
  );
}
