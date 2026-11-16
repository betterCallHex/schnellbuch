export const DEFAULT_SERVER_URL = "http://localhost:3000";

export const ANY_WEB_PAGE = ["http://*/*", "https://*/*"];

export function serverMatchPattern(serverUrl: string) {
  const { protocol, hostname } = new URL(serverUrl);
  return `${protocol}//${hostname}/*`;
}

export function isServerPage(pageUrl: string | undefined, serverUrl: string) {
  const page = URL.parse(pageUrl ?? "");
  return page !== null && page.origin === new URL(serverUrl).origin;
}
