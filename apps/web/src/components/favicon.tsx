import { cn } from "cn";
import { GlobeIcon } from "lucide-react";
import { useState } from "react";

export function Favicon({
  src,
  className,
}: {
  src?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <GlobeIcon
        aria-hidden
        className={cn("text-muted-foreground size-4 shrink-0", className)}
      />
    );
  }
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError swaps a broken icon for the fallback, it is not a user interaction
    <img
      alt=""
      className={cn("size-4 shrink-0 rounded-sm", className)}
      height={32}
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      src={src}
      width={32}
    />
  );
}
