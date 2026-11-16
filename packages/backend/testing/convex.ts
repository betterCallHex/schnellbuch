import betterAuthComponent from "@convex-dev/better-auth/test";
import mcpComponent from "@convex-dev/mcp/test";
import { convexTest } from "convex-test";
import schema from "../convex/schema";

const modules = import.meta.glob([
  "../convex/**/*.ts",
  "!../convex/**/*.test.ts",
]);

export function createTest() {
  const t = convexTest(schema, modules);
  betterAuthComponent.register(t);
  mcpComponent.register(t);
  return t;
}
