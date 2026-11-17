import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "prune old agent changes and imports",
  { hourUTC: 3, minuteUTC: 17 },
  internal.housekeeping.pruneHistory,
  {}
);

export default crons;
