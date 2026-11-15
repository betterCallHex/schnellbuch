import { useDraggable } from "@dnd-kit/react";
import type { Id } from "@schnellbuch/backend/data-model";
import { MoreHorizontalIcon } from "lucide-react";
import { toast } from "sonner";
import { useOpenDialog } from "@/components/app-dialogs";
import { Favicon } from "@/components/favicon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type DragItem, dragItemId } from "@/lib/drag";
import { succeeded } from "@/lib/errors";
import {
  type BookmarkEntry,
  type FolderEntry,
  useRemoveBookmark,
  useUpdateBookmark,
} from "@/lib/library";
import { displayHost } from "@/lib/views";

export function BookmarkRow({
  bookmark,
  folders,
  folderPath,
}: {
  bookmark: BookmarkEntry;
  folders: FolderEntry[];
  folderPath?: string;
}) {
  const item: DragItem = { kind: "bookmark", id: bookmark._id };
  const { ref, isDragging } = useDraggable({
    id: dragItemId(item),
    data: item,
  });

  return (
    // biome-ignore lint/a11y/noRedundantRoles: dnd-kit gives draggable elements without an explicit role role="button", which would nest the row's link and menu inside a button
    <li
      className="group hover:bg-muted/60 flex items-center gap-3 rounded-lg px-3 py-2 data-[dragging=true]:opacity-50"
      data-dragging={isDragging}
      ref={ref}
      role="listitem"
    >
      <Favicon src={bookmark.faviconUrl} />
      <a
        className="flex min-w-0 flex-1 flex-col"
        draggable={false}
        href={bookmark.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span className="truncate py-0.5 text-sm">{bookmark.title}</span>
        <span className="text-muted-foreground truncate text-xs">
          {displayHost(bookmark.url)}
          {folderPath ? ` · ${folderPath}` : null}
        </span>
      </a>
      <BookmarkMenu bookmark={bookmark} folders={folders} />
    </li>
  );
}

function BookmarkMenu({
  bookmark,
  folders,
}: {
  bookmark: BookmarkEntry;
  folders: FolderEntry[];
}) {
  const openDialog = useOpenDialog();
  const updateBookmark = useUpdateBookmark();
  const removeBookmark = useRemoveBookmark();
  const moveTo = (folderId: Id<"folders"> | null) =>
    succeeded(updateBookmark({ bookmarkId: bookmark._id, folderId }));

  async function copyLink() {
    await navigator.clipboard.writeText(bookmark.url);
    toast.success("Link copied");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`${bookmark.title} options`}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 max-md:opacity-100"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => openDialog({ kind: "edit-bookmark", bookmark })}
        >
          Edit
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
            <DropdownMenuItem
              disabled={!bookmark.folderId}
              onClick={() => moveTo(null)}
            >
              Unsorted
            </DropdownMenuItem>
            {folders.map((folder) => (
              <DropdownMenuItem
                disabled={bookmark.folderId === folder._id}
                key={folder._id}
                onClick={() => moveTo(folder._id)}
                style={{ paddingLeft: `${8 + folder.depth * 12}px` }}
              >
                {folder.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={copyLink}>Copy link</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            succeeded(removeBookmark({ bookmarkId: bookmark._id }))
          }
          variant="destructive"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
