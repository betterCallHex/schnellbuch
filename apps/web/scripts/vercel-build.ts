// Vercel's build. With CONVEX_DEPLOY_KEY set (Production, or Preview with a
// Convex preview deploy key) it deploys the Convex functions first and
// builds the site against that deployment, so both ship from one commit.
// Without one (Preview pointed at the dev deployment) it only builds the
// site, using VITE_CONVEX_URL from Vercel's Preview environment.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

const env = createEnv({
  server: { CONVEX_DEPLOY_KEY: z.string().optional() },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

const webDir = join(import.meta.dirname, "..");
const backendDir = join(webDir, "..", "..", "packages", "backend");

const [command, args, cwd] = env.CONVEX_DEPLOY_KEY
  ? [
      "bunx",
      [
        "convex",
        "deploy",
        "--cmd",
        `bun run --cwd ${webDir} build`,
        "--cmd-url-env-var-name",
        "VITE_CONVEX_URL",
      ],
      backendDir,
    ]
  : ["bun", ["run", "build"], webDir];

const result = spawnSync(command, args, { cwd, stdio: "inherit" });
process.exit(result.status ?? 1);
