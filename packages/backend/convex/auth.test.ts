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

describe("sign-up", () => {
  it("any address creates an account with its first code", async () => {
    const t = createTest();

    const response = await signIn(t, "stranger@example.com");

    expect(response.status).toBe(200);
  });

  it("the same address in another case signs in to the same account", async () => {
    const t = createTest();
    const first = await signIn(t, "owner@example.com");
    const { user } = (await first.json()) as { user: { id: string } };

    const response = await signIn(t, "OWNER@example.COM");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      user: { id: user.id, email: "owner@example.com" },
    });
  });
});

describe("sign-in codes by email", () => {
  it("are sent through Brevo and sign the address in once", async () => {
    const { t, sent } = withBrevo();

    expect((await requestCode(t, "Owner@Example.com")).status).toBe(200);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const code = codeFrom(sent);

    expect(sent).toEqual([
      expect.objectContaining({
        url: "https://api.brevo.com/v3/smtp/email",
        apiKey: "brevo-key",
        body: expect.objectContaining({
          sender: { email: "login@schnellbuch.test", name: "SchnellBuch" },
          to: [{ email: "owner@example.com" }],
        }),
      }),
    ]);
    expect((await signInWith(t, "owner@example.com", code)).status).toBe(200);
    expect((await signInWith(t, "owner@example.com", code)).status).toBe(400);
  });

  it("a wrong code doesn't sign in", async () => {
    const { t, sent } = withBrevo();
    await requestCode(t, "owner@example.com");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const wrong = codeFrom(sent) === "000000" ? "111111" : "000000";

    const response = await signInWith(t, "owner@example.com", wrong);

    expect(response.status).toBe(400);
  });

  it("go to a new address too, which signs up with it", async () => {
    const { t, sent } = withBrevo();

    expect((await requestCode(t, "stranger@example.com")).status).toBe(200);
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(sent.map((email) => email.body.to)).toEqual([
      [{ email: "stranger@example.com" }],
    ]);
    const response = await signInWith(
      t,
      "stranger@example.com",
      codeFrom(sent)
    );
    expect(response.status).toBe(200);
  });

  it("are logged instead of sent when Brevo isn't set up", async () => {
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
  apiKey: string | null;
  body: { subject: string; textContent: string; to: { email: string }[] };
  url: string;
}

function withBrevo() {
  vi.useFakeTimers();
  vi.stubEnv("BREVO_API_KEY", "brevo-key");
  vi.stubEnv("EMAIL_FROM", "login@schnellbuch.test");
  vi.resetModules();
  const sent: SentEmail[] = [];
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    sent.push({
      url,
      apiKey: new Headers(init.headers).get("api-key"),
      body: JSON.parse(String(init.body)),
    });
    return Promise.resolve(
      Response.json({ messageId: "<id>" }, { status: 201 })
    );
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
