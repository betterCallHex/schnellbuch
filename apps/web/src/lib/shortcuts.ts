import type { Id } from "@schnellbuch/backend/data-model";
import {
  detectPlatform,
  formatForDisplay,
  useHotkey,
} from "@tanstack/react-hotkeys";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useEffectEvent } from "react";
import { toast } from "sonner";
import {
  type Clip,
  type ClipboardItem,
  claimsPaste,
  heldClip,
  hold,
} from "@/lib/clipboard";
import {
  type BookmarkEntry,
  type FolderEntry,
  useLibrary,
} from "@/lib/library";
import {
  EDIT_TOAST,
  liveId,
  redoLastEdit,
  undoLastEdit,
  useLibraryEdits,
} from "@/lib/library-edits";
import { looksLikeLink } from "@/lib/link";

const EDITABLE = "input, textarea, select, [contenteditable='true']";

export const SHORTCUTS = {
  undo: "Mod+Z",
  redo: "Mod+Shift+Z",
  copy: "Mod+C",
  cut: "Mod+X",
  paste: "Mod+V",
  goUp: "Mod+ArrowUp",
  palette: "Mod+K",
} as const;

export function shortcutLabel(
  hotkey: (typeof SHORTCUTS)[keyof typeof SHORTCUTS]
) {
  return formatForDisplay(
    hotkey,
    detectPlatform() === "mac" ? { separatorToken: "" } : {}
  );
}

export function useEditHistoryShortcuts() {
  useHotkey(SHORTCUTS.undo, undoLastEdit, { ignoreInputs: true });
  useHotkey(SHORTCUTS.redo, redoLastEdit, { ignoreInputs: true });
}

export type LibraryItem =
  | { kind: "bookmark"; bookmark: BookmarkEntry }
  | { kind: "folder"; folder: FolderEntry };

export async function putOnClipboard(entry: LibraryItem, mode: Clip["mode"]) {
  const { item, text } = clipboardContent(entry);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    toast.error("SchnellBuch can't use the clipboard in this browser.");
    return;
  }
  hold({ item, text, mode });
  const paste = shortcutLabel(SHORTCUTS.paste);
  toast(mode === "copy" ? `Copied “${item.name}”` : `Cut “${item.name}”`, {
    id: EDIT_TOAST,
    description:
      mode === "copy"
        ? `Press ${paste} in any folder to paste a copy.`
        : `Press ${paste} in another folder to move it there.`,
  });
}

export function usePaste(folderId: Id<"folders"> | undefined) {
  const edits = useLibraryEdits();
  const { bookmarks, flatFolders } = useLibrary();

  function pasteClip(clip: Clip) {
    const target = folderId ?? null;
    if (clip.item.kind === "bookmark") {
      const id = liveId(clip.item.id);
      const bookmark = bookmarks.find((candidate) => candidate._id === id);
      if (!bookmark) {
        return Promise.resolve(gone(clip));
      }
      return clip.mode === "cut"
        ? finishCut(edits.moveBookmark(bookmark, target))
        : edits.pasteBookmarkCopy(bookmark, target);
    }
    const id = liveId(clip.item.id);
    const folder = flatFolders.find((candidate) => candidate._id === id);
    if (!folder) {
      return Promise.resolve(gone(clip));
    }
    return clip.mode === "cut"
      ? finishCut(edits.moveFolder(folder, target))
      : edits.pasteFolderCopy(folder, target);
  }

  const onPaste = useEffectEvent(async (event: ClipboardEvent) => {
    const text = event.clipboardData?.getData("text/plain").trim() ?? "";
    if (isEditing(event.target)) {
      return;
    }
    const clip = heldClip();
    if (clip && claimsPaste(clip, text)) {
      event.preventDefault();
      await pasteClip(clip);
      return;
    }
    if (!looksLikeLink(text)) {
      return;
    }
    event.preventDefault();
    if (await edits.addBookmark({ url: text, folderId })) {
      toast.success("Bookmark saved");
    }
  });

  useEffect(() => {
    const listener = (event: ClipboardEvent) => onPaste(event);
    document.addEventListener("paste", listener);
    return () => document.removeEventListener("paste", listener);
  }, []);
}

export function useGoUpShortcut(
  parentId: Id<"folders"> | undefined,
  enabled: boolean
) {
  const navigate = useNavigate();
  useHotkey(
    SHORTCUTS.goUp,
    () => navigate({ to: "/", search: { folder: parentId } }),
    { enabled }
  );
}

function clipboardContent(entry: LibraryItem): {
  item: ClipboardItem;
  text: string;
} {
  if (entry.kind === "folder") {
    const { _id, name } = entry.folder;
    return { item: { kind: "folder", id: _id, name }, text: name };
  }
  const { _id, title, url } = entry.bookmark;
  return { item: { kind: "bookmark", id: _id, name: title }, text: url };
}

async function finishCut(moved: Promise<boolean>) {
  if (await moved) {
    hold(undefined);
  }
  return moved;
}

function gone(clip: Clip) {
  hold(undefined);
  toast.error(`“${clip.item.name}” no longer exists.`);
  return false;
}

function isEditing(target: EventTarget | null) {
  return target instanceof Element && target.closest(EDITABLE) !== null;
}
