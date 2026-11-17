import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

// Background fetches of saved pages run a few jobs at a time, however many
// bookmarks an import or a link check queues at once.
export const fetchPool = new Workpool(components.fetchPool, {
  maxParallelism: 3,
  logLevel: "WARN",
});
