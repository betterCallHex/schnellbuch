import type { DragEndEvent } from "@dnd-kit/dom";
import { DragDropProvider } from "@dnd-kit/react";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { MenuIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { AppDialogsProvider } from "@/components/app-dialogs";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { Button } from "@/components/ui/button";
import { type DragItem, type DropTarget, dragSensors } from "@/lib/drag";
import { succeeded } from "@/lib/errors";
import { useUpdateBookmark, useUpdateFolder } from "@/lib/library";

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ context, location }) => {
    if (!context.token) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
        <div className="flex h-svh">
          <aside
            className="bg-sidebar fixed inset-y-0 left-0 z-40 w-64 -translate-x-full border-r transition-transform data-[open=true]:translate-x-0 md:static md:translate-x-0"
            data-open={sidebarOpen}
          >
            <AppSidebar onNavigate={() => setSidebarOpen(false)} />
          </aside>
          {sidebarOpen ? (
            <button
              aria-label="Close folders"
              className="fixed inset-0 z-30 bg-black/40 md:hidden"
              onClick={() => setSidebarOpen(false)}
              type="button"
            />
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center gap-2 border-b px-3 py-2">
              <Button
                aria-label="Show folders"
                className="md:hidden"
                onClick={() => setSidebarOpen(true)}
                size="icon-sm"
                variant="ghost"
              >
                <MenuIcon />
              </Button>
              <span className="font-semibold tracking-tight">SchnellBuch</span>
              <SearchHint />
            </header>
            <main className="flex-1 overflow-y-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </DragDropProvider>
      <CommandPalette />
    </AppDialogsProvider>
  );
}

function SearchHint() {
  function openPalette() {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true })
    );
  }
  return (
    <Button
      className="text-muted-foreground ml-auto gap-2"
      onClick={openPalette}
      size="sm"
      variant="outline"
    >
      <SearchIcon />
      Search
      <kbd className="rounded border px-1 font-sans text-[0.7rem]">⌘K</kbd>
    </Button>
  );
}
