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
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { authClient } from "@/lib/auth-client";
import { getToken } from "@/lib/auth-server";
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
      { rel: "icon", href: "/favicon.ico" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  beforeLoad: async () => ({ token: await readToken() }),
  component: RootComponent,
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
});

async function readToken() {
  const inBrowser = typeof document !== "undefined";
  if (inBrowser && browserToken !== undefined) {
    return browserToken;
  }
  const token = await fetchToken();
  if (inBrowser) {
    browserToken = token;
  }
  return token;
}

function RootComponent() {
  const { convex, token } = useRouteContext({ from: Route.id });
  return (
    <ConvexBetterAuthProvider
      authClient={authClient}
      client={convex}
      initialToken={token}
    >
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
