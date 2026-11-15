import type { FolderEntry } from "@/lib/library";
import { UNSORTED } from "@/lib/views";

const INDENT = "   ";

export function FolderSelect({
  folders,
  id,
  value,
  onChange,
}: {
  folders: FolderEntry[];
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2 text-sm outline-none focus-visible:ring-3"
      id={id}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      <option value={UNSORTED}>Unsorted</option>
      {folders.map((folder) => (
        <option key={folder._id} value={folder._id}>
          {INDENT.repeat(folder.depth)}
          {folder.name}
        </option>
      ))}
    </select>
  );
}
