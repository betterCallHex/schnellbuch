import { api } from "@schnellbuch/backend/api";
import type { Id } from "@schnellbuch/backend/data-model";
import { useNavigate } from "@tanstack/react-router";

import { useEffect } from "react";
import { toast } from "sonner";
import { succeeded } from "@/lib/errors";
import { looksLikeLink } from "@/lib/link";
import { useOnlineMutation } from "@/lib/offline";

const EDITABLE = "input, textarea, select, [contenteditable='true']";

export function usePasteToSave(folderId: Id<"folders"> | undefined) {
  const addBookmark = useOnlineMutation(api.bookmarks.add);
  useEffect(() => {
    async function savePastedLink(event: ClipboardEvent) {
      const text = event.clipboardData?.getData("text/plain").trim() ?? "";
      if (isEditing(event.target) || !looksLikeLink(text)) {
        return;
      }
      event.preventDefault();
      if (await succeeded(addBookmark({ url: text, folderId }))) {
        toast.success("Bookmark saved");
      }
    }
    document.addEventListener("paste", savePastedLink);
    return () => document.removeEventListener("paste", savePastedLink);
  }, [addBookmark, folderId]);
}

export function useGoUpShortcut(
  parentId: Id<"folders"> | undefined,
  enabled: boolean
) {
  const navigate = useNavigate();
  useEffect(() => {
    function goUp(event: KeyboardEvent) {
      if (
        !enabled ||
        event.key !== "ArrowUp" ||
        !(event.metaKey || event.ctrlKey)
      ) {
        return;
      }
      event.preventDefault();
      navigate({ to: "/", search: { folder: parentId } });
    }
    window.addEventListener("keydown", goUp);
    return () => window.removeEventListener("keydown", goUp);
  }, [navigate, parentId, enabled]);
}

function isEditing(target: EventTarget | null) {
  return target instanceof Element && target.closest(EDITABLE) !== null;
}
