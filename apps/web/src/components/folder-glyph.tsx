import {
  DEFAULT_FOLDER_COLOR,
  type FolderColor,
  type FolderMark,
} from "@schnellbuch/backend/folder-style";
import { FOLDER_SYMBOL_ICONS } from "@/components/folder-symbols";

export function FolderGlyph({
  className,
  color,
  mark,
}: {
  className?: string;
  color?: FolderColor;
  mark?: FolderMark;
}) {
  return (
    <svg
      aria-hidden
      className={className}
      data-folder-color={color ?? DEFAULT_FOLDER_COLOR}
      viewBox="0 0 64 50"
    >
      <path
        d="M3 7.5A4.5 4.5 0 0 1 7.5 3h14.6a4.5 4.5 0 0 1 3.2 1.3L29 8h27.5a4.5 4.5 0 0 1 4.5 4.5V18H3z"
        fill="var(--folder-back)"
      />
      <rect
        fill="var(--folder-front)"
        height="36"
        rx="4"
        width="58"
        x="3"
        y="11"
      />
      <rect
        fill="var(--folder-shine)"
        height="1.5"
        rx="0.75"
        width="54"
        x="5"
        y="12.5"
      />
      {mark ? <MarkOnFolder mark={mark} /> : null}
    </svg>
  );
}

function MarkOnFolder({ mark }: { mark: FolderMark }) {
  if (mark.kind === "emoji") {
    return (
      <text
        dominantBaseline="central"
        fontSize="19"
        textAnchor="middle"
        x="32"
        y="30.5"
      >
        {mark.emoji}
      </text>
    );
  }
  const Icon = FOLDER_SYMBOL_ICONS[mark.symbol];
  return (
    <Icon
      color="var(--folder-mark)"
      size={18}
      strokeWidth={2.4}
      x={23}
      y={20.5}
    />
  );
}
