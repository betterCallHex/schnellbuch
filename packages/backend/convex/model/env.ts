import * as z from "zod";

export const backendEnvSchema = {
  SITE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  MCP_CONSENT_URL: z.url(),
  BREVO_API_KEY: z.string().optional(),
  EMAIL_FROM: z.email().optional(),
};
