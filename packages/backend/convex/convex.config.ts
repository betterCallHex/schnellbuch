import betterAuth from "@convex-dev/better-auth/convex.config";
import mcp from "@convex-dev/mcp/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(betterAuth);
app.use(mcp);
app.use(rateLimiter);
// Fetches of saved pages (titles, icons, link checks), a few at a time.
app.use(workpool, { name: "fetchPool" });

export default app;
