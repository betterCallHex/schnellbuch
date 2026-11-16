import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { createEnv } from "@t3-oss/env-core";
import { backendEnvSchema } from "../convex/model/env";

const rootDir = join(import.meta.dirname, "..", "..", "..");
const envFile = join(rootDir, ".env.local");
const backendNames = Object.keys(backendEnvSchema);
const emptySecretLine = /^BETTER_AUTH_SECRET=$/mu;

createEnvFileOnce();
runConvex(["init"]);
pushBackendEnv(parseEnv(readFileSync(envFile, "utf8")));

function createEnvFileOnce() {
  if (existsSync(envFile)) {
    return;
  }
  const example = readFileSync(join(rootDir, ".env.example"), "utf8");
  const secret = randomBytes(32).toString("base64");
  writeFileSync(
    envFile,
    example.replace(emptySecretLine, `BETTER_AUTH_SECRET=${secret}`)
  );
  console.log("Created .env.local from .env.example.");
}

function pushBackendEnv(fileEnv: NodeJS.Dict<string>) {
  if (fileEnv.CONVEX_DEPLOY_KEY || process.env.CONVEX_DEPLOY_KEY) {
    throw new Error(
      "CONVEX_DEPLOY_KEY is set: the Convex CLI would target that deployment instead of your dev one. It belongs in Vercel's settings only; remove it from .env.local and your shell."
    );
  }
  createEnv({
    server: backendEnvSchema,
    runtimeEnv: fileEnv,
    isServer: true,
    emptyStringAsUndefined: true,
  });
  const filled = backendNames.filter((name) => fileEnv[name]);
  const empty = backendNames.filter((name) => !fileEnv[name]);
  runConvex(
    ["env", "set", "--force"],
    filled.map((name) => `${name}='${fileEnv[name]}'`).join("\n")
  );
  for (const name of empty) {
    runConvex(["env", "remove", name]);
  }
  console.log(`Convex dev deployment settings: ${backendNames.join(", ")}.`);
}

function runConvex(args: string[], input?: string) {
  const result = spawnSync("bunx", ["convex", ...args], {
    cwd: rootDir,
    input,
    stdio: [input === undefined ? "inherit" : "pipe", "inherit", "inherit"],
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
