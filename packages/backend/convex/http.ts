import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { mcp } from "./mcp";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);
mcp.registerRoutes(http);

export default http;
