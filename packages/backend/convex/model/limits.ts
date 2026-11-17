import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError } from "convex/values";
import { components } from "../_generated/api";

// Limits on things that cost real work: password checks (slow on purpose),
// imports and background link checks.
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Sign-in and sign-up attempts per email address.
  passwordAttempt: {
    kind: "token bucket",
    rate: 10,
    period: 15 * MINUTE,
    capacity: 10,
  },
  importFile: { kind: "token bucket", rate: 6, period: HOUR, capacity: 3 },
  checkLinks: { kind: "token bucket", rate: 20, period: HOUR, capacity: 5 },
});

type LimitName = "passwordAttempt" | "importFile" | "checkLinks";
type LimitCtx = Parameters<typeof rateLimiter.limit>[0];

// How long until the limit lets this through again, or undefined if it
// already does. Consumes one unit when it does.
export async function waitBefore(ctx: LimitCtx, name: LimitName, key: string) {
  const { ok, retryAfter } = await rateLimiter.limit(ctx, name, { key });
  return ok ? undefined : retryAfter;
}

export function tryAgainIn(retryAfterMs: number) {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / MINUTE));
  return minutes === 1
    ? "Try again in a minute."
    : `Try again in ${minutes} minutes.`;
}

export async function enforceLimit(
  ctx: LimitCtx,
  name: Exclude<LimitName, "passwordAttempt">,
  key: string,
  what: string
) {
  const wait = await waitBefore(ctx, name, key);
  if (wait !== undefined) {
    throw new ConvexError(
      `Too many ${what} in a short time. ${tryAgainIn(wait)}`
    );
  }
}
