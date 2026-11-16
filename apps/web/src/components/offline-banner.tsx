import { CloudOffIcon } from "lucide-react";
import { useLibrary } from "@/lib/library";
import { useOffline } from "@/lib/offline";

export function OfflineBanner() {
  const offline = useOffline();
  const { source, mirroredAt } = useLibrary();
  if (!offline) {
    return null;
  }
  const asOf = mirroredAt
    ? new Date(mirroredAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : undefined;
  return (
    <div
      className="bg-muted text-foreground flex items-center gap-2 border-b px-4 py-2 text-sm"
      role="status"
    >
      <CloudOffIcon aria-hidden className="size-4 shrink-0" />
      <span>
        You're offline.{" "}
        {source === "mirror" && asOf
          ? `Showing your bookmarks as of ${asOf}. `
          : ""}
        Saving, moving and deleting are paused until you're back online.
      </span>
    </div>
  );
}
