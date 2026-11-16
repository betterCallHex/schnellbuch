import { join } from "node:path";
import { seedAccounts } from "./seed";
import {
  configureBackend,
  ensureBackendBinary,
  isBackendUp,
  isWebUp,
  loadOrCreateState,
  type StackState,
  saveState,
  startBackend,
  startWeb,
  stateDir,
  stopStack,
  urls,
  wipeData,
  writePrivate,
} from "./stack";

const USAGE = `bun run dev:verify [up|down|reseed|status]

  up      (default) start this worktree's backend and web app, seed two
          accounts and print how to sign in and an MCP key for each
  down    stop this worktree's stack, keeping its data
  reseed  stop, delete this worktree's data, and start fresh
  status  say whether the stack is running`;

async function up(state: StackState) {
  if (!(await isBackendUp(state))) {
    await startBackend(state, await ensureBackendBinary());
  }
  saveState(state);
  configureBackend(state);
  if (!(await isWebUp(state))) {
    console.log("Starting the web app…");
    await startWeb(state);
  }
  saveState(state);
  await seedAccounts(state);
  saveState(state);
  writeEnvFile(state);
  printSummary(state);
}

function writeEnvFile(state: StackState) {
  const { backend, site, web } = urls(state.ports);
  const [ada, bob] = state.accounts;
  const lines = {
    SCHNELLBUCH_WEB_URL: web,
    SCHNELLBUCH_MCP_URL: `${site}/mcp`,
    VITE_CONVEX_URL: backend,
    VITE_CONVEX_SITE_URL: site,
    CONVEX_DEPLOYMENT: "",
    CONVEX_SELF_HOSTED_URL: backend,
    CONVEX_SELF_HOSTED_ADMIN_KEY: state.adminKey ?? "",
    ADA_EMAIL: ada?.email ?? "",
    ADA_PASSWORD: ada?.password ?? "",
    ADA_USER_ID: ada?.userId ?? "",
    ADA_MCP_KEY: ada?.apiKey ?? "",
    BOB_EMAIL: bob?.email ?? "",
    BOB_PASSWORD: bob?.password ?? "",
    BOB_USER_ID: bob?.userId ?? "",
    BOB_MCP_KEY: bob?.apiKey ?? "",
  };
  writePrivate(
    join(stateDir(state.name), "env.sh"),
    `${Object.entries(lines)
      .map(([name, value]) => `export ${name}='${value}'`)
      .join("\n")}\n`
  );
}

function printSummary(state: StackState) {
  const { backend, site, web } = urls(state.ports);
  const envFile = join(stateDir(state.name), "env.sh");
  console.log(`
SchnellBuch dev stack "${state.name}" is up.

  App      ${web}
  Backend  ${backend}
  MCP      ${site}/mcp

Sign in at ${web}/sign-in as:
${state.accounts
  .map(
    (account) =>
      `  ${account.email}  password ${account.password}\n    user ${account.userId}  MCP key ${account.apiKey}`
  )
  .join("\n")}

Everything above, as shell variables: source ${envFile}
  (then, e.g., curl -s "$SCHNELLBUCH_MCP_URL" -H "Authorization: Bearer $ADA_MCP_KEY" ...)

Stop with: bun run dev:verify down`);
}

async function main() {
  const command = process.argv[2] ?? "up";
  const state = await loadOrCreateState();
  switch (command) {
    case "up":
      await up(state);
      return;
    case "down":
      await stopStack(state);
      saveState(state);
      console.log(`Stopped "${state.name}". Its data is kept.`);
      return;
    case "reseed":
      await stopStack(state);
      wipeData(state);
      await up(state);
      return;
    case "status": {
      const [backendUp, webUp] = await Promise.all([
        isBackendUp(state),
        isWebUp(state),
      ]);
      console.log(
        `"${state.name}": backend ${backendUp ? "up" : "down"} on ${urls(state.ports).backend}, web ${webUp ? "up" : "down"} on ${urls(state.ports).web}`
      );
      return;
    }
    default:
      console.log(USAGE);
      process.exitCode = command === "help" ? 0 : 1;
  }
}

await main();
