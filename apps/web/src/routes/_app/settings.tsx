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
import {
  claudeCodeCommand,
  mcpEndpoint,
  mcpJsonConfig,
} from "@/lib/mcp-config";

export const Route = createFileRoute("/_app/settings")({ component: Settings });

const TOKEN_PLACEHOLDER = "<your token>";

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
  const tokens = useQuery(api.tokens.list, {});
  const createToken = useAction(api.tokens.create);
  const revokeToken = useMutation(api.tokens.revoke);
  const [newToken, setNewToken] = useState<string | null>(null);
  const endpoint = mcpEndpoint(env.VITE_CONVEX_SITE_URL);
  const shownToken = newToken ?? TOKEN_PLACEHOLDER;

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      setNewToken(
        await createToken({ name: String(new FormData(form).get("name")) })
      );
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
          Give Claude, Cursor or any MCP client a token, and it can read, add,
          move and delete your bookmarks.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form className="flex items-end gap-2" onSubmit={create}>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="token-name">New token name</Label>
            <Input
              id="token-name"
              name="name"
              placeholder="Claude Code on my laptop"
              required
            />
          </div>
          <Button type="submit">Create token</Button>
        </form>
        {newToken ? (
          <p className="bg-primary/10 rounded-lg p-3 text-sm" role="status">
            Copy your token now. It won't be shown again.
          </p>
        ) : null}
        <Snippet
          label="Claude Code"
          text={claudeCodeCommand(endpoint, shownToken)}
        />
        <Snippet
          label="Other MCP clients (JSON config)"
          text={mcpJsonConfig(endpoint, shownToken)}
        />
        <ul className="flex flex-col divide-y rounded-lg border">
          {tokens?.length === 0 && (
            <li className="text-muted-foreground p-3 text-sm">
              No tokens yet.
            </li>
          )}
          {tokens?.map((token) => (
            <li className="flex items-center gap-3 p-3 text-sm" key={token._id}>
              <span className="min-w-0 flex-1 truncate">{token.name}</span>
              <code className="text-muted-foreground text-xs">
                {token.preview}
              </code>
              <Button
                onClick={() => succeeded(revokeToken({ tokenId: token._id }))}
                size="sm"
                variant="destructive"
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
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
