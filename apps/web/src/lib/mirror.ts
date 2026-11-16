// The last library the app received, kept per signed-in user so it can be
// browsed and searched offline. Pure logic; storage is in mirror-store.ts.
const MIRROR_VERSION = 1;

export interface Mirror<Folder, Bookmark> {
  bookmarks: Bookmark[];
  folders: Folder[];
  savedAt: number;
  userId: string;
  version: typeof MIRROR_VERSION;
}

export function toMirror<Folder, Bookmark>(
  userId: string,
  folders: Folder[],
  bookmarks: Bookmark[],
  now: number
): Mirror<Folder, Bookmark> {
  return { version: MIRROR_VERSION, userId, savedAt: now, folders, bookmarks };
}

// A stored value is used only if it's this version's shape and belongs to
// the user asking for it.
export function readMirror<Folder, Bookmark>(
  value: unknown,
  userId: string
): Mirror<Folder, Bookmark> | undefined {
  if (typeof value !== "object" || value === null) {
    return;
  }
  const candidate = value as Partial<Mirror<Folder, Bookmark>>;
  const valid =
    candidate.version === MIRROR_VERSION &&
    candidate.userId === userId &&
    typeof candidate.savedAt === "number" &&
    Array.isArray(candidate.folders) &&
    Array.isArray(candidate.bookmarks);
  return valid ? (candidate as Mirror<Folder, Bookmark>) : undefined;
}

export type LibrarySource = "live" | "mirror" | "loading";

// Live data always wins, so coming back online replaces the mirror without
// a reload. The mirror is shown only while offline.
export function chooseLibrary<Folder, Bookmark>({
  live,
  mirror,
  offline,
}: {
  live: { folders?: Folder[]; bookmarks?: Bookmark[] };
  mirror?: Mirror<Folder, Bookmark>;
  offline: boolean;
}): {
  source: LibrarySource;
  folders: Folder[];
  bookmarks: Bookmark[];
  mirroredAt?: number;
} {
  if (live.folders && live.bookmarks) {
    return { source: "live", folders: live.folders, bookmarks: live.bookmarks };
  }
  if (offline && mirror) {
    return {
      source: "mirror",
      folders: mirror.folders,
      bookmarks: mirror.bookmarks,
      mirroredAt: mirror.savedAt,
    };
  }
  return { source: "loading", folders: [], bookmarks: [] };
}

// Convex auth tokens are JWTs whose subject is the user ID. Only read here
// to pick the right mirror; the server verifies tokens.
export function tokenSubject(token: string | null | undefined) {
  const payload = token?.split(".")[1];
  if (!payload) {
    return;
  }
  try {
    const json = atob(payload.replaceAll("-", "+").replaceAll("_", "/"));
    const { sub } = JSON.parse(json) as { sub?: unknown };
    return typeof sub === "string" ? sub : undefined;
  } catch {
    // Not a JWT: no subject.
  }
}
