import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { cn } from "cn";
import { FileUpIcon } from "lucide-react";
import { type DragEvent, useRef, useState } from "react";
import { BrowserLogo } from "@/components/browser-logo";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BROWSERS,
  canImportDirectly,
  currentBrowser,
  type KnownBrowser,
} from "@/lib/browsers";
import {
  readExtensionBookmarks,
  useExtensionEngine,
} from "@/lib/extension-bridge";
import { useImportBookmarks } from "@/lib/use-import";

const EXTENSION_GUIDE_URL =
  "https://github.com/betterCallHex/schnellbuch#browser-extension";

export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        {open ? (
          <HotkeysProvider exclusive scope="dialog">
            <BrowserImport onStarted={() => onOpenChange(false)} />
          </HotkeysProvider>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function BrowserImport({ onStarted }: { onStarted: () => void }) {
  const [current] = useState(currentBrowser);
  const [picked, setPicked] = useState(() =>
    BROWSERS.find(({ name }) => name === current.name)
  );
  const extensionEngine = useExtensionEngine();
  const importBookmarks = useImportBookmarks();

  function importFromBrowser(browser: KnownBrowser) {
    onStarted();
    importBookmarks({
      fileName: `${browser.name} bookmarks`,
      label: `your ${browser.name} bookmarks`,
      readHtml: readExtensionBookmarks,
      source: browser.name,
    });
  }

  function importFile(file: File) {
    onStarted();
    importBookmarks({
      fileName: file.name,
      label: file.name,
      readHtml: () => file.text(),
    });
  }

  const direct =
    picked !== undefined &&
    canImportDirectly(picked.name, current, extensionEngine);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Import bookmarks</DialogTitle>
        <DialogDescription>
          Which browser are your bookmarks in? They land in one new folder,
          skipping links you already have.
        </DialogDescription>
      </DialogHeader>
      <fieldset className="grid grid-cols-4 gap-x-2 gap-y-3">
        <legend className="sr-only">Browser</legend>
        {BROWSERS.map((browser) => (
          <BrowserTile
            browser={browser}
            key={browser.name}
            onPick={setPicked}
            picked={picked === browser}
          />
        ))}
      </fieldset>
      {picked && direct ? (
        <DirectImport browser={picked} onImport={importFromBrowser} />
      ) : null}
      {picked && !direct ? (
        <FileImport browser={picked} onFile={importFile} />
      ) : null}
    </>
  );
}

function BrowserTile({
  browser,
  picked,
  onPick,
}: {
  browser: KnownBrowser;
  picked: boolean;
  onPick: (browser: KnownBrowser) => void;
}) {
  return (
    <button
      aria-pressed={picked}
      className="group focus-visible:ring-selection/60 flex flex-col items-center gap-1 rounded-xl p-1.5 outline-none select-none focus-visible:ring-2"
      onClick={() => onPick(browser)}
      type="button"
    >
      <span className="group-hover:bg-muted/60 group-aria-pressed:bg-muted flex h-16 w-full items-center justify-center rounded-lg transition-colors">
        <BrowserLogo className="size-10 drop-shadow-sm" name={browser.name} />
      </span>
      <span className="group-aria-pressed:bg-selection rounded-md px-1.5 py-0.5 text-[0.8125rem] leading-snug group-aria-pressed:text-white">
        {browser.name}
      </span>
    </button>
  );
}

function DirectImport({
  browser,
  onImport,
}: {
  browser: KnownBrowser;
  onImport: (browser: KnownBrowser) => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-muted-foreground">
        The SchnellBuch extension in this browser hands {browser.name}'s
        bookmarks to SchnellBuch, folders and all.
      </p>
      <Button onClick={() => onImport(browser)}>
        <BrowserLogo className="size-4" name={browser.name} />
        Import from {browser.name}
      </Button>
    </div>
  );
}

function FileImport({
  browser,
  onFile,
}: {
  browser: KnownBrowser;
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function drop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    const [file] = event.dataTransfer.files;
    if (file) {
      onFile(file);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground">
        {browser.engine === "webkit" ? (
          "Safari doesn't let extensions read its bookmarks, so export them to a file:"
        ) : (
          <>
            To import in one click, open SchnellBuch in {browser.name} with the{" "}
            <a
              className="text-foreground underline underline-offset-4"
              href={EXTENSION_GUIDE_URL}
              rel="noopener"
              target="_blank"
            >
              SchnellBuch extension
            </a>{" "}
            installed, then reload the page. Or export a file:
          </>
        )}
      </p>
      <ol className="flex list-decimal flex-col gap-1 pl-5">
        {browser.exportSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <button
        className={cn(
          "hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 flex flex-col items-center gap-2 rounded-lg border border-dashed p-4 text-center transition-colors outline-none focus-visible:ring-3",
          dragging && "border-primary bg-muted"
        )}
        onClick={() => input.current?.click()}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDrop={drop}
        type="button"
      >
        <FileUpIcon aria-hidden className="text-muted-foreground size-5" />
        <span className="text-muted-foreground">
          Drop the exported file here
        </span>
        <span className={buttonVariants({ size: "sm", variant: "outline" })}>
          Choose file…
        </span>
      </button>
      <input
        accept=".html,.htm,text/html"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onFile(file);
          }
        }}
        ref={input}
        type="file"
      />
    </div>
  );
}
