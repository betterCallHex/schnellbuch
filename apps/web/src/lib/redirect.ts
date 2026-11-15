export function safeRedirectPath(path: string | undefined) {
  if (!path?.startsWith("/") || path.startsWith("//")) {
    return "/";
  }
  return path;
}
