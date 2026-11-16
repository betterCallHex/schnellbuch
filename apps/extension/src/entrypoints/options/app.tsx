import { BookmarkPlusIcon, FolderInputIcon } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeServerUrl } from "@/lib/add-url";
import { serverMatchPattern } from "@/lib/server-access";
import { serverUrl } from "@/lib/settings";

type Status = { kind: "idle" } | { kind: "saved" } | { kind: "invalid" };

export function App() {
  const [address, setAddress] = useState("");
  const [shortcut, setShortcut] = useState("Alt+Shift+S");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [savedAddress, setSavedAddress] = useState<string>();
  const [canImport, setCanImport] = useState<boolean>();

  useEffect(() => {
    serverUrl.getValue().then(async (current) => {
      setAddress(current);
      setSavedAddress(current);
      setCanImport(await hasServerAccess(current));
    });
    browser.commands.getAll().then((commands) => {
      const command = commands.find(({ name }) => name === "save-page");
      if (command?.shortcut) {
        setShortcut(command.shortcut);
      }
    });
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = normalizeServerUrl(address);
    if (!cleaned) {
      setStatus({ kind: "invalid" });
      return;
    }
    const access = requestServerAccess(cleaned);
    await serverUrl.setValue(cleaned);
    setAddress(cleaned);
    setSavedAddress(cleaned);
    setStatus({ kind: "saved" });
    setCanImport(await access);
  }

  async function allowImport() {
    if (savedAddress) {
      setCanImport(await requestServerAccess(savedAddress));
    }
  }

  return (
    <main className="flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookmarkPlusIcon aria-hidden className="size-4" />
            SchnellBuch
          </CardTitle>
          <CardDescription>
            Pages and links you save go to this address. Use your own if you
            host SchnellBuch yourself.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3" method="post" onSubmit={save}>
            <Label htmlFor="server">SchnellBuch address</Label>
            <Input
              autoComplete="url"
              id="server"
              name="server"
              onChange={(event) => {
                setAddress(event.target.value);
                setStatus({ kind: "idle" });
              }}
              placeholder="https://bookmarks.example.com"
              required
              value={address}
            />
            <div className="flex items-center gap-3">
              <Button type="submit">Save</Button>
              <span
                aria-live="polite"
                className={
                  status.kind === "invalid"
                    ? "text-destructive text-sm"
                    : "text-muted-foreground text-sm"
                }
                role="status"
              >
                {status.kind === "saved" ? "Saved" : null}
                {status.kind === "invalid" ? "That isn't a web address." : null}
              </span>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Ways to save</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5 text-sm">
            <li>Click the SchnellBuch button in the toolbar.</li>
            <li>
              Press <kbd className="text-foreground font-mono">{shortcut}</kbd>.
              Change it in your browser's extension shortcuts.
            </li>
            <li>Right-click any link → Save link to SchnellBuch.</li>
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderInputIcon aria-hidden className="size-4" />
            Import this browser's bookmarks
          </CardTitle>
          <CardDescription>
            In SchnellBuch, open ⋯ → Import bookmarks… and pick this browser.
            The extension reads your bookmarks and hands them to SchnellBuch,
            and only to the address above.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          {canImport === false ? (
            <>
              <span className="text-muted-foreground text-sm">
                Needs access to {savedAddress}.
              </span>
              <Button onClick={allowImport} variant="outline">
                Allow access
              </Button>
            </>
          ) : null}
          {canImport ? (
            <span className="text-muted-foreground text-sm" role="status">
              Ready. Reload SchnellBuch's tab if it was already open.
            </span>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

function hasServerAccess(address: string) {
  return browser.permissions.contains({
    origins: [serverMatchPattern(address)],
  });
}

function requestServerAccess(address: string) {
  return browser.permissions
    .request({ origins: [serverMatchPattern(address)] })
    .catch(() => false);
}
