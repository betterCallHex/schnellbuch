import { createRouter } from "@tanstack/react-router";
import { ConvexReactClient } from "convex/react";
import { env } from "./env";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    context: {
      convex: new ConvexReactClient(env.VITE_CONVEX_URL, { expectAuth: true }),
    },
    defaultPreload: "intent",
    scrollRestoration: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
