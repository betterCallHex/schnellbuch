import { useDraggable, useDroppable } from "@dnd-kit/react";
import { useNavigate } from "@tanstack/react-router";
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { useOpenDialog } from "@/components/app-dialogs";
import { Favicon } from "@/components/favicon";
import { FolderGlyph } from "@/components/folder-glyph";
import { BookmarkMenu, FolderMenu } from "@/components/item-menu";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { type DragItem, dragItemId, dropTargetId } from "@/lib/drag";
import { isGridArrowKey, nextGridIndex } from "@/lib/grid-navigation";
import {
  type BookmarkEntry,
  type FolderEntry,
  useDeleteBookmark,
} from "@/lib/library";
import { displayHost } from "@/lib/views";

export type GridItem =
  | { kind: "folder"; folder: FolderEntry; itemCount: number }
  | { kind: "bookmark"; bookmark: BookmarkEntry };

export function FinderGrid({
  items,
  label,
}: {
  items: GridItem[];
  label: string;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const lastPointerType = useRef("mouse");
  const navigate = useNavigate();
  const openDialog = useOpenDialog();
  const deleteBookmark = useDeleteBookmark();
  const keys = items.map(gridItemKey);
  const selectedIndex =
    selectedKey === null ? undefined : keys.indexOf(selectedKey);
  const selected =
    selectedIndex === undefined ? undefined : items[selectedIndex];

  function open(item: GridItem) {
    if (item.kind === "folder") {
      navigate({ to: "/", search: { folder: item.folder._id } });
      return;
    }
    window.open(item.bookmark.url, "_blank", "noopener,noreferrer");
  }

  function remove(item: GridItem) {
    if (item.kind === "folder") {
      openDialog({ kind: "delete-folder", folder: item.folder });
      return;
    }
    deleteBookmark(item.bookmark);
  }

  function select(key: string | undefined) {
    setSelectedKey(key ?? null);
    if (key) {
      gridRef.current
        ?.querySelector<HTMLElement>(`[data-key="${key}"]`)
        ?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (isGridArrowKey(event.key) && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      const next = nextGridIndex({
        current: selectedIndex === -1 ? undefined : selectedIndex,
        key: event.key,
        columns: countColumns(gridRef.current),
        count: items.length,
      });
      select(next === undefined ? undefined : keys[next]);
      return;
    }
    if (!selected) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      open(selected);
    } else if (event.key === "Backspace" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      remove(selected);
    } else if (event.key === "Escape") {
      setSelectedKey(null);
    }
  }

  return (
    <div
      aria-label={label}
      className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-x-2 gap-y-5 p-4 outline-none md:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] md:p-6"
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        lastPointerType.current = event.pointerType;
        if (event.target === event.currentTarget) {
          setSelectedKey(null);
        }
      }}
      ref={gridRef}
      role="listbox"
      tabIndex={selected ? -1 : 0}
    >
      {items.map((item, index) => {
        const key = gridItemKey(item);
        const tile = {
          itemKey: key,
          selected: key === selectedKey,
          focusable:
            key === selectedKey || (selected === undefined && index === 0),
          onSelect: () => setSelectedKey(key),
          onOpen: () => open(item),
          onClick: () =>
            lastPointerType.current === "mouse"
              ? setSelectedKey(key)
              : open(item),
        };
        return item.kind === "folder" ? (
          <FolderTile
            folder={item.folder}
            itemCount={item.itemCount}
            key={key}
            {...tile}
          />
        ) : (
          <BookmarkTile bookmark={item.bookmark} key={key} {...tile} />
        );
      })}
    </div>
  );
}

interface TileProps {
  focusable: boolean;
  itemKey: string;
  onClick: () => void;
  onOpen: () => void;
  onSelect: () => void;
  selected: boolean;
}

function FolderTile({
  folder,
  itemCount,
  ...tile
}: TileProps & { folder: FolderEntry; itemCount: number }) {
  const item: DragItem = { kind: "folder", id: folder._id };
  const target = { folderId: folder._id };
  const { ref: dragRef, isDragging } = useDraggable({
    id: dragItemId(item),
    data: item,
  });
  const { ref: dropRef, isDropTarget } = useDroppable({
    id: dropTargetId(target),
    data: target,
  });
  return (
    <Tile
      {...tile}
      dropping={isDropTarget}
      glyph={<FolderGlyph className="h-14 w-[4.5rem] drop-shadow-sm" />}
      isDragging={isDragging}
      menu={<FolderMenu folder={folder} onOpen={tile.onOpen} />}
      name={folder.name}
      refs={(element) => {
        dragRef(element);
        dropRef(element);
      }}
      subtitle={itemCount === 1 ? "1 item" : `${itemCount} items`}
    />
  );
}

function BookmarkTile({
  bookmark,
  ...tile
}: TileProps & { bookmark: BookmarkEntry }) {
  const item: DragItem = { kind: "bookmark", id: bookmark._id };
  const { ref, isDragging } = useDraggable({
    id: dragItemId(item),
    data: item,
  });
  return (
    <Tile
      {...tile}
      dropping={false}
      glyph={
        <span className="bg-card flex size-14 items-center justify-center rounded-2xl border shadow-sm">
          <Favicon className="size-7 rounded-md" src={bookmark.faviconUrl} />
        </span>
      }
      isDragging={isDragging}
      menu={<BookmarkMenu bookmark={bookmark} onOpen={tile.onOpen} />}
      name={bookmark.title}
      refs={ref}
      subtitle={displayHost(bookmark.url)}
    />
  );
}

function Tile({
  itemKey,
  selected,
  focusable,
  dropping,
  isDragging,
  glyph,
  name,
  subtitle,
  menu,
  refs,
  onSelect,
  onOpen,
  onClick,
}: TileProps & {
  dropping: boolean;
  isDragging: boolean;
  glyph: ReactNode;
  name: string;
  subtitle: string;
  menu: ReactNode;
  refs: (element: Element | null) => void;
}) {
  return (
    <ContextMenu onOpenChange={(open) => open && onSelect()}>
      <ContextMenuTrigger
        render={
          // biome-ignore lint/a11y/useKeyWithClickEvents: the listbox handles arrow keys, Enter and ⌘⌫ for every option
          <div
            aria-selected={selected}
            className="group focus-visible:ring-selection/60 flex flex-col items-center gap-1 rounded-xl p-1.5 outline-none select-none focus-visible:ring-2 data-[dragging=true]:opacity-40"
            data-dragging={isDragging}
            data-key={itemKey}
            data-over={dropping}
            onClick={onClick}
            onDoubleClick={onOpen}
            onFocus={onSelect}
            ref={refs}
            role="option"
            tabIndex={focusable ? 0 : -1}
            title={name}
          />
        }
      >
        <span className="group-aria-selected:bg-muted group-data-[over=true]:bg-selection/20 group-data-[over=true]:ring-selection flex h-[4.5rem] w-full items-center justify-center rounded-lg transition-colors group-data-[over=true]:ring-2">
          {glyph}
        </span>
        <span className="group-aria-selected:bg-selection line-clamp-2 max-w-full rounded-md px-1.5 py-0.5 text-center text-[0.8125rem] leading-snug break-words group-aria-selected:text-white">
          {name}
        </span>
        <span className="text-meta max-w-full truncate text-xs">
          {subtitle}
        </span>
      </ContextMenuTrigger>
      {menu}
    </ContextMenu>
  );
}

function gridItemKey(item: GridItem) {
  return item.kind === "folder"
    ? dragItemId({ kind: "folder", id: item.folder._id })
    : dragItemId({ kind: "bookmark", id: item.bookmark._id });
}

function countColumns(grid: HTMLElement | null) {
  if (!grid) {
    return 1;
  }
  return getComputedStyle(grid).gridTemplateColumns.split(" ").length;
}
