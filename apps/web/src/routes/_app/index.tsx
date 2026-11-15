import { createFileRoute } from "@tanstack/react-router";
import { BookmarkIcon, PlusIcon } from "lucide-react";
import { useOpenDialog } from "@/components/app-dialogs";
import { BookmarkRow } from "@/components/bookmark-row";
import { Button } from "@/components/ui/button";
import { useLibrary } from "@/lib/library";
import { bookmarksInView, parseView, type View } from "@/lib/views";

export const Route = createFileRoute("/_app/")({
  validateSearch: (search: Record<string, unknown>) => ({
    folder: typeof search.folder === "string" ? search.folder : undefined,
  }),
  component: BookmarksPage,
});

function BookmarksPage() {
  const { folder } = Route.useSearch();
  const view = parseView(folder);
  const { loaded, bookmarks, flatFolders } = useLibrary();
  const openDialog = useOpenDialog();
  const pathById = new Map(flatFolders.map((entry) => [entry._id, entry.path]));
  const currentFolder =
    view.kind === "folder"
      ? flatFolders.find((entry) => entry._id === view.folderId)
      : undefined;
  const visible = bookmarksInView(bookmarks, view);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <h1 className="min-w-0 flex-1 truncate py-1 text-lg font-semibold">
          {heading(view, currentFolder?.path)}
        </h1>
        <Button
          onClick={() =>
            openDialog({ kind: "add-bookmark", folderId: currentFolder?._id })
          }
          size="sm"
        >
          <PlusIcon />
          Add bookmark
        </Button>
      </div>
      {loaded && visible.length === 0 && <EmptyState />}
      <ul className="flex flex-col">
        {visible.map((bookmark) => (
          <BookmarkRow
            bookmark={bookmark}
            folderPath={
              view.kind === "all" && bookmark.folderId
                ? pathById.get(bookmark.folderId)
                : undefined
            }
            folders={flatFolders}
            key={bookmark._id}
          />
        ))}
      </ul>
    </div>
  );
}

function heading(view: View, folderPath: string | undefined) {
  switch (view.kind) {
    case "all":
      return "All bookmarks";
    case "unsorted":
      return "Unsorted";
    case "folder":
      return folderPath ?? "Folder not found";
    default:
      return view satisfies never;
  }
}

function EmptyState() {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center text-sm">
      <BookmarkIcon aria-hidden className="size-6" />
      <p>No bookmarks here yet.</p>
      <p>
        Paste a link into ⌘K, use the bookmarklet, or ask your agent to save
        one.
      </p>
    </div>
  );
}
