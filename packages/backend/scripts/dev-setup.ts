import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";
import { backendEnvSchema } from "../convex/model/env";

const rootDir = join(import.meta.dirname, "..", "..", "..");
const envFile = join(rootDir, ".env.local");
const backendNames = Object.keys(backendEnvSchema) as Array<
  keyof typeof backendEnvSchema
>;
const emptySecretLine = /^BETTER_AUTH_SECRET=$/mu;
const forbiddenDeployKey = z.undefined({
  error:
    "CONVEX_DEPLOY_KEY belongs in Vercel's settings only: the Convex CLI would target that deployment instead of your dev one.",
});

createEnv({
  server: { CONVEX_DEPLOY_KEY: forbiddenDeployKey },
  runtimeEnv: process.env,
  isServer: true,
  emptyStringAsUndefined: true,
});
createEnvFileOnce();
const settings = createEnv({
  server: { ...backendEnvSchema, CONVEX_DEPLOY_KEY: forbiddenDeployKey },
  runtimeEnv: parseEnv(readFileSync(envFile, "utf8")),
  isServer: true,
  emptyStringAsUndefined: true,
});
runConvex(["init"]);
pushBackendSettings();

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

function pushBackendSettings() {
  const filled = backendNames.filter((name) => settings[name] !== undefined);
  const empty = backendNames.filter((name) => settings[name] === undefined);
  runConvex(
    ["env", "set", "--force"],
    filled.map((name) => `${name}='${settings[name]}'`).join("\n")
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
