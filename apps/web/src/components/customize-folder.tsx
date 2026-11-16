import {
  DEFAULT_FOLDER_COLOR,
  FOLDER_COLORS,
  FOLDER_SYMBOLS,
  type FolderColor,
  type FolderMark,
  type FolderSymbol,
} from "@schnellbuch/backend/folder-style";
import { BanIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { FolderGlyph } from "@/components/folder-glyph";
import { FOLDER_SYMBOL_ICONS } from "@/components/folder-symbols";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { firstEmoji } from "@/lib/emoji";
import type { FolderEntry } from "@/lib/library";
import { useLibraryEdits } from "@/lib/library-edits";

type MarkKind = FolderMark["kind"];

const SUGGESTED_EMOJI = [
  "📌",
  "⭐️",
  "❤️",
  "🔥",
  "💼",
  "💻",
  "📚",
  "🎓",
  "🎨",
  "🎵",
  "🎬",
  "📷",
  "🎮",
  "🛒",
  "💰",
  "✈️",
  "🏠",
  "🍳",
  "☕️",
  "🏋️",
  "🌱",
  "🌍",
  "🚀",
  "🔧",
  "🧪",
  "🔒",
  "💡",
];

const PICKER_CELL =
  "hover:bg-muted aria-pressed:bg-selection/15 aria-pressed:ring-selection flex h-10 items-center justify-center rounded-lg outline-none focus-visible:ring-2 aria-pressed:ring-2";

export function CustomizeFolderForm({
  folder,
  onDone,
}: {
  folder: FolderEntry;
  onDone: () => void;
}) {
  const edits = useLibraryEdits();
  const [color, setColor] = useState<FolderColor>(
    folder.color ?? DEFAULT_FOLDER_COLOR
  );
  const [mark, setMark] = useState<FolderMark | undefined>(folder.mark);
  const [markKind, setMarkKind] = useState<MarkKind>(
    folder.mark?.kind ?? "symbol"
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onDone();
    const style = {
      color: color === DEFAULT_FOLDER_COLOR ? null : color,
      mark: mark ?? null,
    };
    const unchanged =
      style.color === (folder.color ?? null) &&
      JSON.stringify(style.mark) === JSON.stringify(folder.mark ?? null);
    if (!unchanged) {
      edits.styleFolder(folder, style);
    }
  }

  function reset() {
    setColor(DEFAULT_FOLDER_COLOR);
    setMark(undefined);
  }

  return (
    <form className="flex flex-col gap-5" method="post" onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>Customize “{folder.name}”</DialogTitle>
        <DialogDescription>
          Pick a colour, and a symbol or emoji to put on the folder.
        </DialogDescription>
      </DialogHeader>
      <div className="flex justify-center">
        <FolderGlyph
          className="h-20 w-28 drop-shadow-md"
          color={color}
          mark={mark}
        />
      </div>
      <ColorPicker onChange={setColor} value={color} />
      <div className="flex flex-col gap-3">
        <fieldset className="bg-muted flex self-center rounded-lg p-0.5">
          <legend className="sr-only">Put on the folder</legend>
          <KindChoice
            current={markKind}
            kind="symbol"
            label="Symbols"
            onSelect={setMarkKind}
          />
          <KindChoice
            current={markKind}
            kind="emoji"
            label="Emoji"
            onSelect={setMarkKind}
          />
        </fieldset>
        {markKind === "symbol" ? (
          <SymbolPicker onChange={setMark} value={mark} />
        ) : (
          <EmojiPicker onChange={setMark} value={mark} />
        )}
      </div>
      <DialogFooter>
        <Button onClick={reset} type="button" variant="outline">
          Reset
        </Button>
        <Button type="submit">Done</Button>
      </DialogFooter>
    </form>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: FolderColor;
  onChange: (color: FolderColor) => void;
}) {
  return (
    <fieldset className="flex flex-wrap justify-center gap-2">
      <legend className="sr-only">Colour</legend>
      {FOLDER_COLORS.map((color) => (
        <label
          className="ring-offset-background has-checked:ring-foreground/70 has-focus-visible:ring-selection size-7 cursor-pointer rounded-full bg-(--folder-front) shadow-sm ring-offset-2 has-checked:ring-2 has-focus-visible:ring-2"
          data-folder-color={color}
          key={color}
          title={color}
        >
          <input
            checked={color === value}
            className="sr-only"
            name="folder-color"
            onChange={() => onChange(color)}
            type="radio"
            value={color}
          />
          <span className="sr-only">{color}</span>
        </label>
      ))}
    </fieldset>
  );
}

function KindChoice({
  kind,
  current,
  label,
  onSelect,
}: {
  kind: MarkKind;
  current: MarkKind;
  label: string;
  onSelect: (kind: MarkKind) => void;
}) {
  return (
    <label className="text-muted-foreground has-checked:bg-background has-checked:text-foreground has-focus-visible:ring-selection cursor-pointer rounded-md px-3 py-1 text-sm font-medium has-checked:shadow-sm has-focus-visible:ring-2">
      <input
        checked={kind === current}
        className="sr-only"
        name="folder-mark-kind"
        onChange={() => onSelect(kind)}
        type="radio"
        value={kind}
      />
      {label}
    </label>
  );
}

function SymbolPicker({
  value,
  onChange,
}: {
  value: FolderMark | undefined;
  onChange: (mark: FolderMark | undefined) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-1">
      <button
        aria-label="No symbol"
        aria-pressed={value === undefined}
        className={PICKER_CELL}
        onClick={() => onChange(undefined)}
        title="None"
        type="button"
      >
        <BanIcon className="text-muted-foreground size-5" />
      </button>
      {FOLDER_SYMBOLS.map((symbol) => {
        const Icon = FOLDER_SYMBOL_ICONS[symbol];
        const chosen = value?.kind === "symbol" && value.symbol === symbol;
        return (
          <button
            aria-label={symbolName(symbol)}
            aria-pressed={chosen}
            className={PICKER_CELL}
            key={symbol}
            onClick={() => onChange({ kind: "symbol", symbol })}
            title={symbolName(symbol)}
            type="button"
          >
            <Icon className="size-5" />
          </button>
        );
      })}
    </div>
  );
}

function symbolName(symbol: FolderSymbol) {
  return symbol.replace("-", " ");
}

function EmojiPicker({
  value,
  onChange,
}: {
  value: FolderMark | undefined;
  onChange: (mark: FolderMark | undefined) => void;
}) {
  const chosen = value?.kind === "emoji" ? value.emoji : undefined;
  const [typed, setTyped] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <Input
        aria-label="Any emoji"
        onChange={(event) => {
          const emoji = firstEmoji(event.target.value);
          setTyped(emoji ?? "");
          if (emoji) {
            onChange({ kind: "emoji", emoji });
          }
        }}
        placeholder="Type or paste any emoji"
        value={typed}
      />
      <div className="grid grid-cols-7 gap-1">
        <button
          aria-label="No emoji"
          aria-pressed={value === undefined}
          className={PICKER_CELL}
          onClick={() => onChange(undefined)}
          title="None"
          type="button"
        >
          <BanIcon className="text-muted-foreground size-5" />
        </button>
        {SUGGESTED_EMOJI.map((emoji) => (
          <button
            aria-label={emoji}
            aria-pressed={chosen === emoji}
            className={`${PICKER_CELL} text-xl`}
            key={emoji}
            onClick={() => onChange({ kind: "emoji", emoji })}
            type="button"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
