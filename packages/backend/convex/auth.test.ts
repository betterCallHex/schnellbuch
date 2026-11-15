import { afterEach, describe, expect, test as it, vi } from "vitest";
import { createTest } from "../testing/convex";

type TestClient = ReturnType<typeof createTest>;

const PASSWORD = "correct horse battery";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("sign-up allow-list", () => {
  it("an allowed address can create an account", async () => {
    const t = createTest();

    const response = await signUp(t, "owner@example.com");

    expect(response.status).toBe(200);
  });

  it("a different case of an allowed address matches", async () => {
    const t = createTest();

    const response = await signUp(t, "OWNER@example.COM");

    expect(response.status).toBe(200);
  });

  it("anyone at an allowed domain can create an account", async () => {
    const t = createTest();

    const response = await signUp(t, "kid@Family.test");

    expect(response.status).toBe(200);
  });

  it("an address not on the list is refused with a stable code", async () => {
    const t = createTest();

    const response = await signUp(t, "stranger@example.com");

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: "SIGNUPS_CLOSED",
      message: "Sign-ups are closed.",
    });
    expect((await signIn(t, "stranger@example.com")).status).toBe(401);
  });

  it("an empty list closes sign-ups", async () => {
    vi.stubEnv("SIGNUP_ALLOWED_EMAILS", "");
    vi.resetModules();
    const t = createTest();

    const response = await signUp(t, "owner@example.com");

    expect(response.status).toBe(403);
  });

  it("an existing user still signs in after the list is emptied", async () => {
    const t = createTest();
    expect((await signUp(t, "owner@example.com")).status).toBe(200);

    vi.stubEnv("SIGNUP_ALLOWED_EMAILS", "");
    vi.resetModules();
    const response = await signIn(t, "owner@example.com");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      user: { email: "owner@example.com" },
    });
  });
});

function signUp(t: TestClient, email: string) {
  return post(t, "/api/auth/sign-up/email", {
    email,
    password: PASSWORD,
    name: "Test",
  });
}

function signIn(t: TestClient, email: string) {
  return post(t, "/api/auth/sign-in/email", { email, password: PASSWORD });
}

function post(t: TestClient, path: string, body: unknown) {
  return t.fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  });
}
