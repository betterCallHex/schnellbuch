import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { env } from "./env";
import { sendWithBrevo, signInCodeEmail } from "./model/email";

export const sendSignInCode = internalAction({
  args: { email: v.string(), code: v.string() },
  handler: async (_ctx, { email, code }) => {
    if (!(env.BREVO_API_KEY && env.EMAIL_FROM)) {
      console.warn(
        `BREVO_API_KEY or EMAIL_FROM isn't set, so nothing was emailed. Sign-in code for ${email}: ${code}`
      );
      return;
    }
    await sendWithBrevo(signInCodeEmail(email, code), {
      apiKey: env.BREVO_API_KEY,
      from: env.EMAIL_FROM,
    });
  },
});
