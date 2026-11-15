import { api } from "@schnellbuch/backend/api";
import type { Id } from "@schnellbuch/backend/data-model";
import { searchBookmarks } from "@schnellbuch/backend/search";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
  FolderIcon,
  FolderPlusIcon,
  HomeIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useOpenDialog } from "@/components/app-dialogs";
import { Favicon } from "@/components/favicon";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { succeeded } from "@/lib/errors";
import { useLibrary } from "@/lib/library";
import { looksLikeLink } from "@/lib/link";
import { displayHost } from "@/lib/views";

const RESULT_LIMIT = 8;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function toggleOnShortcut(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((wasOpen) => !wasOpen);
      }
    }
    window.addEventListener("keydown", toggleOnShortcut);
    return () => window.removeEventListener("keydown", toggleOnShortcut);
  }, []);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
    }
  }

  return (
    <CommandDialog
      description="Search bookmarks and folders, or paste a link to save it."
      onOpenChange={changeOpen}
      open={open}
      title="Search SchnellBuch"
    >
      <Command shouldFilter={false}>
        <CommandInput
          onValueChange={setQuery}
          placeholder="Search or paste a link…"
          value={query}
        />
        {open ? (
          <PaletteResults onDone={() => changeOpen(false)} query={query} />
        ) : null}
      </Command>
    </CommandDialog>
  );
}

function PaletteResults({
  query,
  onDone,
}: {
  query: string;
  onDone: () => void;
}) {
  const { bookmarks, flatFolders } = useLibrary();
  const navigate = useNavigate();
  const openDialog = useOpenDialog();
  const addBookmark = useMutation(api.bookmarks.add);
  const { folder: activeFolder } = useSearch({ strict: false });
  const currentFolderId = activeFolder as Id<"folders"> | undefined;
  const needle = query.trim().toLowerCase();
  const matchingBookmarks = searchBookmarks(bookmarks, query, RESULT_LIMIT);
  const matchingFolders = flatFolders
    .filter((folder) => folder.path.toLowerCase().includes(needle))
    .slice(0, RESULT_LIMIT);
  const pathById = new Map(
    flatFolders.map((folder) => [folder._id, folder.path])
  );

  async function saveLink() {
    onDone();
    if (
      await succeeded(addBookmark({ url: query, folderId: currentFolderId }))
    ) {
      toast.success("Bookmark saved");
    }
  }

  function run(action: () => void) {
    onDone();
    action();
  }

  return (
    <CommandList>
      <CommandEmpty>Nothing matches “{query}”.</CommandEmpty>
      {looksLikeLink(query) && (
        <CommandGroup heading="Save">
          <CommandItem onSelect={saveLink} value="save-link">
            <PlusIcon />
            <span className="truncate">Save {query.trim()}</span>
            <CommandShortcut>↵</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      )}
      {matchingBookmarks.length > 0 && (
        <CommandGroup heading={needle ? "Bookmarks" : "Recent bookmarks"}>
          {matchingBookmarks.map((bookmark) => (
            <CommandItem
              key={bookmark._id}
              onSelect={() =>
                run(() =>
                  window.open(bookmark.url, "_blank", "noopener,noreferrer")
                )
              }
              value={`bookmark-${bookmark._id}`}
            >
              <Favicon src={bookmark.faviconUrl} />
              <span className="truncate">{bookmark.title}</span>
              <span className="text-muted-foreground ml-auto truncate text-xs">
                {bookmark.folderId
                  ? pathById.get(bookmark.folderId)
                  : displayHost(bookmark.url)}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {matchingFolders.length > 0 && (
        <CommandGroup heading="Folders">
          {matchingFolders.map((folder) => (
            <CommandItem
              key={folder._id}
              onSelect={() =>
                run(() => navigate({ to: "/", search: { folder: folder._id } }))
              }
              value={`folder-${folder._id}`}
            >
              <FolderIcon />
              <span className="truncate">{folder.path}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      <CommandGroup heading="Actions">
        <CommandItem
          onSelect={() =>
            run(() =>
              openDialog({ kind: "add-bookmark", folderId: currentFolderId })
            )
          }
          value="add-bookmark"
        >
          <PlusIcon />
          Add bookmark
        </CommandItem>
        <CommandItem
          onSelect={() =>
            run(() =>
              openDialog({ kind: "new-folder", parentId: currentFolderId })
            )
          }
          value="new-folder"
        >
          <FolderPlusIcon />
          New folder
        </CommandItem>
        <CommandItem
          onSelect={() =>
            run(() => navigate({ to: "/", search: { folder: undefined } }))
          }
          value="top-level"
        >
          <HomeIcon />
          Go to Bookmarks
        </CommandItem>
        <CommandItem
          onSelect={() => run(() => navigate({ to: "/settings" }))}
          value="settings"
        >
          <SettingsIcon />
          Settings
        </CommandItem>
      </CommandGroup>
    </CommandList>
  );
}
