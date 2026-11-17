// Fetches of pages the user saved (titles, icons, link checks). Every hop
// of a redirect must be a public web address, so a saved page can't point
// SchnellBuch at a private network, its own host or a cloud metadata
// service. Host names aren't resolved here: a public name that resolves to
// a private address is left to the hosting platform's own egress rules.

const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const SEE_OTHER = 303;
const WEB_PROTOCOLS = new Set(["http:", "https:"]);
const LOCAL_NAMES = /(?:^|\.)(?:localhost|local|internal|home\.arpa)$/u;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/u;
const GLOBAL_IPV6_FIRST_HEXTET = /^[23][\da-f]{0,3}$/u;
const BYTE = 256;

// [first octet, second octet range] blocks: this network, private ranges,
// carrier-grade NAT, loopback, link-local and benchmarking. Multicast and
// reserved addresses (224 and up) are refused separately.
const PRIVATE_IPV4: [number, number, number][] = [
  [0, 0, BYTE - 1],
  [10, 0, BYTE - 1],
  [100, 64, 127],
  [127, 0, BYTE - 1],
  [169, 254, 254],
  [172, 16, 31],
  [192, 168, 168],
  [198, 18, 19],
];
const FIRST_MULTICAST_OCTET = 224;

export class BlockedAddressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedAddressError";
  }
}

export function isPublicUrl(url: string) {
  const parsed = URL.parse(url);
  return (
    parsed !== null &&
    WEB_PROTOCOLS.has(parsed.protocol) &&
    isPublicHost(parsed.hostname)
  );
}

function isPublicHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (host.startsWith("[")) {
    return isGlobalIpv6(host.slice(1, -1));
  }
  if (IPV4.test(host)) {
    return isPublicIpv4(host);
  }
  return host.includes(".") && !LOCAL_NAMES.test(host);
}

function isPublicIpv4(host: string) {
  const [first = 0, second = 0] = host.split(".").map(Number);
  if (first >= FIRST_MULTICAST_OCTET) {
    return false;
  }
  return !PRIVATE_IPV4.some(
    ([octet, from, to]) => first === octet && second >= from && second <= to
  );
}

// Only global unicast (2000::/3). Loopback, unique-local, link-local and
// IPv4-mapped addresses all fall outside it.
function isGlobalIpv6(address: string) {
  const firstHextet = address.split(":")[0] ?? "";
  return GLOBAL_IPV6_FIRST_HEXTET.test(firstHextet);
}

export async function fetchPublic(
  url: string,
  {
    method = "GET",
    headers,
    timeoutMs,
  }: {
    method?: "GET" | "HEAD";
    headers?: Record<string, string>;
    timeoutMs: number;
  }
) {
  const signal = AbortSignal.timeout(timeoutMs);
  let current = url;
  let currentMethod = method;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!isPublicUrl(current)) {
      throw new BlockedAddressError(`${current} isn't a public web address.`);
    }
    // biome-ignore lint/performance/noAwaitInLoops: each redirect hop is checked before the next request
    const response = await fetch(current, {
      method: currentMethod,
      headers,
      signal,
      redirect: "manual",
    });
    const location = response.headers.get("location");
    if (!(REDIRECT_STATUSES.has(response.status) && location)) {
      return { response, url: current };
    }
    await response.body?.cancel();
    current = new URL(location, current).href;
    if (response.status === SEE_OTHER) {
      currentMethod = "GET";
    }
  }
  throw new BlockedAddressError(`${url} redirects too many times.`);
}

// The start of a response body, without downloading the rest.
export async function readTextUpTo(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  while (bytes < maxBytes) {
    // biome-ignore lint/performance/noAwaitInLoops: chunks of one stream arrive in order
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const chunk = value.subarray(0, maxBytes - bytes);
    bytes += chunk.byteLength;
    text += decoder.decode(chunk, { stream: true });
  }
  await reader.cancel().catch(() => undefined);
  return text + decoder.decode();
}
