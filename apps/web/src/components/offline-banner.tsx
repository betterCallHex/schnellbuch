import { CloudOffIcon, CloudUploadIcon } from "lucide-react";
import { useLibrary } from "@/lib/library";
import { useOffline } from "@/lib/offline";
import { useQueuedEdits } from "@/lib/offline-queue-store";

export function OfflineBanner() {
  const offline = useOffline();
  const { source, mirroredAt, userId } = useLibrary();
  const waiting = useQueuedEdits(userId).length;
  if (!(offline || waiting > 0)) {
    return null;
  }
  const Icon = offline ? CloudOffIcon : CloudUploadIcon;
  return (
    <div
      className="bg-muted text-foreground flex items-center gap-2 border-b px-4 py-2 text-sm"
      role="status"
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      <span>
        {offline
          ? offlineMessage(source === "mirror" ? mirroredAt : undefined)
          : `Syncing ${changes(waiting)} made offline…`}
        {offline && waiting > 0 ? ` ${changes(waiting)} waiting to sync.` : ""}
      </span>
    </div>
  );
}

function offlineMessage(mirroredAt: number | undefined) {
  const asOf = mirroredAt
    ? new Date(mirroredAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : undefined;
  return `You're offline. ${asOf ? `Showing your bookmarks as of ${asOf}. ` : ""}Changes stay on this device and sync when you're back online.`;
}

function changes(count: number) {
  return count === 1 ? "1 change" : `${count} changes`;
}
