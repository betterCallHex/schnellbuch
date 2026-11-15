const TOKEN_PREFIX = "sb_";
const TOKEN_BYTES = 32;
const PREVIEW_TAIL = 4;
const BASE64_PADDING = /[=]+$/u;

export function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return `${TOKEN_PREFIX}${toBase64Url(bytes)}`;
}

export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export function previewToken(token: string) {
  return `${TOKEN_PREFIX}…${token.slice(-PREVIEW_TAIL)}`;
}

function toBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(BASE64_PADDING, "");
}
