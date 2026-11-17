// Headers for every page. Scripts and styles may only come from SchnellBuch
// itself (the inline ones are TanStack Start's hydration data), the page may
// only talk to SchnellBuch and its Convex deployment, and nobody can frame
// it. Site icons come from anywhere. Matters beyond the usual: any script on
// this origin can ask the browser extension for the browser's bookmarks.
const HTTP_SCHEME = /^http/u;

export function contentSecurityPolicy(
  convexUrl: string,
  convexSiteUrl: string
) {
  const convex = new URL(convexUrl).origin;
  const convexSocket = convex.replace(HTTP_SCHEME, "ws");
  const convexSite = new URL(convexSiteUrl).origin;
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src * data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${convex} ${convexSocket} ${convexSite}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function securityHeaders(convexUrl: string, convexSiteUrl: string) {
  return {
    "Content-Security-Policy": contentSecurityPolicy(convexUrl, convexSiteUrl),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
  };
}
