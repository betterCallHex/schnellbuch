import type { Id } from "@schnellbuch/backend/data-model";
import { useSearch } from "@tanstack/react-router";
import {
  ClipboardPasteIcon,
  CopyIcon,
  Redo2Icon,
  ScissorsIcon,
  Undo2Icon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHeldClip } from "@/lib/clipboard";
import {
  redoLastEdit,
  undoLastEdit,
  useEditHistory,
} from "@/lib/library-edits";
import { type LibraryItem, useSelectedItem } from "@/lib/selection";
import {
  putOnClipboard,
  SHORTCUTS,
  shortcutLabel,
  usePasteClip,
} from "@/lib/shortcuts";

export function EditMenu() {
  const { undoLabel, redoLabel } = useEditHistory();
  const selected = useSelectedItem();
  const clip = useHeldClip();
  const { folder } = useSearch({ strict: false });
  const pasteClip = usePasteClip(folder as Id<"folders"> | undefined);
  const selectedName = selected && itemName(selected);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Edit"
            className="rounded-full"
            size="icon"
            title="Edit"
            variant="outline"
          />
        }
      >
        <Undo2Icon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <MenuEntry
          disabled={!undoLabel}
          icon={<Undo2Icon />}
          label={undoLabel ? `Undo ${undoLabel}` : "Undo"}
          onClick={undoLastEdit}
          shortcut={shortcutLabel(SHORTCUTS.undo)}
        />
        <MenuEntry
          disabled={!redoLabel}
          icon={<Redo2Icon />}
          label={redoLabel ? `Redo ${redoLabel}` : "Redo"}
          onClick={redoLastEdit}
          shortcut={shortcutLabel(SHORTCUTS.redo)}
        />
        <DropdownMenuSeparator />
        <MenuEntry
          disabled={!selected}
          icon={<ScissorsIcon />}
          label={selectedName ? `Cut “${selectedName}”` : "Cut"}
          onClick={() => selected && putOnClipboard(selected, "cut")}
          shortcut={shortcutLabel(SHORTCUTS.cut)}
        />
        <MenuEntry
          disabled={!selected}
          icon={<CopyIcon />}
          label={selectedName ? `Copy “${selectedName}”` : "Copy"}
          onClick={() => selected && putOnClipboard(selected, "copy")}
          shortcut={shortcutLabel(SHORTCUTS.copy)}
        />
        <MenuEntry
          disabled={!clip}
          icon={<ClipboardPasteIcon />}
          label={clip ? `Paste “${clip.item.name}”` : "Paste"}
          onClick={() => clip && pasteClip(clip)}
          shortcut={shortcutLabel(SHORTCUTS.paste)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuEntry({
  disabled,
  icon,
  label,
  onClick,
  shortcut,
}: {
  disabled: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => unknown;
  shortcut: string;
}) {
  return (
    <DropdownMenuItem disabled={disabled} onClick={onClick}>
      {icon}
      <span className="min-w-0 truncate">{label}</span>
      <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>
    </DropdownMenuItem>
  );
}

function itemName(item: LibraryItem) {
  return item.kind === "folder" ? item.folder.name : item.bookmark.title;
}
