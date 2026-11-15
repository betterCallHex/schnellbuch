import { api } from "@schnellbuch/backend/api";
import type { Id } from "@schnellbuch/backend/data-model";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { CheckIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FolderSelect, TOP_LEVEL } from "@/components/folder-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { errorMessage, succeeded } from "@/lib/errors";
import { useLibrary, useUpdateBookmark } from "@/lib/library";

export const Route = createFileRoute("/add")({
  validateSearch: (search: Record<string, unknown>) => ({
    url: typeof search.url === "string" ? search.url : "",
    title: typeof search.title === "string" ? search.title : undefined,
  }),
  beforeLoad: ({ context, location }) => {
    if (!context.token) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
  },
  component: AddFromBookmarklet,
});

type SaveState =
  | { status: "saving" }
  | { status: "saved"; bookmarkId: Id<"bookmarks"> }
  | { status: "failed"; message: string };

function AddFromBookmarklet() {
  const { url, title } = Route.useSearch();
  const addBookmark = useMutation(api.bookmarks.add);
  const [state, setState] = useState<SaveState>({ status: "saving" });
  const started = useRef(false);

  useEffect(() => {
    // biome-ignore lint/suspicious/noUnnecessaryConditions: React runs effects twice in StrictMode development, and a bookmark must be saved once
    if (started.current) {
      return;
    }
    started.current = true;
    addBookmark({ url, title })
      .then((bookmarkId) => setState({ status: "saved", bookmarkId }))
      .catch((error: unknown) =>
        setState({ status: "failed", message: errorMessage(error) })
      );
  }, [addBookmark, url, title]);

  return (
    <main className="flex min-h-svh flex-col justify-center gap-4 p-6">
      <SaveStatus state={state} title={title ?? url} />
    </main>
  );
}

function SaveStatus({ state, title }: { state: SaveState; title: string }) {
  switch (state.status) {
    case "saving":
      return <p className="text-muted-foreground text-sm">Saving…</p>;
    case "failed":
      return (
        <p className="text-destructive text-sm" role="alert">
          {state.message}
        </p>
      );
    case "saved":
      return <SavedBookmark bookmarkId={state.bookmarkId} title={title} />;
    default:
      return state satisfies never;
  }
}

function SavedBookmark({
  bookmarkId,
  title,
}: {
  bookmarkId: Id<"bookmarks">;
  title: string;
}) {
  const { flatFolders } = useLibrary();
  const updateBookmark = useUpdateBookmark();
  const [folder, setFolder] = useState<string>(TOP_LEVEL);

  function moveTo(value: string) {
    setFolder(value);
    succeeded(
      updateBookmark({
        bookmarkId,
        folderId: value === TOP_LEVEL ? null : (value as Id<"folders">),
      })
    );
  }

  return (
    <>
      <p className="flex items-center gap-2 text-sm font-medium">
        <CheckIcon aria-hidden className="size-4 text-green-600" />
        Saved
      </p>
      <p className="text-muted-foreground truncate text-sm">{title}</p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="add-folder">Folder</Label>
        <FolderSelect
          folders={flatFolders}
          id="add-folder"
          onChange={moveTo}
          value={folder}
        />
      </div>
      <Button autoFocus onClick={() => window.close()}>
        Done
      </Button>
    </>
  );
}
