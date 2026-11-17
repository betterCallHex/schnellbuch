import { type SpawnOptions, spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";
import {
  portsFor,
  SLOT_COUNT,
  type StackPorts,
  slotFor,
  stackName,
} from "./ports";

const VERSION_URL = "https://version.convex.dev/v1/local_backend_version";
const RELEASES_URL =
  "https://github.com/get-convex/convex-backend/releases/download";
const BACKEND_START_TIMEOUT_MS = 60_000;
const WEB_START_TIMEOUT_MS = 120_000;
const POLL_MS = 500;
const SLOT_ATTEMPTS = 20;
const SECRET_BYTES = 32;
const PRIVATE_FILE = 0o600;

export interface Account {
  apiKey?: string;
  email: string;
  userId?: string;
}

export interface StackState {
  accounts: Account[];
  adminKey?: string;
  authSecret: string;
  binary?: string;
  instanceSecret: string;
  name: string;
  pids: { backend?: number; web?: number };
  ports: StackPorts;
  seeded: boolean;
  slot: number;
}

const repoRoot = (
  spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" })
    .stdout || process.cwd()
).trim();
const backendDir = join(repoRoot, "packages", "backend");
const webDir = join(repoRoot, "apps", "web");

const env = createEnv({
  server: { XDG_CACHE_HOME: z.string().optional() },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

function cacheRoot() {
  return env.XDG_CACHE_HOME ?? join(homedir(), ".cache");
}

// Outside the repo, so keys and data never end up in git.
export function stateDir(name = stackName(repoRoot)) {
  return join(cacheRoot(), "schnellbuch", "dev-verify", name);
}

export function urls(ports: StackPorts) {
  return {
    backend: `http://127.0.0.1:${ports.backend}`,
    site: `http://127.0.0.1:${ports.site}`,
    web: `http://localhost:${ports.web}`,
  };
}

export async function loadOrCreateState(): Promise<StackState> {
  const file = join(stateDir(), "state.json");
  if (existsSync(file)) {
    return JSON.parse(readFileSync(file, "utf8")) as StackState;
  }
  const slot = await freeSlot(slotFor(repoRoot));
  return {
    name: stackName(repoRoot),
    slot,
    ports: portsFor(slot),
    instanceSecret: randomBytes(SECRET_BYTES).toString("hex"),
    authSecret: randomBytes(SECRET_BYTES).toString("base64"),
    seeded: false,
    accounts: ["ada", "bob"].map((name) => ({
      email: `${name}@schnellbuch.test`,
    })),
    pids: {},
  };
}

export function saveState(state: StackState) {
  mkdirSync(stateDir(state.name), { recursive: true });
  writePrivate(
    join(stateDir(state.name), "state.json"),
    JSON.stringify(state, null, 2)
  );
}

export function writePrivate(path: string, text: string) {
  writeFileSync(path, text, { mode: PRIVATE_FILE });
  chmodSync(path, PRIVATE_FILE);
}

async function freeSlot(preferred: number) {
  for (let attempt = 0; attempt < SLOT_ATTEMPTS; attempt += 1) {
    const slot = (preferred + attempt) % SLOT_COUNT;
    const ports = portsFor(slot);
    // biome-ignore lint/performance/noAwaitInLoops: slots are tried one at a time, stopping at the first free one
    const free = await Promise.all(
      [ports.backend, ports.site, ports.web].map(isPortFree)
    );
    if (free.every(Boolean)) {
      return slot;
    }
  }
  throw new Error("No free ports for a dev stack in 20000-29999.");
}

function isPortFree(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = createServer();
    server.on("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

// The same binary the Convex CLI runs for local deployments.
export async function ensureBackendBinary() {
  const dir = join(cacheRoot(), "schnellbuch", "convex-local-backend");
  const version = await latestVersion(dir);
  const binary = join(dir, version, "convex-local-backend");
  if (existsSync(binary)) {
    return binary;
  }
  const asset = assetName();
  console.log(`Downloading the Convex local backend (${version})…`);
  const response = await fetch(`${RELEASES_URL}/${version}/${asset}`);
  if (!response.ok) {
    throw new Error(
      `Couldn't download ${asset} (${response.status}). Is github.com reachable?`
    );
  }
  mkdirSync(join(dir, version), { recursive: true });
  const zip = join(dir, version, asset);
  writeFileSync(zip, new Uint8Array(await response.arrayBuffer()));
  run("unzip", ["-o", "-q", zip, "-d", join(dir, version)]);
  rmSync(zip);
  chmodSync(binary, 0o755);
  return binary;
}

async function latestVersion(dir: string) {
  try {
    const response = await fetch(VERSION_URL, {
      signal: AbortSignal.timeout(10_000),
    });
    const { version } = (await response.json()) as { version?: string };
    if (version) {
      return version;
    }
  } catch {
    // Offline: fall back to the newest binary already downloaded.
  }
  const cached = existsSync(dir) ? readdirSync(dir).toSorted().at(-1) : null;
  if (!cached) {
    throw new Error(
      "Couldn't find the latest Convex local backend version (version.convex.dev unreachable) and none is cached."
    );
  }
  return cached;
}

function assetName() {
  const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
  if (process.platform === "darwin") {
    return `convex-local-backend-${arch}-apple-darwin.zip`;
  }
  if (process.platform === "linux") {
    return `convex-local-backend-${arch}-unknown-linux-gnu.zip`;
  }
  throw new Error(
    `dev:verify supports macOS and Linux, not ${process.platform}.`
  );
}

export async function isBackendUp(state: StackState) {
  try {
    const response = await fetch(`${urls(state.ports).backend}/instance_name`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok && (await response.text()).trim() === state.name;
  } catch {
    return false;
  }
}

export async function startBackend(state: StackState, binary: string) {
  const dir = stateDir(state.name);
  mkdirSync(join(dir, "storage"), { recursive: true });
  state.adminKey ??= run(binary, [
    "keygen",
    "admin-key",
    "--instance-name",
    state.name,
    "--instance-secret",
    state.instanceSecret,
  ]).trim();
  state.binary = binary;
  state.pids.backend = startDetached(
    binary,
    [
      join(dir, "convex_local_backend.sqlite3"),
      "--interface",
      "127.0.0.1",
      "--port",
      String(state.ports.backend),
      "--site-proxy-port",
      String(state.ports.site),
      "--instance-name",
      state.name,
      "--instance-secret",
      state.instanceSecret,
      "--local-storage",
      join(dir, "storage"),
      "--disable-beacon",
    ],
    { cwd: dir },
    join(dir, "backend.log")
  );
  await waitFor(
    () => isBackendUp(state),
    BACKEND_START_TIMEOUT_MS,
    `The backend didn't start. See ${join(dir, "backend.log")}`
  );
}

export function convexCli(state: StackState, args: string[]) {
  return run("bunx", ["convex", ...args], {
    cwd: backendDir,
    env: {
      ...process.env,
      CONVEX_DEPLOYMENT: "",
      CONVEX_SELF_HOSTED_URL: urls(state.ports).backend,
      CONVEX_SELF_HOSTED_ADMIN_KEY: state.adminKey ?? "",
    },
  });
}

export function configureBackend(state: StackState) {
  const { web } = urls(state.ports);
  const settings = {
    BETTER_AUTH_SECRET: state.authSecret,
    SITE_URL: web,
    MCP_CONSENT_URL: `${web}/connect`,
    SIGNUP_ALLOWED_EMAILS: "@schnellbuch.test",
  };
  for (const [name, value] of Object.entries(settings)) {
    convexCli(state, ["env", "set", name, value]);
  }
  console.log("Pushing Convex functions…");
  const strayEnvFile = join(backendDir, ".env.local");
  try {
    convexCli(state, ["dev", "--once", "--typecheck", "disable"]);
  } finally {
    rmSync(strayEnvFile, { force: true });
  }
}

export async function isWebUp(state: StackState) {
  try {
    const response = await fetch(`${urls(state.ports).web}/sign-in`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function startWeb(state: StackState) {
  const dir = stateDir(state.name);
  const { backend, site, web } = urls(state.ports);
  state.pids.web = startDetached(
    "bun",
    ["run", "dev"],
    {
      cwd: webDir,
      env: {
        ...process.env,
        CONVEX_DEPLOYMENT: "",
        PORT: String(state.ports.web),
        VITE_CONVEX_URL: backend,
        VITE_CONVEX_SITE_URL: site,
        VITE_SITE_URL: web,
      },
    },
    join(dir, "web.log")
  );
  await waitFor(
    () => isWebUp(state),
    WEB_START_TIMEOUT_MS,
    `The web app didn't start. See ${join(dir, "web.log")}`
  );
}

export async function stopStack(state: StackState) {
  for (const pid of [state.pids.web, state.pids.backend]) {
    if (pid) {
      killGroup(pid);
    }
  }
  state.pids = {};
  await waitFor(
    async () => !((await isBackendUp(state)) || (await isWebUp(state))),
    15_000,
    "The stack didn't stop."
  );
}

export function wipeData(state: StackState) {
  const dir = stateDir(state.name);
  rmSync(join(dir, "convex_local_backend.sqlite3"), { force: true });
  rmSync(join(dir, "storage"), { recursive: true, force: true });
  state.seeded = false;
  state.adminKey = undefined;
  for (const account of state.accounts) {
    account.userId = undefined;
    account.apiKey = undefined;
  }
}

function killGroup(pid: number) {
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    // Already stopped.
  }
}

function startDetached(
  command: string,
  args: string[],
  options: SpawnOptions,
  logFile: string
) {
  const log = openSync(logFile, "a");
  const child = spawn(command, args, {
    ...options,
    detached: true,
    stdio: ["ignore", log, log],
  });
  child.unref();
  if (!child.pid) {
    throw new Error(`Couldn't start ${command}.`);
  }
  return child.pid;
}

function run(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
) {
  const result = spawnSync(command, args, { ...options, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.slice(0, 2).join(" ")} failed:\n${result.stderr || result.stdout}`
    );
  }
  return result.stdout;
}

async function waitFor(
  check: () => Promise<boolean>,
  timeoutMs: number,
  message: string
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // biome-ignore lint/performance/noAwaitInLoops: polling until the service answers
    if (await check()) {
      return;
    }
    await sleep(POLL_MS);
  }
  throw new Error(message);
}
