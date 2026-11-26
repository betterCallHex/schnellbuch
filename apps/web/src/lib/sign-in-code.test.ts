import { describe, expect, test as it } from "bun:test";
import { signInCodeError } from "./sign-in-code";

describe("signInCodeError", () => {
  it("explains a wrong, expired or used-up code", () => {
    expect(
      signInCodeError({ code: "INVALID_OTP", message: "Invalid OTP" })
    ).toBe("That code isn't right. Check the email and try again.");
    expect(signInCodeError({ code: "OTP_EXPIRED" })).toBe(
      "That code has expired. Send a new one."
    );
    expect(
      signInCodeError({
        code: "TOO_MANY_ATTEMPTS",
        message: "Too many attempts",
        status: 403,
      })
    ).toBe("Too many wrong codes. Send a new one.");
  });

  it("keeps the backend's wait time when an address is rate limited", () => {
    expect(
      signInCodeError({
        code: "TOO_MANY_ATTEMPTS",
        message: "Too many attempts. Try again in 12 minutes.",
        status: 429,
      })
    ).toBe("Too many attempts. Try again in 12 minutes.");
  });

  it("passes other messages through", () => {
    expect(signInCodeError({ message: "Network down" })).toBe("Network down");
    expect(signInCodeError({})).toBe("Something went wrong. Try again.");
  });
});
