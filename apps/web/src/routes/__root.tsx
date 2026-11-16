import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouteContext,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ConvexReactClient } from "convex/react";
import { type ReactNode, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { authClient } from "@/lib/auth-client";
import { getToken } from "@/lib/auth-server";
import { recallLastUser } from "@/lib/mirror-store";
import {
  isOffline,
  registerServiceWorker,
  useWatchConnection,
} from "@/lib/offline";
import appCss from "../styles.css?url";

const fetchToken = createServerFn({ method: "GET" }).handler(
  async () => (await getToken()) ?? null
);

let browserToken: string | null | undefined;

export const Route = createRootRouteWithContext<{
  convex: ConvexReactClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0a0a0a" },
      { title: "SchnellBuch" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  beforeLoad: async () => {
    const token = await readToken();
    return {
      token,
      // Offline, the session can't be checked; the last user's mirrored
      // library opens read-only instead.
      offlineUserId:
        token === null && isOffline() ? recallLastUser() : undefined,
    };
  },
  component: RootComponent,
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
});

async function readToken() {
  const inBrowser = typeof document !== "undefined";
  if (inBrowser && browserToken !== undefined) {
    return browserToken;
  }
  let token: string | null;
  try {
    token = await fetchToken();
  } catch (error) {
    if (isOffline()) {
      return null;
    }
    throw error;
  }
  if (inBrowser) {
    browserToken = token;
  }
  return token;
}

function ConnectionWatcher() {
  useWatchConnection();
  useEffect(registerServiceWorker, []);
  return null;
}

function RootComponent() {
  const { convex, token } = useRouteContext({ from: Route.id });
  return (
    <ConvexBetterAuthProvider
      authClient={authClient}
      client={convex}
      initialToken={token}
    >
      <ConnectionWatcher />
      <Outlet />
      <Toaster position="bottom-center" />
    </ConvexBetterAuthProvider>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <main className="mx-auto max-w-md p-8 text-sm">
      <h1 className="font-medium">Page not found</h1>
      <a className="text-muted-foreground underline" href="/">
        Back to your bookmarks
      </a>
    </main>
  );
}
