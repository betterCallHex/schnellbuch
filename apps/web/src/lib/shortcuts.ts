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
import { useLibrary } from "@/lib/library";
import {
  EDIT_TOAST,
  liveId,
  redoLastEdit,
  undoLastEdit,
  useLibraryEdits,
} from "@/lib/library-edits";
import { looksLikeLink } from "@/lib/link";
import { itemsLabel, type LibraryItem } from "@/lib/selection";

const EDITABLE = "input, textarea, select, [contenteditable='true']";

export const SHORTCUTS = {
  undo: "Mod+Z",
  redo: "Mod+Shift+Z",
  copy: "Mod+C",
  cut: "Mod+X",
  paste: "Mod+V",
  goUp: "Mod+ArrowUp",
  palette: "Mod+K",
  reveal: "Mod+Enter",
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

export async function putOnClipboard(
  entries: LibraryItem[],
  mode: Clip["mode"]
) {
  if (entries.length === 0) {
    return;
  }
  const items = entries.map(clipboardItem);
  const text = entries.map(clipboardText).join("\n");
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    toast.error("SchnellBuch can't use the clipboard in this browser.");
    return;
  }
  hold({ items, text, mode });
  const paste = shortcutLabel(SHORTCUTS.paste);
  const what = itemsLabel(items);
  toast(mode === "copy" ? `Copied ${what}` : `Cut ${what}`, {
    id: EDIT_TOAST,
    description:
      mode === "copy"
        ? `Press ${paste} in any folder to paste a copy.`
        : `Press ${paste} in another folder to move it there.`,
  });
}

export function usePasteClip(folderId: Id<"folders"> | undefined) {
  const edits = useLibraryEdits();
  const { bookmarks, flatFolders } = useLibrary();

  return async function pasteClip(clip: Clip) {
    const target = folderId ?? null;
    const found = clip.items.map((item): LibraryItem | undefined => {
      if (item.kind === "bookmark") {
        const id = liveId(item.id);
        const bookmark = bookmarks.find((candidate) => candidate._id === id);
        return bookmark && { kind: "bookmark", bookmark };
      }
      const id = liveId(item.id);
      const folder = flatFolders.find((candidate) => candidate._id === id);
      return folder && { kind: "folder", folder };
    });
    const items = found.filter((item) => item !== undefined);
    if (items.length === 0) {
      hold(undefined);
      toast.error(`${itemsLabel(clip.items)} no longer exists.`);
      return false;
    }
    if (clip.mode === "copy") {
      return edits.pasteCopies(items, target);
    }
    const moved = await edits.moveItems(items, target);
    if (moved) {
      hold(undefined);
    }
    return moved;
  };
}

export function usePaste(folderId: Id<"folders"> | undefined) {
  const edits = useLibraryEdits();
  const pasteClip = usePasteClip(folderId);

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
    await edits.addBookmark({ url: text, folderId });
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

function clipboardItem(entry: LibraryItem): ClipboardItem {
  return entry.kind === "folder"
    ? { kind: "folder", id: entry.folder._id, name: entry.folder.name }
    : { kind: "bookmark", id: entry.bookmark._id, name: entry.bookmark.title };
}

function clipboardText(entry: LibraryItem) {
  return entry.kind === "folder" ? entry.folder.name : entry.bookmark.url;
}

function isEditing(target: EventTarget | null) {
  return target instanceof Element && target.closest(EDITABLE) !== null;
}
