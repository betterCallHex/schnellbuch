import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import { handleMcp } from "./mcp";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({ path: "/mcp", method: "POST", handler: handleMcp });

const methodNotAllowed = httpAction(() =>
  Promise.resolve(
    new Response(null, { status: 405, headers: { Allow: "POST" } })
  )
);
http.route({ path: "/mcp", method: "GET", handler: methodNotAllowed });
http.route({ path: "/mcp", method: "DELETE", handler: methodNotAllowed });

export default http;
