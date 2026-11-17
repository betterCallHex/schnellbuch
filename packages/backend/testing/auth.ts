import { internal } from "../convex/_generated/api";
import type { createTest } from "./convex";

type TestClient = ReturnType<typeof createTest>;

export function post(
  t: TestClient,
  path: string,
  body: unknown,
  cookie?: string
) {
  return t.fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

export function signInWith(t: TestClient, email: string, otp: string) {
  return post(t, "/api/auth/sign-in/email-otp", { email, otp, name: "Test" });
}

// Signs in (creating the account the first time) with a code issued the
// way a deployment's owner would, without email.
export async function signIn(t: TestClient, email: string) {
  const code = await t.action(internal.account.signInCode, { email });
  return signInWith(t, email, code);
}

export async function session(response: Response) {
  const { user } = (await response.json()) as { user: { id: string } };
  const cookie = response.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");
  return { userId: user.id, cookie };
}
