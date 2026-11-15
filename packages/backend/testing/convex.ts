import { convexTest } from "convex-test";
import schema from "../convex/schema";

const modules = import.meta.glob([
  "../convex/**/*.ts",
  "!../convex/**/*.test.ts",
]);

export function createTest() {
  return convexTest(schema, modules);
}
