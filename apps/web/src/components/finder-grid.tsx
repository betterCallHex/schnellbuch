import { useDraggable, useDroppable } from "@dnd-kit/react";
import { detectPlatform, useHotkeys } from "@tanstack/react-hotkeys";
import { useNavigate } from "@tanstack/react-router";
import {
  defaultRangeExtractor,
  useWindowVirtualizer,
} from "@tanstack/react-virtual";
import { cn } from "cn";
import { CloudUploadIcon, TriangleAlertIcon } from "lucide-react";
import {
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useOpenDialog } from "@/components/app-dialogs";
import { Favicon } from "@/components/favicon";
import { FolderGlyph } from "@/components/folder-glyph";
import {
  BookmarkMenu,
  FolderMenu,
  SelectionMenu,
} from "@/components/item-menu";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { useHeldClip } from "@/lib/clipboard";
import { type DragItem, dragItemId, dropTargetId } from "@/lib/drag";
import {
  GRID_ARROW_KEYS,
  gridColumns,
  nextGridIndex,
  selectRange,
} from "@/lib/grid-navigation";
import {
  type BookmarkEntry,
  type FolderEntry,
  useLibrary,
} from "@/lib/library";
import { useLibraryEdits } from "@/lib/library-edits";
import {
  type Box,
  boxBetween,
  combineSelection,
  edgeScrollSpeed,
  indexesInBox,
  type Point,
} from "@/lib/marquee";
import { itemId, type LibraryItem, showSelection } from "@/lib/selection";
import { putOnClipboard, SHORTCUTS } from "@/lib/shortcuts";
import type { Layout } from "@/lib/view-prefs";
import { displayHost } from "@/lib/views";

export type GridItem =
  | { kind: "folder"; folder: FolderEntry; itemCount: number }
  | { kind: "bookmark"; bookmark: BookmarkEntry };

const TILE_MIN_WIDTH_PX = 112;
const TILE_GAP_PX = 8;
const GRID_ROW_GAP_PX = 20;
const ESTIMATED_ROW_PX = { grid: 136, list: 44 };
const OVERSCAN_ROWS = 4;
const SAVED_DATE = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

interface Selection {
  anchor?: string;
  keys: string[];
  lead?: string;
}

interface MarqueeDrag {
  base: Selection;
  before: Selection;
  origin: Point;
  pointer: Point;
  pointerId: number;
  toggle: boolean;
}

export function FinderGrid({
  items,
  label,
  layout,
  revealKey,
}: {
  items: GridItem[];
  label: string;
  layout: Layout;
  // A tile to select and scroll to when the folder opens.
  revealKey?: string;
}) {
  "use no memo";
  const [selection, setSelection] = useState<Selection>(() =>
    revealKey
      ? { keys: [revealKey], anchor: revealKey, lead: revealKey }
      : { keys: [] }
  );
  const [columns, setColumns] = useState(1);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [marquee, setMarquee] = useState<Box>();
  const gridRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const marqueeDrag = useRef<MarqueeDrag | undefined>(undefined);
  const edgeScrollFrame = useRef<number | undefined>(undefined);
  const lastPointerType = useRef("mouse");
  const navigate = useNavigate();
  const openDialog = useOpenDialog();
  const edits = useLibraryEdits();
  const clip = useHeldClip();
  const { pendingIds } = useLibrary();
  const keys = items.map(gridItemKey);
  const selectedKeys = new Set(
    selection.keys.filter((key) => keys.includes(key))
  );
  const selectedItems = items.filter((item) =>
    selectedKeys.has(gridItemKey(item))
  );
  const leadIndex = selection.lead ? keys.indexOf(selection.lead) : -1;
  const leadItem = leadIndex === -1 ? undefined : items[leadIndex];
  // The lead tile as of the last key press, and a tile waiting for focus.
  const lead = useRef(selection.lead);
  const pendingFocus = useRef<string | undefined>(undefined);
  const perRow = layout === "list" ? 1 : columns;
  const rowCount = Math.ceil(items.length / perRow);
  const clipped = new Set(
    clip?.mode === "cut" ? clip.items.map((item) => item.id) : []
  );

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => ESTIMATED_ROW_PX[layout],
    overscan: OVERSCAN_ROWS,
    scrollMargin,
    // The lead tile's row stays rendered even when scrolled away, so the
    // focused tile never leaves the page and keys keep reaching the grid.
    rangeExtractor: (range) => {
      const rows = defaultRangeExtractor(range);
      const leadRow =
        leadIndex === -1 ? undefined : Math.floor(leadIndex / perRow);
      return leadRow === undefined || rows.includes(leadRow)
        ? rows
        : [...rows, leadRow].toSorted((first, second) => first - second);
    },
  });

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) {
      return;
    }
    const measure = () => {
      setColumns(gridColumns(grid.clientWidth, TILE_MIN_WIDTH_PX, TILE_GAP_PX));
      setScrollMargin(grid.getBoundingClientRect().top + window.scrollY);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  const selectedIds = selectedItems.map(itemId).join();
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedIds stands for selectedItems, which is a new array every render
  useEffect(() => {
    showSelection(selectedItems);
  }, [selectedIds]);

  useEffect(() => () => showSelection([]), []);

  useEffect(
    () => () => {
      if (edgeScrollFrame.current !== undefined) {
        cancelAnimationFrame(edgeScrollFrame.current);
      }
    },
    []
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the folder opens with a tile to reveal
  useEffect(() => {
    if (revealKey) {
      focusKey(revealKey);
    }
  }, []);

  // Focus follows the lead tile once its row is rendered, which can take a
  // render or two after scrolling to it.
  useEffect(() => {
    const key = pendingFocus.current;
    const tile = key
      ? gridRef.current?.querySelector<HTMLElement>(
          `[data-key="${CSS.escape(key)}"]`
        )
      : undefined;
    if (tile) {
      pendingFocus.current = undefined;
      tile.focus({ preventScroll: true });
    }
  });

  useEffect(() => {
    if (!marquee) {
      return;
    }
    window.addEventListener("scroll", dragMarquee, { passive: true });
    return () => window.removeEventListener("scroll", dragMarquee);
  });

  function focusKey(key: string) {
    const index = keys.indexOf(key);
    if (index === -1) {
      return;
    }
    lead.current = key;
    pendingFocus.current = key;
    virtualizer.scrollToIndex(Math.floor(index / perRow), { align: "auto" });
  }

  function selectOnly(key: string | undefined) {
    lead.current = key;
    setSelection(key ? { keys: [key], anchor: key, lead: key } : { keys: [] });
  }

  function changeSelection(next: Selection) {
    lead.current = next.lead;
    setSelection(next);
  }

  function open(item: GridItem) {
    if (item.kind === "folder") {
      navigate({ to: "/", search: { folder: item.folder._id } });
      return;
    }
    window.open(item.bookmark.url, "_blank", "noopener,noreferrer");
  }

  function remove() {
    const [only] = selectedItems;
    if (selectedItems.length === 1 && only?.kind === "folder") {
      openDialog({ kind: "delete-folder", folder: only.folder });
      return;
    }
    if (selectedItems.some((item) => item.kind === "folder")) {
      openDialog({ kind: "delete-items", items: selectedItems });
      return;
    }
    edits.deleteItems(selectedItems);
  }

  function step(key: (typeof GRID_ARROW_KEYS)[number], extend: boolean) {
    // The ref, not state: a held arrow key repeats faster than renders.
    const currentIndex = lead.current ? keys.indexOf(lead.current) : -1;
    const next = nextGridIndex({
      current: currentIndex === -1 ? undefined : currentIndex,
      key,
      columns: perRow,
      count: items.length,
    });
    const nextKey = next === undefined ? undefined : keys[next];
    if (!nextKey) {
      return;
    }
    if (extend && selection.anchor) {
      changeSelection({
        anchor: selection.anchor,
        lead: nextKey,
        keys: selectRange(keys, selection.anchor, nextKey),
      });
    } else {
      selectOnly(nextKey);
    }
    focusKey(nextKey);
  }

  function clickTile(key: string, item: GridItem, event: MouseEvent) {
    if (lastPointerType.current !== "mouse") {
      open(item);
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      changeSelection({
        anchor: key,
        lead: key,
        keys: selectedKeys.has(key)
          ? selection.keys.filter((candidate) => candidate !== key)
          : [...selection.keys, key],
      });
      return;
    }
    if (event.shiftKey && selection.anchor) {
      changeSelection({
        anchor: selection.anchor,
        lead: key,
        keys: selectRange(keys, selection.anchor, key),
      });
      return;
    }
    selectOnly(key);
  }

  function pressBackground(event: PointerEvent<HTMLDivElement>) {
    const mac = detectPlatform() === "mac";
    if (mac && event.ctrlKey) {
      return;
    }
    const toggle = event.metaKey || (!mac && event.ctrlKey);
    const additive = toggle || event.shiftKey;
    if (!additive) {
      selectOnly(undefined);
    }
    const pointer = { x: event.clientX, y: event.clientY };
    const origin = pointInContent(pointer);
    if (!origin || event.pointerType === "touch" || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    marqueeDrag.current = {
      before: { ...selection, keys: [...selectedKeys] },
      pointerId: event.pointerId,
      base: additive ? { ...selection, keys: [...selectedKeys] } : { keys: [] },
      origin,
      pointer,
      toggle,
    };
  }

  function moveMarquee(event: PointerEvent) {
    if (!marqueeDrag.current) {
      return;
    }
    marqueeDrag.current.pointer = { x: event.clientX, y: event.clientY };
    dragMarquee();
    scrollNearEdge();
  }

  function scrollNearEdge() {
    edgeScrollFrame.current ??= requestAnimationFrame(stepEdgeScroll);
  }

  function stepEdgeScroll() {
    edgeScrollFrame.current = undefined;
    const drag = marqueeDrag.current;
    const view = { top: belowToolbar(), bottom: window.innerHeight };
    const speed = drag ? edgeScrollSpeed(drag.pointer.y, view) : 0;
    const scrolledFrom = window.scrollY;
    window.scrollBy(0, speed);
    if (window.scrollY !== scrolledFrom) {
      scrollNearEdge();
    }
  }

  function dragMarquee() {
    const drag = marqueeDrag.current;
    const content = contentRef.current;
    const to = drag && pointInContent(drag.pointer);
    if (!(drag && content && to)) {
      return;
    }
    const box = boxBetween(drag.origin, to);
    const scrollOffset = virtualizer.options.scrollMargin;
    const hits = indexesInBox({
      box,
      rows: virtualizer.measurementsCache.map((row) => ({
        start: row.start - scrollOffset,
        end: row.end - scrollOffset,
      })),
      columns: perRow,
      width: content.clientWidth,
      columnGap: layout === "grid" ? TILE_GAP_PX : 0,
      rowGap: layout === "grid" ? GRID_ROW_GAP_PX : 0,
      count: items.length,
    }).flatMap((index) => keys[index] ?? []);
    const chosen = combineSelection({
      keys,
      base: drag.base.keys,
      hits,
      toggle: drag.toggle,
    });
    const chosenHits = hits.filter((key) => chosen.includes(key));
    const stillChosen = (key: string | undefined) =>
      key !== undefined && chosen.includes(key) ? key : undefined;
    setMarquee(box);
    changeSelection({
      keys: chosen,
      anchor: chosenHits[0] ?? stillChosen(drag.base.anchor) ?? chosen[0],
      lead: chosenHits.at(-1) ?? stillChosen(drag.base.lead) ?? chosen.at(-1),
    });
  }

  function endMarquee() {
    stopEdgeScroll();
    setMarquee(undefined);
  }

  function stopEdgeScroll() {
    if (edgeScrollFrame.current !== undefined) {
      cancelAnimationFrame(edgeScrollFrame.current);
      edgeScrollFrame.current = undefined;
    }
    marqueeDrag.current = undefined;
  }

  function cancelMarquee() {
    const drag = marqueeDrag.current;
    if (!drag) {
      return;
    }
    changeSelection(drag.before);
    gridRef.current?.releasePointerCapture(drag.pointerId);
    endMarquee();
  }

  function pointInContent(client: Point) {
    const grid = gridRef.current?.getBoundingClientRect();
    const content = contentRef.current?.getBoundingClientRect();
    if (!(grid && content)) {
      return;
    }
    return {
      x: clamp(client.x, grid.left, grid.right) - content.left,
      y: clamp(client.y, grid.top, grid.bottom) - content.top,
    };
  }

  useHotkeys(
    [
      ...GRID_ARROW_KEYS.flatMap((key) => [
        { hotkey: key, callback: () => step(key, false) },
        { hotkey: `Shift+${key}` as const, callback: () => step(key, true) },
      ]),
      {
        hotkey: "Enter",
        callback: () => {
          if (leadItem) {
            open(leadItem);
          }
        },
      },
      {
        hotkey: "Mod+Backspace",
        callback: () => selectedItems.length > 0 && remove(),
      },
      {
        hotkey: "Escape",
        callback: () =>
          marqueeDrag.current ? cancelMarquee() : selectOnly(undefined),
      },
      {
        hotkey: "Mod+A",
        callback: () =>
          changeSelection({
            keys,
            anchor: keys[0],
            lead: selection.lead ?? keys[0],
          }),
      },
    ],
    { target: gridRef, ignoreInputs: false }
  );

  useHotkeys(
    [
      {
        hotkey: SHORTCUTS.copy,
        callback: () => putOnClipboard(selectedItems, "copy"),
      },
      {
        hotkey: SHORTCUTS.cut,
        callback: () => putOnClipboard(selectedItems, "cut"),
      },
    ],
    { enabled: selectedItems.length > 0, ignoreInputs: true }
  );

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div
      aria-label={label}
      aria-multiselectable
      className="flex-1 p-4 outline-none md:p-6"
      onLostPointerCapture={endMarquee}
      onPointerDown={(event) => {
        lastPointerType.current = event.pointerType;
        if (isOnBackground(event.currentTarget, event.target)) {
          pressBackground(event);
        }
      }}
      onPointerMove={moveMarquee}
      ref={gridRef}
      role="listbox"
      tabIndex={leadItem ? -1 : 0}
    >
      <div
        className="relative w-full"
        ref={contentRef}
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualRows.map((row) => {
          const rowItems = items.slice(
            row.index * perRow,
            (row.index + 1) * perRow
          );
          return (
            <div
              className={cn(
                "absolute top-0 left-0 w-full",
                layout === "grid" ? "grid gap-x-2 pb-5" : "flex flex-col"
              )}
              data-index={row.index}
              key={row.key}
              ref={virtualizer.measureElement}
              style={{
                transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
                ...(layout === "grid"
                  ? { gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))` }
                  : {}),
              }}
            >
              {rowItems.map((item, offset) => {
                const index = row.index * perRow + offset;
                const key = gridItemKey(item);
                const id = itemIdOf(item);
                const selected = selectedKeys.has(key);
                const many = selected && selectedItems.length > 1;
                const tile: TileProps = {
                  layout,
                  itemKey: key,
                  selected,
                  cut: clipped.has(id),
                  pending: pendingIds.has(id),
                  focusable:
                    key === selection.lead ||
                    (leadItem === undefined && index === 0),
                  onContextMenu: () => {
                    if (!selected) {
                      selectOnly(key);
                    }
                  },
                  onOpen: () => open(item),
                  onClick: (event) => clickTile(key, item, event),
                  menu: many ? (
                    <SelectionMenu items={selectedItems} />
                  ) : undefined,
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
        })}
        {marquee ? (
          <div
            aria-hidden
            className="border-selection bg-selection/15 pointer-events-none absolute z-10 rounded-sm border"
            data-marquee
            style={{
              left: marquee.left,
              top: marquee.top,
              width: marquee.right - marquee.left,
              height: marquee.bottom - marquee.top,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function isOnBackground(grid: Element, target: EventTarget) {
  return (
    target instanceof Element &&
    grid.contains(target) &&
    target.closest("[data-key]") === null
  );
}

function belowToolbar() {
  return document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

interface TileProps {
  cut: boolean;
  focusable: boolean;
  itemKey: string;
  layout: Layout;
  // Replaces the tile's own menu while several tiles are selected.
  menu?: ReactNode;
  onClick: (event: MouseEvent) => void;
  onContextMenu: () => void;
  onOpen: () => void;
  pending: boolean;
  selected: boolean;
}

function FolderTile({
  folder,
  itemCount,
  menu,
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
      glyph={
        <FolderGlyph
          className={
            tile.layout === "grid"
              ? "h-14 w-[4.5rem] drop-shadow-sm"
              : "h-5 w-6 shrink-0"
          }
          color={folder.color}
          mark={folder.mark}
        />
      }
      isDragging={isDragging}
      menu={menu ?? <FolderMenu folder={folder} onOpen={tile.onOpen} />}
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
  menu,
  ...tile
}: TileProps & { bookmark: BookmarkEntry }) {
  const item: DragItem = { kind: "bookmark", id: bookmark._id };
  const { ref, isDragging } = useDraggable({
    id: dragItemId(item),
    data: item,
  });
  const gone = bookmark.linkCheck?.status === "gone";
  return (
    <Tile
      {...tile}
      badge={gone ? <BrokenBadge /> : null}
      date={SAVED_DATE.format(bookmark.savedAt ?? bookmark._creationTime)}
      dropping={false}
      glyph={
        tile.layout === "grid" ? (
          <span className="bg-card flex size-14 items-center justify-center rounded-2xl border shadow-sm">
            <Favicon className="size-7 rounded-md" src={bookmark.faviconUrl} />
          </span>
        ) : (
          <Favicon className="size-5 rounded" src={bookmark.faviconUrl} />
        )
      }
      isDragging={isDragging}
      menu={menu ?? <BookmarkMenu bookmark={bookmark} onOpen={tile.onOpen} />}
      name={bookmark.title}
      note={bookmark.note}
      refs={ref}
      subtitle={displayHost(bookmark.url)}
    />
  );
}

function Tile({
  layout,
  itemKey,
  cut,
  pending,
  selected,
  focusable,
  dropping,
  isDragging,
  glyph,
  badge,
  name,
  note,
  subtitle,
  date,
  menu,
  refs,
  onContextMenu,
  onOpen,
  onClick,
}: Omit<TileProps, "menu"> & {
  badge?: ReactNode;
  date?: string;
  dropping: boolean;
  glyph: ReactNode;
  isDragging: boolean;
  menu: ReactNode;
  name: string;
  note?: string;
  refs: (element: Element | null) => void;
  subtitle: string;
}) {
  const marks = (
    <>
      {pending ? <PendingBadge /> : null}
      {badge}
    </>
  );
  return (
    <ContextMenu onOpenChange={(open) => open && onContextMenu()}>
      <ContextMenuTrigger
        render={
          // biome-ignore lint/a11y/useKeyWithClickEvents: the listbox handles arrow keys, Enter and ⌘⌫ for every option
          <div
            aria-selected={selected}
            className={cn(
              "group focus-visible:ring-selection/60 outline-none select-none focus-visible:ring-2 data-[cut=true]:opacity-50 data-[dragging=true]:opacity-40",
              layout === "grid"
                ? "flex flex-col items-center gap-1 rounded-xl p-1.5"
                : "aria-selected:bg-selection data-[over=true]:bg-selection/20 flex items-center gap-3 rounded-lg px-3 py-2 aria-selected:text-white"
            )}
            data-cut={cut}
            data-dragging={isDragging}
            data-key={itemKey}
            data-over={dropping}
            onClick={onClick}
            onDoubleClick={onOpen}
            ref={refs}
            role="option"
            tabIndex={focusable ? 0 : -1}
            title={note ? `${name}\n\n${note}` : name}
          />
        }
      >
        {layout === "grid" ? (
          <>
            <span className="group-aria-selected:bg-muted group-data-[over=true]:bg-selection/20 group-data-[over=true]:ring-selection relative flex h-[4.5rem] w-full items-center justify-center rounded-lg transition-colors group-data-[over=true]:ring-2">
              {glyph}
              <span className="absolute bottom-0.5 left-1/2 flex translate-x-5 gap-0.5">
                {marks}
              </span>
            </span>
            <span className="group-aria-selected:bg-selection line-clamp-2 max-w-full rounded-md px-1.5 py-0.5 text-center text-[0.8125rem] leading-snug break-words group-aria-selected:text-white">
              {name}
            </span>
            <span className="text-meta max-w-full truncate text-xs">
              {subtitle}
            </span>
          </>
        ) : (
          <>
            {glyph}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{name}</span>
              {note ? (
                <span className="text-meta block truncate text-xs group-aria-selected:text-white/80">
                  {note}
                </span>
              ) : null}
            </span>
            {marks}
            <span className="text-meta hidden w-40 shrink-0 truncate text-xs group-aria-selected:text-white/80 sm:block">
              {subtitle}
            </span>
            <span className="text-meta hidden w-28 shrink-0 text-right text-xs group-aria-selected:text-white/80 md:block">
              {date ?? ""}
            </span>
          </>
        )}
      </ContextMenuTrigger>
      {menu}
    </ContextMenu>
  );
}

function PendingBadge() {
  return (
    <span
      className="bg-background text-muted-foreground flex size-5 items-center justify-center rounded-full border shadow-sm"
      title="Waiting to sync"
    >
      <CloudUploadIcon aria-hidden className="size-3" />
      <span className="sr-only">Waiting to sync</span>
    </span>
  );
}

function BrokenBadge() {
  return (
    <span
      className="bg-background flex size-5 items-center justify-center rounded-full border text-amber-600 shadow-sm"
      title="This page seems to be gone"
    >
      <TriangleAlertIcon aria-hidden className="size-3" />
      <span className="sr-only">This page seems to be gone</span>
    </span>
  );
}

function itemIdOf(item: GridItem) {
  return item.kind === "folder" ? item.folder._id : item.bookmark._id;
}

export function gridItemKey(item: GridItem | LibraryItem) {
  return item.kind === "folder"
    ? dragItemId({ kind: "folder", id: item.folder._id })
    : dragItemId({ kind: "bookmark", id: item.bookmark._id });
}
