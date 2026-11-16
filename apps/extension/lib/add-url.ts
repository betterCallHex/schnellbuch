// Builds the link the extension opens: SchnellBuch's own /add save popup,
// which handles sign-in, saving and picking a folder.

const TRAILING_SLASHES = /\/+$/u;
const WEB_PROTOCOLS = new Set(["http:", "https:"]);
const HAS_SCHEME = /^[a-z][a-z\d+.-]*:\/\//iu;

// The SchnellBuch address as typed on the options page, cleaned up, or
// undefined when it isn't a web address.
export function normalizeServerUrl(input: string) {
  const trimmed = input.trim();
  const url = URL.parse(
    HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`
  );
  if (!(url && WEB_PROTOCOLS.has(url.protocol) && url.hostname)) {
    return;
  }
  return `${url.origin}${url.pathname.replace(TRAILING_SLASHES, "")}`;
}

export function addPageUrl(
  serverUrl: string,
  page: { url: string; title?: string }
) {
  const target = new URL(`${serverUrl.replace(TRAILING_SLASHES, "")}/add`);
  target.searchParams.set("url", page.url);
  const title = page.title?.trim();
  if (title) {
    target.searchParams.set("title", title);
  }
  return target.href;
}

// Pages a browser won't let anyone bookmark usefully (new tab, settings,
// extension pages) get a clear message instead of a failed save.
export function isSavable(url: string | undefined): url is string {
  if (!url) {
    return false;
  }
  const parsed = URL.parse(url);
  return parsed !== null && WEB_PROTOCOLS.has(parsed.protocol);
}
