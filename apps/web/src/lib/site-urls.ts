// Fills in the public URLs a build needs from what the platform provides.
// Used by vite.config.ts at build time.
const CONVEX_CLOUD = /\.convex\.cloud\/?$/u;

// `convex deploy --cmd` passes only the deployment URL; a cloud
// deployment's HTTP actions live on the matching .convex.site host.
export function convexSiteUrl(convexUrl: string, explicit?: string) {
  if (explicit) {
    return explicit;
  }
  if (!CONVEX_CLOUD.test(convexUrl)) {
    throw new Error(
      `Set VITE_CONVEX_SITE_URL: it can't be worked out from ${convexUrl}.`
    );
  }
  return convexUrl.replace(CONVEX_CLOUD, ".convex.site");
}

// Production uses the project's own domain; previews their deployment URL.
export function siteUrl({
  explicit,
  port,
  vercelEnv,
  vercelProductionHost,
  vercelHost,
}: {
  explicit?: string;
  port: number;
  vercelEnv?: string;
  vercelProductionHost?: string;
  vercelHost?: string;
}) {
  if (explicit) {
    return explicit;
  }
  if (vercelEnv === "production" && vercelProductionHost) {
    return `https://${vercelProductionHost}`;
  }
  if (vercelHost) {
    return `https://${vercelHost}`;
  }
  return `http://localhost:${port}`;
}
