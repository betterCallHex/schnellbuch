import { api } from "@schnellbuch/backend/api";
import { createFileRoute } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { BookmarkPlusIcon, CopyIcon, KeyRoundIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Toolbar } from "@/components/toolbar";
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
import { env } from "@/env";
import { bookmarkletHref } from "@/lib/bookmarklet";
import { errorMessage, succeeded } from "@/lib/errors";
import { claudeCodeCommand, mcpEndpoint } from "@/lib/mcp-config";

export const Route = createFileRoute("/_app/settings")({ component: Settings });

function Settings() {
  return (
    <>
      <Toolbar>
        <h1 className="truncate px-1.5 font-semibold">Settings</h1>
      </Toolbar>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
        <AgentAccess />
        <Bookmarklet />
      </div>
    </>
  );
}

function AgentAccess() {
  const connections = useQuery(api.mcp.listConnections, {});
  const createApiKey = useAction(api.mcp.createApiKey);
  const revokeConnection = useMutation(api.mcp.revokeConnection);
  const [newKey, setNewKey] = useState<string | null>(null);
  const endpoint = mcpEndpoint(env.VITE_CONVEX_SITE_URL);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const { apiKey } = await createApiKey({
        name: String(new FormData(form).get("name")),
      });
      setNewKey(apiKey);
      form.reset();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRoundIcon aria-hidden className="size-4" />
          Agent access (MCP)
        </CardTitle>
        <CardDescription>
          Paste this URL into Claude, ChatGPT, Cursor or any MCP client. You'll
          be asked to approve it here, and it can then read, add, move and
          delete your bookmarks.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Snippet label="MCP server URL" text={endpoint} />
        <form className="flex items-end gap-2" method="post" onSubmit={create}>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="key-name">API key for a CLI agent</Label>
            <Input
              id="key-name"
              name="name"
              placeholder="Claude Code on my laptop"
              required
            />
          </div>
          <Button type="submit">Create API key</Button>
        </form>
        {newKey ? (
          <>
            <p className="bg-primary/10 rounded-lg p-3 text-sm" role="status">
              Copy this key now. It won't be shown again.
            </p>
            <Snippet
              label="Claude Code"
              text={claudeCodeCommand(endpoint, newKey)}
            />
          </>
        ) : null}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Connected agents</span>
          <ul className="flex flex-col divide-y rounded-lg border">
            {connections?.length === 0 && (
              <li className="text-muted-foreground p-3 text-sm">
                No agents connected yet.
              </li>
            )}
            {connections?.map((connection) => (
              <li
                className="flex items-center gap-3 p-3 text-sm"
                key={connection.id}
              >
                <span className="min-w-0 flex-1 truncate">
                  {connection.name}
                  <span className="text-muted-foreground">
                    {" "}
                    · {connection.kind === "apiKey" ? "API key" : "Signed in"} ·{" "}
                    {connection.scopes.length > 0
                      ? connection.scopes.join(", ")
                      : "all tools"}
                  </span>
                </span>
                <Button
                  onClick={() =>
                    succeeded(revokeConnection({ id: connection.id }))
                  }
                  size="sm"
                  variant="destructive"
                >
                  Disconnect
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function Snippet({ label, text }: { label: string; text: string }) {
  async function copy() {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Button
          aria-label={`Copy ${label}`}
          onClick={copy}
          size="icon-sm"
          variant="ghost"
        >
          <CopyIcon />
        </Button>
      </div>
      <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">
        {text}
      </pre>
    </div>
  );
}

function Bookmarklet() {
  const href = bookmarkletHref(env.VITE_SITE_URL);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookmarkPlusIcon aria-hidden className="size-4" />
          Bookmarklet
        </CardTitle>
        <CardDescription>
          Drag this button to your bookmarks bar. Click it on any page to save
          that page. It works in every browser.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <a
          className="bg-primary text-primary-foreground inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium"
          href="/settings"
          onClick={(event) => {
            event.preventDefault();
            toast(
              "Drag the button to your bookmarks bar instead of clicking it."
            );
          }}
          ref={(element) => element?.setAttribute("href", href)}
        >
          <BookmarkPlusIcon aria-hidden className="size-4" />
          Save to SchnellBuch
        </a>
      </CardContent>
    </Card>
  );
}
