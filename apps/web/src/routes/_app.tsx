import type { DragEndEvent } from "@dnd-kit/dom";
import { DragDropProvider } from "@dnd-kit/react";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppDialogsProvider } from "@/components/app-dialogs";
import { CommandPalette } from "@/components/command-palette";
import { LibraryProvider } from "@/components/library-provider";
import { OfflineBanner } from "@/components/offline-banner";
import { type DragItem, type DropTarget, dragSensors } from "@/lib/drag";
import { useLibrary } from "@/lib/library";
import { useLibraryEdits } from "@/lib/library-edits";
import { itemId, selectedItems } from "@/lib/selection";
import { useEditHistoryShortcuts } from "@/lib/shortcuts";

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ context, location }) => {
    if (!(context.token || context.offlineUserId)) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <LibraryProvider>
      <AppShell />
    </LibraryProvider>
  );
}

function AppShell() {
  const edits = useLibraryEdits();
  const { bookmarks, flatFolders } = useLibrary();
  useEditHistoryShortcuts();

  function fileDroppedItem({ canceled, operation }: DragEndEvent) {
    const item = operation.source?.data as DragItem | undefined;
    const target = operation.target?.data as DropTarget | undefined;
    if (canceled || !item || !target) {
      return;
    }
    // Dragging one of several selected tiles moves them all.
    const selection = selectedItems();
    if (
      selection.length > 1 &&
      selection.some((selected) => itemId(selected) === item.id)
    ) {
      return edits.moveItems(selection, target.folderId);
    }
    if (item.kind === "bookmark") {
      const bookmark = bookmarks.find((entry) => entry._id === item.id);
      return bookmark && edits.moveBookmark(bookmark, target.folderId);
    }
    const folder = flatFolders.find((entry) => entry._id === item.id);
    return folder && edits.moveFolder(folder, target.folderId);
  }

  return (
    <AppDialogsProvider>
      <DragDropProvider onDragEnd={fileDroppedItem} sensors={dragSensors}>
        <div className="flex min-h-svh flex-col">
          <OfflineBanner />
          <Outlet />
        </div>
      </DragDropProvider>
      <CommandPalette />
    </AppDialogsProvider>
  );
}
