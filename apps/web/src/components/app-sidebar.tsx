import { useDraggable, useDroppable } from "@dnd-kit/react";
import type { Id } from "@schnellbuch/backend/data-model";
import { Link, useSearch } from "@tanstack/react-router";
import {
  ChevronRightIcon,
  FolderIcon,
  FolderPlusIcon,
  InboxIcon,
  LibraryIcon,
  LogOutIcon,
  MoreHorizontalIcon,
  SettingsIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useOpenDialog } from "@/components/app-dialogs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import {
  type DragItem,
  type DropTarget,
  dragItemId,
  dropTargetId,
} from "@/lib/drag";
import { type FolderEntry, useLibrary } from "@/lib/library";
import { UNSORTED } from "@/lib/views";

export function AppSidebar({ onNavigate }: { onNavigate: () => void }) {
  const { tree, bookmarks } = useLibrary();
  const openDialog = useOpenDialog();
  const { folder: activeFolder } = useSearch({ strict: false });
  const countByFolder = Map.groupBy(
    bookmarks,
    (bookmark) => bookmark.folderId ?? UNSORTED
  );

  async function signOut() {
    await authClient.signOut();
    window.location.assign("/sign-in");
  }

  return (
    <nav
      aria-label="Folders"
      className="flex h-full flex-col gap-1 p-2 text-sm"
    >
      <div className="flex">
        <SidebarLink
          active={activeFolder === undefined}
          count={bookmarks.length}
          onNavigate={onNavigate}
        >
          <LibraryIcon aria-hidden className="size-4" />
          All bookmarks
        </SidebarLink>
      </div>
      <DropZone target={{ folderId: null }}>
        <SidebarLink
          active={activeFolder === UNSORTED}
          count={countByFolder.get(UNSORTED)?.length ?? 0}
          folder={UNSORTED}
          onNavigate={onNavigate}
        >
          <InboxIcon aria-hidden className="size-4" />
          Unsorted
        </SidebarLink>
      </DropZone>
      <div className="mt-4 flex items-center justify-between pr-1 pl-2">
        <span className="text-muted-foreground text-xs font-medium">
          Folders
        </span>
        <Button
          aria-label="New folder"
          onClick={() => openDialog({ kind: "new-folder" })}
          size="icon-xs"
          variant="ghost"
        >
          <FolderPlusIcon />
        </Button>
      </div>
      <ul className="flex flex-col gap-0.5">
        {tree.map((node) => (
          <FolderItem
            activeFolder={activeFolder}
            countByFolder={countByFolder}
            key={node._id}
            node={node}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
      {tree.length === 0 && (
        <p className="text-muted-foreground px-2 py-1 text-xs">
          No folders yet.
        </p>
      )}
      <div className="mt-auto flex flex-col gap-0.5 border-t pt-2">
        <Link
          className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5"
          onClick={onNavigate}
          to="/settings"
        >
          <SettingsIcon aria-hidden className="size-4" />
          Settings
        </Link>
        <button
          className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-left"
          onClick={signOut}
          type="button"
        >
          <LogOutIcon aria-hidden className="size-4" />
          Sign out
        </button>
      </div>
    </nav>
  );
}

function SidebarLink({
  active,
  count,
  folder,
  onNavigate,
  children,
}: {
  active: boolean;
  count: number;
  folder?: string;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      className="hover:bg-muted data-[active=true]:bg-muted flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 data-[active=true]:font-medium"
      data-active={active}
      draggable={false}
      onClick={onNavigate}
      search={{ folder }}
      to="/"
    >
      {children}
      <span className="text-muted-foreground ml-auto text-xs tabular-nums">
        {count}
      </span>
    </Link>
  );
}

function DropZone({
  target,
  children,
}: {
  target: DropTarget;
  children: ReactNode;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: dropTargetId(target),
    data: target,
  });
  return (
    <div
      className="data-[over=true]:bg-primary/10 data-[over=true]:ring-primary/40 flex rounded-md data-[over=true]:ring-2"
      data-over={isDropTarget}
      ref={ref}
    >
      {children}
    </div>
  );
}

function FolderItem({
  node,
  activeFolder,
  countByFolder,
  onNavigate,
}: {
  node: FolderEntry;
  activeFolder: string | undefined;
  countByFolder: Map<string, unknown[]>;
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const item: DragItem = { kind: "folder", id: node._id };
  const { ref, isDragging } = useDraggable({
    id: dragItemId(item),
    data: item,
  });
  const hasChildren = node.children.length > 0;

  return (
    // biome-ignore lint/a11y/noRedundantRoles: dnd-kit gives draggable elements without an explicit role role="button", which would nest the row's link and menu inside a button
    <li
      className="data-[dragging=true]:opacity-50"
      data-dragging={isDragging}
      ref={ref}
      role="listitem"
    >
      <DropZone target={{ folderId: node._id }}>
        <div className="group flex min-w-0 flex-1 items-center">
          <button
            aria-expanded={expanded}
            aria-label={
              expanded ? `Collapse ${node.name}` : `Expand ${node.name}`
            }
            className="text-muted-foreground hover:bg-muted flex size-6 shrink-0 items-center justify-center rounded data-[empty=true]:invisible"
            data-empty={!hasChildren}
            onClick={() => setExpanded(!expanded)}
            style={{ marginLeft: `${node.depth * 12}px` }}
            type="button"
          >
            <ChevronRightIcon
              className="size-3.5 transition-transform data-[open=true]:rotate-90"
              data-open={expanded}
            />
          </button>
          <SidebarLink
            active={activeFolder === node._id}
            count={countByFolder.get(node._id)?.length ?? 0}
            folder={node._id}
            onNavigate={onNavigate}
          >
            <FolderIcon aria-hidden className="size-4 shrink-0" />
            <span className="truncate py-0.5">{node.name}</span>
          </SidebarLink>
          <FolderMenu folder={node} />
        </div>
      </DropZone>
      {expanded && hasChildren ? (
        <ul className="flex flex-col gap-0.5">
          {node.children.map((child) => (
            <FolderItem
              activeFolder={activeFolder}
              countByFolder={countByFolder}
              key={child._id}
              node={child}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function FolderMenu({ folder }: { folder: FolderEntry }) {
  const openDialog = useOpenDialog();
  const parentId: Id<"folders"> = folder._id;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`${folder.name} options`}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
            size="icon-xs"
            variant="ghost"
          />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onClick={() => openDialog({ kind: "new-folder", parentId })}
        >
          New subfolder
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => openDialog({ kind: "rename-folder", folder })}
        >
          Rename
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => openDialog({ kind: "delete-folder", folder })}
          variant="destructive"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
