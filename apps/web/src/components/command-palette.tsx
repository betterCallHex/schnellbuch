import type { Id } from "@schnellbuch/backend/data-model";
import { searchBookmarks, searchFolders } from "@schnellbuch/backend/search";
import { HotkeysProvider, useHotkey } from "@tanstack/react-hotkeys";
import { useNavigate, useSearch } from "@tanstack/react-router";

import {
  FolderPlusIcon,
  FolderSearchIcon,
  HeartPulseIcon,
  HomeIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { useOpenDialog } from "@/components/app-dialogs";
import { Favicon } from "@/components/favicon";
import { FolderGlyph } from "@/components/folder-glyph";
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
import { type BookmarkEntry, useLibrary } from "@/lib/library";
import { useLibraryEdits } from "@/lib/library-edits";
import { looksLikeLink } from "@/lib/link";
import { SHORTCUTS, shortcutLabel } from "@/lib/shortcuts";
import { displayHost } from "@/lib/views";

const RESULT_LIMIT = 8;

const BOOKMARK_VALUE = "bookmark-";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // The highlighted result, so ⌘↵ can show it in its folder.
  const [highlighted, setHighlighted] = useState("");

  const reveal = useReveal();
  const { bookmarks } = useLibrary();

  useHotkey(SHORTCUTS.palette, () => setOpen(true));

  // ⌘↵ shows the highlighted bookmark in its folder. Handled before cmdk,
  // which would otherwise open it as it does on plain ↵.
  function revealHighlighted(event: KeyboardEvent<HTMLDivElement>) {
    if (!(event.key === "Enter" && (event.metaKey || event.ctrlKey))) {
      return;
    }
    event.preventDefault();
    const bookmark = bookmarks.find(
      (candidate) => `${BOOKMARK_VALUE}${candidate._id}` === highlighted
    );
    if (bookmark) {
      changeOpen(false);
      reveal(bookmark);
    }
  }

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
      {open ? (
        <HotkeysProvider exclusive scope="palette">
          <ClosePaletteShortcut onClose={() => changeOpen(false)} />
        </HotkeysProvider>
      ) : null}
      <Command
        onKeyDown={revealHighlighted}
        onValueChange={setHighlighted}
        shouldFilter={false}
        value={highlighted}
      >
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

function ClosePaletteShortcut({ onClose }: { onClose: () => void }) {
  useHotkey(SHORTCUTS.palette, onClose);
  return null;
}

// Opens a bookmark's folder with the bookmark selected.
function useReveal() {
  const navigate = useNavigate();
  return (bookmark: BookmarkEntry) =>
    navigate({
      to: "/",
      search: { folder: bookmark.folderId, select: bookmark._id },
    });
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
  const edits = useLibraryEdits();
  const reveal = useReveal();
  const { folder: activeFolder } = useSearch({ strict: false });
  const currentFolderId = activeFolder as Id<"folders"> | undefined;
  const needle = query.trim();
  const matchingBookmarks = searchBookmarks(bookmarks, query, RESULT_LIMIT);
  const matchingFolders = searchFolders(flatFolders, query, RESULT_LIMIT);
  const pathById = new Map(
    flatFolders.map((folder) => [folder._id, folder.path])
  );

  async function saveLink() {
    onDone();
    await edits.addBookmark({ url: query, folderId: currentFolderId });
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
              value={`${BOOKMARK_VALUE}${bookmark._id}`}
            >
              <Favicon src={bookmark.faviconUrl} />
              <span className="min-w-0 flex-1 truncate">{bookmark.title}</span>
              <span className="text-muted-foreground max-w-[40%] shrink-0 truncate text-xs">
                {bookmark.folderId
                  ? pathById.get(bookmark.folderId)
                  : displayHost(bookmark.url)}
              </span>
              <button
                aria-label={`Show “${bookmark.title}” in its folder`}
                className="text-muted-foreground hover:text-foreground -my-1 shrink-0 rounded p-1"
                onClick={(event) => {
                  event.stopPropagation();
                  run(() => reveal(bookmark));
                }}
                onPointerDown={(event) => event.stopPropagation()}
                title={`Show in folder (${shortcutLabel(SHORTCUTS.reveal)})`}
                type="button"
              >
                <FolderSearchIcon className="size-4" />
              </button>
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
              <FolderGlyph
                className="h-4 w-5 shrink-0"
                color={folder.color}
                mark={folder.mark}
              />
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
          onSelect={() => run(() => navigate({ to: "/health" }))}
          value="health"
        >
          <HeartPulseIcon />
          Library health
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
