// SIGNUP_ALLOWED_EMAILS: comma-separated addresses (`me@example.com`) or
// whole domains (`@example.com`), matched case-insensitively. Empty or unset
// closes sign-ups. Existing accounts are never affected: this only runs when
// Better Auth is about to create a user.
export const SIGNUPS_CLOSED = {
  code: "SIGNUPS_CLOSED",
  message: "Sign-ups are closed.",
} as const;

export function parseAllowList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

export function isSignupAllowed(email: string, allowList: string[]) {
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf("@");
  if (at <= 0) {
    return false;
  }
  const domain = address.slice(at);
  return allowList.some((entry) => entry === address || entry === domain);
}
