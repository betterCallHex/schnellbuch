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
import {
  type LibraryItem,
  putOnClipboard,
  SHORTCUTS,
  shortcutLabel,
} from "@/lib/shortcuts";

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

function ClipboardItems({ item }: { item: LibraryItem }) {
  return (
    <>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => putOnClipboard(item, "cut")}>
        Cut
        <ContextMenuShortcut>
          {shortcutLabel(SHORTCUTS.cut)}
        </ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={() => putOnClipboard(item, "copy")}>
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
  onMove,
}: {
  currentFolderId: Id<"folders"> | undefined;
  blockedIds?: Set<string>;
  onMove: (folderId: Id<"folders"> | null) => void;
}) {
  const { flatFolders } = useLibrary();
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>Move to</ContextMenuSubTrigger>
      <ContextMenuSubContent className="max-h-80 overflow-y-auto">
        <ContextMenuItem
          disabled={currentFolderId === undefined}
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
