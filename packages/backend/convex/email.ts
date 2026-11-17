import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { env } from "./env";
import { sendWithMailtrap, signInCodeEmail } from "./model/email";

export const sendSignInCode = internalAction({
  args: { email: v.string(), code: v.string() },
  handler: async (_ctx, { email, code }) => {
    if (!(env.MAILTRAP_API_TOKEN && env.EMAIL_FROM)) {
      console.warn(
        `MAILTRAP_API_TOKEN or EMAIL_FROM isn't set, so nothing was emailed. Sign-in code for ${email}: ${code}`
      );
      return;
    }
    await sendWithMailtrap(signInCodeEmail(email, code), {
      token: env.MAILTRAP_API_TOKEN,
      from: env.EMAIL_FROM,
    });
  },
});
