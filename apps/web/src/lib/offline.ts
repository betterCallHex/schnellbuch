import {
  type ReactAction,
  type ReactMutation,
  useAction,
  useConvex,
  useConvexAuth,
  useMutation,
  useQuery,
} from "convex/react";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { ConvexError } from "convex/values";
import { useEffect, useSyncExternalStore } from "react";
import { deleteMirror, rememberLastUser } from "@/lib/mirror-store";
import { PAGES_CACHE } from "@/lib/pages-cache";

export const OFFLINE_MESSAGE =
  "You're offline. Saving, moving and deleting are paused until you're back online.";
// A connection that's down (or not up yet) this long counts as offline, so
// a blip or a slow start doesn't flash the banner.
const DISCONNECTED_GRACE_MS = 4000;

let offline = false;
const listeners = new Set<() => void>();

function setOffline(next: boolean) {
  if (next !== offline) {
    offline = next;
    for (const listener of listeners) {
      listener();
    }
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// For code outside React, such as route guards.
export function isOffline() {
  return offline || (typeof navigator !== "undefined" && !navigator.onLine);
}

export function useOffline() {
  return useSyncExternalStore(
    subscribe,
    () => offline,
    () => false
  );
}

// Mounted once at the root: offline when the browser says so, or when the
// Convex connection is down (or never came up) for a few seconds. The
// second covers networks that report "online" without reaching anything.
export function useWatchConnection() {
  const convex = useConvex();
  useEffect(() => {
    let browserOffline = !navigator.onLine;
    let convexDown = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => setOffline(browserOffline || convexDown);
    const watch = (connected: boolean) => {
      if (connected) {
        clearTimeout(timer);
        timer = undefined;
        convexDown = false;
        update();
        return;
      }
      timer ??= setTimeout(() => {
        convexDown = true;
        update();
      }, DISCONNECTED_GRACE_MS);
    };
    const onOnline = () => {
      browserOffline = false;
      update();
    };
    const onOffline = () => {
      browserOffline = true;
      update();
    };
    const stopWatching = convex.subscribeToConnectionState((state) =>
      watch(state.isWebSocketConnected)
    );
    watch(convex.connectionState().isWebSocketConnected);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    update();
    return () => {
      clearTimeout(timer);
      stopWatching();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [convex]);
}

// Convex would queue a change made offline and send it later; SchnellBuch
// refuses it instead, so nobody thinks a save worked when it didn't.
function guardMutation<Mutation extends FunctionReference<"mutation">>(
  mutation: ReactMutation<Mutation>
): ReactMutation<Mutation> {
  const guarded = ((...args: Parameters<ReactMutation<Mutation>>) =>
    offline
      ? Promise.reject(new ConvexError(OFFLINE_MESSAGE))
      : mutation(...args)) as ReactMutation<Mutation>;
  guarded.withOptimisticUpdate = (update) =>
    guardMutation(mutation.withOptimisticUpdate(update));
  return guarded;
}

export function useOnlineMutation<
  Mutation extends FunctionReference<"mutation">,
>(reference: Mutation) {
  return guardMutation(useMutation(reference));
}

export function useOnlineAction<Action extends FunctionReference<"action">>(
  reference: Action
) {
  const action = useAction(reference);
  return ((...args: Parameters<ReactAction<Action>>) =>
    offline
      ? Promise.reject(new ConvexError(OFFLINE_MESSAGE))
      : action(...args)) as ReactAction<Action>;
}

// A query that needs the signed-in user waits until Convex has their token.
// After starting offline there is none until the network is back and the
// session refreshes; running the query earlier would fail with "Sign in to
// continue." instead of showing the mirror.
export function useSignedInQuery<Query extends FunctionReference<"query">>(
  reference: Query,
  args: FunctionArgs<Query>
): FunctionReturnType<Query> | undefined {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(
    reference,
    ...((isAuthenticated ? [args] : ["skip"]) as [FunctionArgs<Query>])
  );
}

export function registerServiceWorker() {
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // No offline support in this browser; everything else still works.
    });
  }
}

// Sign-out leaves nothing of the library on the device.
export async function clearOfflineData(userId: string | undefined) {
  rememberLastUser(undefined);
  await Promise.all([
    userId ? deleteMirror(userId) : undefined,
    "caches" in window ? caches.delete(PAGES_CACHE) : undefined,
  ]);
}
