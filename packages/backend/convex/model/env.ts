import * as z from "zod";

export const backendEnvSchema = {
  SITE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  MCP_CONSENT_URL: z.url(),
  SIGNUP_ALLOWED_EMAILS: z.string().optional(),
};
