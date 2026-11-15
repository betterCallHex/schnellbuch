import { useDroppable } from "@dnd-kit/react";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import { type DropTarget, dropTargetId } from "@/lib/drag";
import type { FolderEntry } from "@/lib/library";

export function Breadcrumbs({ trail }: { trail: FolderEntry[] }) {
  const current = trail.at(-1);
  return (
    <nav aria-label="Folder path">
      <ol className="flex min-w-0 items-center gap-0.5 text-sm">
        <Crumb
          current={current === undefined}
          label="Bookmarks"
          target={{ folderId: null }}
        />
        {trail.map((folder) => (
          <li className="flex min-w-0 items-center gap-0.5" key={folder._id}>
            <ChevronRightIcon
              aria-hidden
              className="text-muted-foreground size-3.5 shrink-0"
            />
            <Crumb
              current={folder === current}
              label={folder.name}
              target={{ folderId: folder._id }}
            />
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Crumb({
  label,
  target,
  current,
}: {
  label: string;
  target: DropTarget;
  current: boolean;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: `crumb-${dropTargetId(target)}`,
    data: target,
  });
  return (
    <Link
      aria-current={current ? "page" : undefined}
      className="text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:text-foreground data-[over=true]:bg-selection min-w-0 truncate rounded-md px-1.5 py-1 aria-[current=page]:text-base aria-[current=page]:font-semibold data-[over=true]:text-white"
      data-over={isDropTarget}
      ref={ref}
      search={{ folder: target.folderId ?? undefined }}
      to="/"
    >
      {label}
    </Link>
  );
}
