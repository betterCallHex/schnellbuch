import { api } from "../convex/_generated/api";
import type { createTest } from "./convex";

type TestClient = ReturnType<typeof createTest>;

// An agent connected with an API key for `subject`, calling tools through
// the real /mcp endpoint.
export async function connectAgent(
  t: TestClient,
  subject: string,
  scopes?: string[]
) {
  const { apiKey } = await t
    .withIdentity({ subject })
    .action(api.mcp.createApiKey, { name: "test", scopes });
  const request = (name: string, args: Record<string, unknown> = {}) =>
    t.fetch("/mcp", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "mcp-protocol-version": "2025-06-18",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const body = await (await request(name, args)).json();
    return body.result;
  };
  // structuredContent of a call that must succeed.
  const ok = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await call(name, args);
    if (!result || result.isError) {
      throw new Error(
        `${name} failed: ${JSON.stringify(result?.content ?? result)}`
      );
    }
    return result.structuredContent;
  };
  return { request, call, ok };
}
