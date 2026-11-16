import { cn } from "cn";
import arcLogo from "@/assets/browsers/arc.svg";
import braveLogo from "@/assets/browsers/brave.svg";
import chromeLogo from "@/assets/browsers/chrome.svg";
import edgeLogo from "@/assets/browsers/edge.svg";
import firefoxLogo from "@/assets/browsers/firefox.svg";
import operaLogo from "@/assets/browsers/opera.svg";
import safariLogo from "@/assets/browsers/safari.svg";
import vivaldiLogo from "@/assets/browsers/vivaldi.svg";
import type { BrowserName } from "@/lib/browsers";

const LOGOS: Record<BrowserName, string> = {
  Chrome: chromeLogo,
  Safari: safariLogo,
  Firefox: firefoxLogo,
  Edge: edgeLogo,
  Brave: braveLogo,
  Arc: arcLogo,
  Opera: operaLogo,
  Vivaldi: vivaldiLogo,
};

export function BrowserLogo({
  name,
  className,
}: {
  name: BrowserName;
  className?: string;
}) {
  return (
    <img
      alt=""
      className={cn("object-contain", className)}
      draggable={false}
      height={32}
      src={LOGOS[name]}
      width={32}
    />
  );
}
