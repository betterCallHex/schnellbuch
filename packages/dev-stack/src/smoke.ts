// Production smoke check: bun run smoke. Reads the site and MCP URLs (and,
// optionally, an account and an MCP key) from the environment; never
// changes data.
import { api } from "@schnellbuch/backend/api";
import { createEnv } from "@t3-oss/env-core";
import { ConvexHttpClient } from "convex/browser";
import * as z from "zod";

const env = createEnv({
  server: {
    SMOKE_SITE_URL: z.url(),
    SMOKE_CONVEX_URL: z.url(),
    SMOKE_MCP_URL: z.url(),
    SMOKE_EMAIL: z.string().optional(),
    SMOKE_PASSWORD: z.string().optional(),
    SMOKE_MCP_KEY: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

const FRAME_ANCESTORS_NONE = "frame-ancestors 'none'";
const results: { check: string; ok: boolean; detail: string }[] = [];

async function check(name: string, run: () => Promise<string>) {
  try {
    results.push({ check: name, ok: true, detail: await run() });
  } catch (error) {
    results.push({
      check: name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function expect(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function mcpRequest(method: string, key?: string) {
  return fetch(env.SMOKE_MCP_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-06-18",
      ...(key ? { authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method }),
  });
}

async function signIn() {
  const response = await fetch(`${env.SMOKE_SITE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: env.SMOKE_SITE_URL },
    body: JSON.stringify({
      email: env.SMOKE_EMAIL,
      password: env.SMOKE_PASSWORD,
    }),
  });
  expect(response.ok, `sign-in answered ${response.status}`);
  return response.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");
}

await check("sign-in page loads", async () => {
  const response = await fetch(`${env.SMOKE_SITE_URL}/sign-in`);
  expect(response.ok, `status ${response.status}`);
  return `${response.status}`;
});

await check("installable: manifest and service worker", async () => {
  const [manifest, worker] = await Promise.all([
    fetch(`${env.SMOKE_SITE_URL}/manifest.json`),
    fetch(`${env.SMOKE_SITE_URL}/service-worker.js`),
  ]);
  expect(manifest.ok && worker.ok, `${manifest.status} / ${worker.status}`);
  return "both 200";
});

await check("MCP refuses calls without credentials", async () => {
  const response = await mcpRequest("tools/list");
  expect(response.status === 401, `status ${response.status}`);
  expect(
    response.headers
      .get("www-authenticate")
      ?.includes("oauth-protected-resource") ?? false,
    "no WWW-Authenticate pointing to OAuth"
  );
  return "401 with OAuth discovery";
});

if (env.SMOKE_MCP_KEY) {
  await check("MCP tools/list answers", async () => {
    const response = await mcpRequest("tools/list", env.SMOKE_MCP_KEY);
    const body = (await response.json()) as {
      result?: { tools?: { name: string }[] };
    };
    const names = body.result?.tools?.map((tool) => tool.name) ?? [];
    expect(names.includes("list_folders"), `tools: ${names.join(", ")}`);
    return `${names.length} tools`;
  });
}

if (env.SMOKE_EMAIL && env.SMOKE_PASSWORD) {
  await check("sign in and see the library", async () => {
    const cookie = await signIn();
    const tokenResponse = await fetch(
      `${env.SMOKE_SITE_URL}/api/auth/convex/token`,
      { headers: { cookie } }
    );
    const { token } = (await tokenResponse.json()) as { token?: string };
    expect(Boolean(token), "no Convex token");
    const client = new ConvexHttpClient(env.SMOKE_CONVEX_URL);
    client.setAuth(token ?? "");
    const [folders, bookmarks] = await Promise.all([
      client.query(api.folders.list, {}),
      client.query(api.bookmarks.list, {}),
    ]);
    const connect = await fetch(`${env.SMOKE_SITE_URL}/connect`, {
      headers: { cookie },
    });
    expect(
      connect.headers
        .get("content-security-policy")
        ?.includes(FRAME_ANCESTORS_NONE) ?? false,
      "/connect is missing frame-ancestors 'none'"
    );
    return `${folders.length} folders, ${bookmarks.length} bookmarks; /connect can't be framed`;
  });
} else {
  await check("/connect can't be framed", async () => {
    const response = await fetch(`${env.SMOKE_SITE_URL}/connect`, {
      redirect: "manual",
    });
    const policy = response.headers.get("content-security-policy") ?? "";
    expect(policy.includes(FRAME_ANCESTORS_NONE), `got "${policy}"`);
    return FRAME_ANCESTORS_NONE;
  });
}

for (const { check: name, ok, detail } of results) {
  console.log(`${ok ? "✓" : "✗"} ${name}: ${detail}`);
}
process.exitCode = results.every((result) => result.ok) ? 0 : 1;
