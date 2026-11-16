import { api } from "@schnellbuch/backend/api";
import type { Doc } from "@schnellbuch/backend/data-model";
import { buildFolderTree, flattenFolderTree } from "@schnellbuch/backend/tree";
import { useRouteContext } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { type Library, LibraryContext } from "@/lib/library";
import {
  chooseLibrary,
  type Mirror,
  readMirror,
  tokenSubject,
  toMirror,
} from "@/lib/mirror";
import { loadMirror, rememberLastUser, saveMirror } from "@/lib/mirror-store";
import { useOffline, useSignedInQuery } from "@/lib/offline";

const MIRROR_WRITE_DELAY_MS = 1000;

type LibraryMirror = Mirror<Doc<"folders">, Doc<"bookmarks">>;

// Live data from Convex, mirrored to this device for offline browsing.
export function LibraryProvider({ children }: { children: ReactNode }) {
  const { token, offlineUserId } = useRouteContext({ from: "__root__" });
  const userId = tokenSubject(token) ?? offlineUserId;
  const folders = useSignedInQuery(api.folders.list, {});
  const bookmarks = useSignedInQuery(api.bookmarks.list, {});
  const offline = useOffline();
  const [mirror, setMirror] = useState<LibraryMirror>();

  useEffect(() => {
    if (!userId) {
      return;
    }
    let current = true;
    loadMirror(userId).then((stored) => {
      if (current) {
        setMirror(readMirror(stored, userId));
      }
    });
    return () => {
      current = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!(userId && folders && bookmarks)) {
      return;
    }
    rememberLastUser(userId);
    const timer = setTimeout(() => {
      saveMirror(userId, toMirror(userId, folders, bookmarks, Date.now()));
    }, MIRROR_WRITE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [userId, folders, bookmarks]);

  const chosen = chooseLibrary({
    live: { folders, bookmarks },
    mirror,
    offline,
  });
  const tree = buildFolderTree(chosen.folders);
  const library: Library = {
    loaded: chosen.source !== "loading",
    source: chosen.source,
    mirroredAt: chosen.mirroredAt,
    bookmarks: chosen.bookmarks,
    tree,
    flatFolders: flattenFolderTree(tree),
  };
  return (
    <LibraryContext.Provider value={library}>
      {children}
    </LibraryContext.Provider>
  );
}
