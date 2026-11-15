import { GlobeIcon } from "lucide-react";
import { useState } from "react";

export function Favicon({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <GlobeIcon
        aria-hidden
        className="text-muted-foreground size-4 shrink-0"
      />
    );
  }
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError swaps a broken icon for the fallback, it is not a user interaction
    <img
      alt=""
      className="size-4 shrink-0 rounded-sm"
      height={16}
      loading="lazy"
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      src={src}
      width={16}
    />
  );
}
