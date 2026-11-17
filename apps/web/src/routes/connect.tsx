import { api } from "@schnellbuch/backend/api";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { type FormEvent, useState } from "react";
import * as z from "zod";
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
import { errorMessage } from "@/lib/errors";
import { optionalText } from "@/lib/search-params";
import { securityHeaders } from "@/lib/security-headers";

export const Route = createFileRoute("/connect")({
  validateSearch: z.object({ request: optionalText }),
  beforeLoad: ({ context, location }) => {
    if (!context.token) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
  },
  // The root route's headers already forbid framing; repeated here so this
  // page never loses them.
  headers: () => securityHeaders(env.VITE_CONVEX_URL, env.VITE_CONVEX_SITE_URL),
  component: Connect,
});

function Connect() {
  const { request } = Route.useSearch();
  const [requestId, setRequestId] = useState(request);
  if (typeof window !== "undefined" && window.top !== window.self) {
    return (
      <Panel
        description="For your security, agents can't be approved inside another site."
        title="Open this page directly"
      />
    );
  }
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      {requestId ? (
        <Approve requestId={requestId} />
      ) : (
        <EnterCode onFound={setRequestId} />
      )}
    </main>
  );
}

function EnterCode({ onFound }: { onFound: (requestId: string) => void }) {
  const findRequest = useMutation(api.mcp.findAuthRequest);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const userCode = String(
      new FormData(event.currentTarget).get("code")
    ).trim();
    try {
      const found = await findRequest({ userCode });
      if (found) {
        onFound(found);
        return;
      }
      setError("That code isn't valid or has expired.");
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Connect an agent</CardTitle>
        <CardDescription>
          Enter the code your agent is showing you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" method="post" onSubmit={submit}>
          <Label htmlFor="user-code">Code</Label>
          <Input
            autoComplete="off"
            id="user-code"
            name="code"
            placeholder="ABCD-EFGH"
            required
          />
          <p className="text-destructive min-h-5 text-sm" role="alert">
            {error}
          </p>
          <Button type="submit">Continue</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Approve({ requestId }: { requestId: string }) {
  const request = useQuery(api.mcp.getAuthRequest, { requestId });
  const authorize = useAction(api.mcp.authorize);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<"approved" | "denied" | null>(null);
  const [error, setError] = useState<string>();

  if (outcome) {
    return outcome === "approved" ? (
      <Panel
        description="You can go back to your agent now. Disconnect it any time in SchnellBuch's Settings."
        title="Connected"
      />
    ) : (
      <Panel description="Your agent was not given access." title="Denied" />
    );
  }
  if (request === undefined) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }
  if (request === null || request.status !== "pending") {
    return (
      <Panel
        description="Start connecting again from your agent."
        title="This link has expired"
      />
    );
  }

  const isDevice = request.kind === "device";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(undefined);
    try {
      const { redirectUrl } = await authorize({
        requestId,
        approve,
        ...(isDevice && approve ? { userCode: request?.userCode } : {}),
      });
      if (redirectUrl) {
        window.location.assign(redirectUrl);
        return;
      }
      setOutcome(approve ? "approved" : "denied");
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Connect an agent?</CardTitle>
        <CardDescription>
          <strong className="text-foreground">
            {request.clientName ?? "An MCP client"}
          </strong>{" "}
          (name not verified) wants to use SchnellBuch for you. It will be able
          to:
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <ul className="list-disc pl-5">
          {request.scopes.map((scope) => (
            <li key={scope.name}>{scope.description}</li>
          ))}
        </ul>
        {isDevice ? (
          <DeviceCheck
            confirmed={confirmed}
            onConfirmedChange={setConfirmed}
            userCode={request.userCode ?? ""}
          />
        ) : (
          <RedirectNotice redirectUri={request.redirectUri} />
        )}
        <p className="text-destructive min-h-5" role="alert">
          {error}
        </p>
        <div className="flex justify-end gap-2">
          <Button
            disabled={busy}
            onClick={() => decide(false)}
            variant="outline"
          >
            Deny
          </Button>
          <Button
            disabled={busy || (isDevice && !confirmed)}
            onClick={() => decide(true)}
          >
            Allow
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RedirectNotice({ redirectUri }: { redirectUri?: string | null }) {
  const target = redirectUri ? URL.parse(redirectUri) : null;
  if (!target) {
    return (
      <p className="text-muted-foreground">You'll go back to your agent.</p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground">
        You'll be sent back to{" "}
        <code className="text-foreground font-semibold">{target.host}</code>.
      </p>
      <p className="text-muted-foreground text-xs break-all">
        Full address: {target.href}
      </p>
      {isLoopback(target.hostname) ? (
        <p className="bg-muted rounded-lg p-2">
          This address is on your own computer. Any program running there can
          receive this approval, so only allow it if you just started connecting
          an agent on this machine.
        </p>
      ) : null}
    </div>
  );
}

const LOOPBACK_HOSTS = new Set(["localhost", "[::1]", "::1"]);

function isLoopback(hostname: string) {
  return (
    LOOPBACK_HOSTS.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.startsWith("127.")
  );
}

function DeviceCheck({
  userCode,
  confirmed,
  onConfirmedChange,
}: {
  userCode: string;
  confirmed: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <p>
        Your agent should be showing this code:{" "}
        <code className="bg-muted rounded px-1.5 py-0.5 font-semibold tracking-widest">
          {userCode}
        </code>
      </p>
      <label className="flex items-center gap-2">
        <input
          checked={confirmed}
          onChange={(event) => onConfirmedChange(event.target.checked)}
          type="checkbox"
        />
        I started this from my own agent, and it shows the same code.
      </label>
      <p className="text-muted-foreground">
        If someone sent you this link, deny it.
      </p>
    </div>
  );
}

function Panel({ title, description }: { title: string; description: string }) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
