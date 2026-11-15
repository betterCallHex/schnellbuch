import betterAuth from "@convex-dev/better-auth/convex.config";
import mcp from "@convex-dev/mcp/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(betterAuth);
app.use(mcp);

export default app;
