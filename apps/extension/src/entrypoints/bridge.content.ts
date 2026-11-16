import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";
import { env } from "@/lib/env";
import {
  type BookmarksReply,
  EXTENSION_CHANNEL,
  PAGE_CHANNEL,
  READ_BOOKMARKS,
} from "@/lib/page-bridge";
import { isServerPage } from "@/lib/server-access";
import { serverUrl } from "@/lib/settings";

const UNREACHABLE_REPLY: BookmarksReply = {
  error:
    "The SchnellBuch extension didn't answer. Reload the page and try again.",
};

export default defineContentScript({
  registration: "runtime",
  async main() {
    if (!isServerPage(location.href, await serverUrl.getValue())) {
      return;
    }
    window.addEventListener("message", answerPage);
    announce();
  },
});

function answerPage(event: MessageEvent) {
  const request: unknown = event.data;
  if (
    event.source !== window ||
    event.origin !== location.origin ||
    !isPageMessage(request)
  ) {
    return;
  }
  if (request.type === "hello") {
    announce();
    return;
  }
  if (
    request.type === READ_BOOKMARKS &&
    typeof request.requestId === "string"
  ) {
    sendBookmarks(request.requestId);
  }
}

function isPageMessage(
  message: unknown
): message is { type: unknown; requestId?: unknown } {
  return (
    typeof message === "object" &&
    message !== null &&
    "channel" in message &&
    message.channel === PAGE_CHANNEL &&
    "type" in message
  );
}

function announce() {
  post({ type: "ready", engine: env.FIREFOX ? "firefox" : "chromium" });
}

async function sendBookmarks(requestId: string) {
  const reply: BookmarksReply | undefined = await browser.runtime
    .sendMessage({ type: READ_BOOKMARKS })
    .catch(() => UNREACHABLE_REPLY);
  post({ type: "bookmarks", requestId, ...(reply ?? UNREACHABLE_REPLY) });
}

function post(message: Record<string, unknown>) {
  window.postMessage(
    { channel: EXTENSION_CHANNEL, ...message },
    location.origin
  );
}
