import type { Id } from "@schnellbuch/backend/data-model";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as z from "zod";
import { FolderSelect, TOP_LEVEL } from "@/components/folder-select";
import { LibraryProvider } from "@/components/library-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { errorMessage, succeeded } from "@/lib/errors";
import { recallFolder, rememberFolder } from "@/lib/last-folder";
import { useLibrary, useLibraryMutations } from "@/lib/library";
import { isTempId } from "@/lib/offline-queue";
import { optionalText } from "@/lib/search-params";
import { findSaved } from "@/lib/views";

export const Route = createFileRoute("/add")({
  validateSearch: z.object({
    url: z.string().catch(""),
    title: optionalText,
  }),
  beforeLoad: ({ context, location }) => {
    if (!(context.token || context.offlineUserId)) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
  },
  component: AddFromBookmarklet,
});

function AddFromBookmarklet() {
  return (
    <LibraryProvider>
      <SaveFromBookmarklet />
    </LibraryProvider>
  );
}

type SaveState =
  | { status: "saving" }
  | {
      status: "saved" | "existing";
      bookmarkId: Id<"bookmarks">;
      folderId: Id<"folders"> | undefined;
    }
  | { status: "failed"; message: string };

const FOLDER_GONE = "Folder not found.";

function SaveFromBookmarklet() {
  const { url, title } = Route.useSearch();
  const { addBookmark } = useLibraryMutations();
  const { loaded, bookmarks } = useLibrary();
  const [state, setState] = useState<SaveState>({ status: "saving" });
  const started = useRef(false);

  useEffect(() => {
    // biome-ignore lint/suspicious/noUnnecessaryConditions: React runs effects twice in StrictMode development, and a bookmark must be saved once
    if (started.current || !loaded) {
      return;
    }
    started.current = true;
    // Saved before: offer moving that one instead of saving it twice.
    const existing = findSaved(bookmarks, url);
    if (existing) {
      setState({
        status: "existing",
        bookmarkId: existing._id,
        folderId: existing.folderId,
      });
      return;
    }
    const remembered = recallFolder() as Id<"folders"> | undefined;
    const save = async () => {
      try {
        return {
          bookmarkId: await addBookmark({ url, title, folderId: remembered }),
          folderId: remembered,
        };
      } catch (error) {
        // The remembered folder was deleted since: save at the top level.
        if (remembered && errorMessage(error) === FOLDER_GONE) {
          rememberFolder(undefined);
          return {
            bookmarkId: await addBookmark({ url, title }),
            folderId: undefined,
          };
        }
        throw error;
      }
    };
    save()
      .then((saved) => setState({ status: "saved", ...saved }))
      .catch((error: unknown) =>
        setState({ status: "failed", message: errorMessage(error) })
      );
  }, [addBookmark, url, title, loaded, bookmarks]);

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
    case "existing":
      return (
        <SavedBookmark
          bookmarkId={state.bookmarkId}
          existing={state.status === "existing"}
          initialFolder={state.folderId}
          title={title}
        />
      );
    default:
      return state satisfies never;
  }
}

function SavedBookmark({
  bookmarkId,
  existing,
  initialFolder,
  title,
}: {
  bookmarkId: Id<"bookmarks">;
  existing: boolean;
  initialFolder: Id<"folders"> | undefined;
  title: string;
}) {
  const { flatFolders } = useLibrary();
  const { updateBookmark } = useLibraryMutations();
  const [folder, setFolder] = useState<string>(initialFolder ?? TOP_LEVEL);

  function moveTo(value: string) {
    setFolder(value);
    rememberFolder(value === TOP_LEVEL ? undefined : value);
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
        {savedLabel(bookmarkId, existing)}
      </p>
      {isTempId(bookmarkId) ? (
        <p className="text-muted-foreground text-sm">
          You're offline. It syncs when you're back online.
        </p>
      ) : null}
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

function savedLabel(bookmarkId: Id<"bookmarks">, existing: boolean) {
  if (existing) {
    return "Already saved";
  }
  return isTempId(bookmarkId) ? "Saved on this device" : "Saved";
}
