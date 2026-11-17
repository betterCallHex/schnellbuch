import {
  EXTENSION_CHANNEL,
  PAGE_CHANNEL,
  READ_BOOKMARKS,
} from "@schnellbuch/backend/page-bridge";
import { ConvexError } from "convex/values";
import { useEffect, useState } from "react";
import type { Engine } from "@/lib/browsers";

const REPLY_TIMEOUT_MS = 60_000;
const NO_ANSWER =
  "The SchnellBuch extension didn't answer. Reload the page and try again.";

interface ExtensionMessage {
  engine?: unknown;
  error?: unknown;
  html?: unknown;
  requestId?: unknown;
  type: unknown;
}

export function useExtensionEngine() {
  const [engine, setEngine] = useState<Engine>();
  useEffect(() => {
    const controller = new AbortController();
    window.addEventListener(
      "message",
      (event) => {
        const message = extensionMessage(event);
        if (message?.type === "ready" && isExtensionEngine(message.engine)) {
          setEngine(message.engine);
        }
      },
      { signal: controller.signal }
    );
    postToExtension({ type: "hello" });
    return () => controller.abort();
  }, []);
  return engine;
}

export async function readExtensionBookmarks() {
  const requestId = crypto.randomUUID();
  const reply = waitForExtension(
    (message) => message.type === "bookmarks" && message.requestId === requestId
  );
  postToExtension({ type: READ_BOOKMARKS, requestId });
  const { html, error } = await reply;
  if (typeof html !== "string") {
    throw new ConvexError(typeof error === "string" ? error : NO_ANSWER);
  }
  return html;
}

function waitForExtension(matches: (message: ExtensionMessage) => boolean) {
  const { promise, resolve, reject } =
    Promise.withResolvers<ExtensionMessage>();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => reject(new ConvexError(NO_ANSWER)),
    REPLY_TIMEOUT_MS
  );
  window.addEventListener(
    "message",
    (event) => {
      const message = extensionMessage(event);
      if (message && matches(message)) {
        resolve(message);
      }
    },
    { signal: controller.signal }
  );
  return promise.finally(() => {
    clearTimeout(timeout);
    controller.abort();
  });
}

function extensionMessage(event: MessageEvent): ExtensionMessage | undefined {
  const data: unknown = event.data;
  const fromThisPage =
    event.source === window && event.origin === window.location.origin;
  if (
    fromThisPage &&
    typeof data === "object" &&
    data !== null &&
    "channel" in data &&
    data.channel === EXTENSION_CHANNEL &&
    "type" in data
  ) {
    return data;
  }
}

function isExtensionEngine(engine: unknown): engine is Engine {
  return engine === "chromium" || engine === "firefox";
}

function postToExtension(message: Record<string, string>) {
  window.postMessage(
    { channel: PAGE_CHANNEL, ...message },
    window.location.origin
  );
}
