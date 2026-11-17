import { afterEach, describe, expect, test as it, vi } from "vitest";
import { post, signIn, signInWith } from "../testing/auth";
import { createTest } from "../testing/convex";

type TestClient = ReturnType<typeof createTest>;

const CODE_IN_SUBJECT = /^(?<code>\d{6}) is your SchnellBuch sign-in code$/u;
const LOGGED_CODE = /Sign-in code for owner@example\.com: \d{6}$/u;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("sign-up allow-list", () => {
  it("an allowed address can create an account", async () => {
    const t = createTest();

    const response = await signIn(t, "owner@example.com");

    expect(response.status).toBe(200);
  });

  it("a different case of an allowed address matches", async () => {
    const t = createTest();

    const response = await signIn(t, "OWNER@example.COM");

    expect(response.status).toBe(200);
  });

  it("anyone at an allowed domain can create an account", async () => {
    const t = createTest();

    const response = await signIn(t, "kid@Family.test");

    expect(response.status).toBe(200);
  });

  it("an address not on the list is refused with a stable code", async () => {
    const t = createTest();

    const response = await signIn(t, "stranger@example.com");

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: "SIGNUPS_CLOSED",
      message: "Sign-ups are closed.",
    });
  });

  it("an empty list closes sign-ups", async () => {
    vi.stubEnv("SIGNUP_ALLOWED_EMAILS", "");
    vi.resetModules();
    const t = createTest();

    const response = await signIn(t, "owner@example.com");

    expect(response.status).toBe(403);
  });

  it("an existing user still signs in after the list is emptied", async () => {
    const t = createTest();
    const first = await signIn(t, "owner@example.com");
    const { user } = (await first.json()) as { user: { id: string } };

    vi.stubEnv("SIGNUP_ALLOWED_EMAILS", "");
    vi.resetModules();
    const response = await signIn(t, "owner@example.com");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      user: { id: user.id, email: "owner@example.com" },
    });
  });
});

describe("sign-in codes by email", () => {
  it("are sent through Mailtrap and sign the address in once", async () => {
    const { t, sent } = withMailtrap();

    expect((await requestCode(t, "Owner@Example.com")).status).toBe(200);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const code = codeFrom(sent);

    expect(sent).toEqual([
      expect.objectContaining({
        url: "https://send.api.mailtrap.io/api/send",
        authorization: "Bearer mailtrap-token",
        body: expect.objectContaining({
          from: { email: "login@schnellbuch.test", name: "SchnellBuch" },
          to: [{ email: "owner@example.com" }],
        }),
      }),
    ]);
    expect((await signInWith(t, "owner@example.com", code)).status).toBe(200);
    expect((await signInWith(t, "owner@example.com", code)).status).toBe(400);
  });

  it("a wrong code doesn't sign in", async () => {
    const { t, sent } = withMailtrap();
    await requestCode(t, "owner@example.com");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const wrong = codeFrom(sent) === "000000" ? "111111" : "000000";

    const response = await signInWith(t, "owner@example.com", wrong);

    expect(response.status).toBe(400);
  });

  it("aren't sent to an address that can't have an account", async () => {
    const { t, sent } = withMailtrap();

    const response = await requestCode(t, "stranger@example.com");
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(response.status).toBe(200);
    expect(sent).toEqual([]);
  });

  it("are logged instead of sent when Mailtrap isn't set up", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const t = createTest();

    await requestCode(t, "owner@example.com");
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(fetch).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(LOGGED_CODE));
  });

  it("requests and checks are capped per address, and other addresses aren't affected", async () => {
    const t = createTest();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 9; attempt += 1) {
      // biome-ignore lint/performance/noAwaitInLoops: attempts happen one after another
      const response = await signInWith(t, "Owner@example.com", "000000");
      statuses.push(response.status);
    }
    const lastAllowed = await requestCode(t, "owner@example.com");
    const blocked = await requestCode(t, "owner@example.com");

    expect(new Set(statuses)).toEqual(new Set([400]));
    expect(lastAllowed.status).toBe(200);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ code: "TOO_MANY_ATTEMPTS" });
    expect((await signIn(t, "kid@family.test")).status).toBe(200);
  });
});

interface SentEmail {
  authorization: string | null;
  body: { subject: string; to: { email: string }[] };
  url: string;
}

function withMailtrap() {
  vi.useFakeTimers();
  vi.stubEnv("MAILTRAP_API_TOKEN", "mailtrap-token");
  vi.stubEnv("EMAIL_FROM", "login@schnellbuch.test");
  vi.resetModules();
  const sent: SentEmail[] = [];
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    sent.push({
      url,
      authorization: new Headers(init.headers).get("authorization"),
      body: JSON.parse(String(init.body)),
    });
    return Promise.resolve(Response.json({ success: true }));
  });
  return { t: createTest(), sent };
}

function codeFrom(sent: SentEmail[]) {
  const code = sent.at(-1)?.body.subject.match(CODE_IN_SUBJECT)?.groups?.code;
  if (!code) {
    throw new Error("No sign-in code was emailed.");
  }
  return code;
}

function requestCode(t: TestClient, email: string) {
  return post(t, "/api/auth/email-otp/send-verification-otp", {
    email,
    type: "sign-in",
  });
}
