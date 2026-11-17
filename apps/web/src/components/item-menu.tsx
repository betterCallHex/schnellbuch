import type { Id } from "@schnellbuch/backend/data-model";
import { flattenFolderTree } from "@schnellbuch/backend/tree";
import { useOpenDialog } from "@/components/app-dialogs";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
  type BookmarkEntry,
  type FolderEntry,
  useLibrary,
} from "@/lib/library";
import { useLibraryEdits } from "@/lib/library-edits";
import { itemsLabel, type LibraryItem } from "@/lib/selection";
import { putOnClipboard, SHORTCUTS, shortcutLabel } from "@/lib/shortcuts";

export function BookmarkMenu({
  bookmark,
  onOpen,
}: {
  bookmark: BookmarkEntry;
  onOpen: () => void;
}) {
  const openDialog = useOpenDialog();
  const edits = useLibraryEdits();

  return (
    <ContextMenuContent className="w-52">
      <ContextMenuItem onClick={onOpen}>
        Open in new tab
        <ContextMenuShortcut>↵</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => openDialog({ kind: "edit-bookmark", bookmark })}
      >
        Edit…
      </ContextMenuItem>
      <MoveToMenu
        currentFolderId={bookmark.folderId}
        onMove={(folderId) => edits.moveBookmark(bookmark, folderId)}
      />
      <ClipboardItems item={{ kind: "bookmark", bookmark }} />
      <ContextMenuItem
        onClick={() => edits.deleteBookmark(bookmark)}
        variant="destructive"
      >
        Delete
        <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  );
}

export function FolderMenu({
  folder,
  onOpen,
}: {
  folder: FolderEntry;
  onOpen: () => void;
}) {
  const openDialog = useOpenDialog();
  const edits = useLibraryEdits();
  const blockedIds = new Set(
    flattenFolderTree([folder]).map((entry) => entry._id)
  );

  return (
    <ContextMenuContent className="w-52">
      <ContextMenuItem onClick={onOpen}>
        Open
        <ContextMenuShortcut>↵</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => openDialog({ kind: "new-folder", parentId: folder._id })}
      >
        New folder inside
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => openDialog({ kind: "rename-folder", folder })}
      >
        Rename…
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => openDialog({ kind: "customize-folder", folder })}
      >
        Customize…
      </ContextMenuItem>
      <MoveToMenu
        blockedIds={blockedIds}
        currentFolderId={folder.parentId}
        onMove={(parentId) => edits.moveFolder(folder, parentId)}
      />
      <ClipboardItems item={{ kind: "folder", folder }} />
      <ContextMenuItem
        onClick={() => openDialog({ kind: "delete-folder", folder })}
        variant="destructive"
      >
        Delete…
        <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  );
}

// The menu of a tile that's one of several selected: it acts on them all.
export function SelectionMenu({ items }: { items: LibraryItem[] }) {
  const openDialog = useOpenDialog();
  const edits = useLibraryEdits();
  const label = itemsLabel(
    items.map((item) => ({
      name: item.kind === "folder" ? item.folder.name : item.bookmark.title,
    }))
  );
  const folders = items.flatMap((item) =>
    item.kind === "folder" ? [item.folder] : []
  );
  const blockedIds = new Set(
    flattenFolderTree(folders).map((entry) => entry._id)
  );

  return (
    <ContextMenuContent className="w-52">
      <MoveToMenu
        blockedIds={blockedIds}
        label={`Move ${label} to`}
        onMove={(folderId) => edits.moveItems(items, folderId)}
      />
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => putOnClipboard(items, "cut")}>
        Cut {label}
        <ContextMenuShortcut>
          {shortcutLabel(SHORTCUTS.cut)}
        </ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={() => putOnClipboard(items, "copy")}>
        Copy {label}
        <ContextMenuShortcut>
          {shortcutLabel(SHORTCUTS.copy)}
        </ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={() =>
          folders.length > 0
            ? openDialog({ kind: "delete-items", items })
            : edits.deleteItems(items)
        }
        variant="destructive"
      >
        Delete {label}
        <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  );
}

function ClipboardItems({ item }: { item: LibraryItem }) {
  return (
    <>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => putOnClipboard([item], "cut")}>
        Cut
        <ContextMenuShortcut>
          {shortcutLabel(SHORTCUTS.cut)}
        </ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={() => putOnClipboard([item], "copy")}>
        Copy
        <ContextMenuShortcut>
          {shortcutLabel(SHORTCUTS.copy)}
        </ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSeparator />
    </>
  );
}

function MoveToMenu({
  currentFolderId,
  blockedIds,
  label = "Move to",
  onMove,
}: {
  currentFolderId?: Id<"folders">;
  blockedIds?: Set<string>;
  label?: string;
  onMove: (folderId: Id<"folders"> | null) => void;
}) {
  const { flatFolders } = useLibrary();
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>{label}</ContextMenuSubTrigger>
      <ContextMenuSubContent className="max-h-80 overflow-y-auto">
        <ContextMenuItem
          disabled={label === "Move to" && currentFolderId === undefined}
          onClick={() => onMove(null)}
        >
          Bookmarks
        </ContextMenuItem>
        {flatFolders.map((folder) => (
          <ContextMenuItem
            disabled={
              folder._id === currentFolderId || blockedIds?.has(folder._id)
            }
            key={folder._id}
            onClick={() => onMove(folder._id)}
            style={{ paddingLeft: `${20 + folder.depth * 12}px` }}
          >
            {folder.name}
          </ContextMenuItem>
        ))}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}
