import type { DragEndEvent } from "@dnd-kit/dom";
import { DragDropProvider } from "@dnd-kit/react";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppDialogsProvider } from "@/components/app-dialogs";
import { CommandPalette } from "@/components/command-palette";
import { LibraryProvider } from "@/components/library-provider";
import { OfflineBanner } from "@/components/offline-banner";
import { type DragItem, type DropTarget, dragSensors } from "@/lib/drag";
import { succeeded } from "@/lib/errors";
import { useUpdateBookmark, useUpdateFolder } from "@/lib/library";

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
  const updateBookmark = useUpdateBookmark();
  const updateFolder = useUpdateFolder();

  function fileDroppedItem({ canceled, operation }: DragEndEvent) {
    const item = operation.source?.data as DragItem | undefined;
    const target = operation.target?.data as DropTarget | undefined;
    if (canceled || !item || !target) {
      return;
    }
    if (item.kind === "bookmark") {
      succeeded(
        updateBookmark({ bookmarkId: item.id, folderId: target.folderId })
      );
    } else if (item.id !== target.folderId) {
      succeeded(updateFolder({ folderId: item.id, parentId: target.folderId }));
    }
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
