import { type Browser, browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { addPageUrl, isSavable } from "@/lib/add-url";
import { bookmarkFile } from "@/lib/bookmark-file";
import { type BookmarksReply, isBookmarksRequest } from "@/lib/page-bridge";
import { isServerPage, serverMatchPattern } from "@/lib/server-access";
import { serverUrl } from "@/lib/settings";

const SAVE_LINK_MENU = "save-link";
const SAVE_PAGE_COMMAND = "save-page";
const POPUP = { type: "popup", width: 420, height: 360 } as const;
const BADGE_MS = 2500;
const BRIDGE_SCRIPT_ID = "schnellbuch-bridge";
const BRIDGE_SCRIPT_FILE = "content-scripts/bridge.js";
const UNREADABLE_REPLY: BookmarksReply = {
  error: "Your browser didn't hand over its bookmarks. Try again.",
};

let bridgeSetup = Promise.resolve();

// Every way of saving opens SchnellBuch's own /add popup, the same one the
// bookmarklet uses: it signs the user in if needed, saves, and lets them
// pick the folder.
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: SAVE_LINK_MENU,
      title: "Save link to SchnellBuch",
      contexts: ["link"],
    });
  });

  toolbarButton().onClicked.addListener((tab) => save(tab.url, tab.title));

  browser.commands.onCommand.addListener(async (command, tab) => {
    if (command !== SAVE_PAGE_COMMAND) {
      return;
    }
    const target =
      tab ??
      (await browser.tabs.query({ active: true, currentWindow: true }))[0];
    await save(target?.url, target?.title);
  });

  browser.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === SAVE_LINK_MENU) {
      // Firefox passes the link's text; Chrome doesn't, so the page's own
      // title is fetched after saving.
      const { linkText } = info as { linkText?: string };
      save(info.linkUrl, linkText);
    }
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isBookmarksRequest(message)) {
      return;
    }
    readBookmarksFor(sender)
      .catch(() => UNREADABLE_REPLY)
      .then(sendResponse);
    return true;
  });

  setUpBridge();
  serverUrl.watch(setUpBridge);
  browser.permissions.onAdded.addListener(setUpBridge);
  browser.permissions.onRemoved.addListener(setUpBridge);
});

async function save(url: string | undefined, title: string | undefined) {
  if (!isSavable(url)) {
    await flashBadge("×", "Only web pages can be saved to SchnellBuch");
    return;
  }
  await browser.windows.create({
    ...POPUP,
    url: addPageUrl(await serverUrl.getValue(), { url, title }),
  });
}

async function flashBadge(text: string, title: string) {
  const button = toolbarButton();
  await button.setBadgeText({ text });
  await button.setTitle({ title });
  setTimeout(() => {
    button.setBadgeText({ text: "" });
    button.setTitle({ title: "Save to SchnellBuch" });
  }, BADGE_MS);
}

// Manifest V3 browsers have `action`; Firefox's Manifest V2 build has
// `browserAction`.
function toolbarButton() {
  return browser.action ?? browser.browserAction;
}

async function readBookmarksFor(
  sender: Browser.runtime.MessageSender
): Promise<BookmarksReply> {
  const fromSchnellBuch =
    sender.id === browser.runtime.id &&
    isServerPage(sender.url, await serverUrl.getValue());
  if (!fromSchnellBuch) {
    return { error: "Only SchnellBuch can read your bookmarks." };
  }
  return { html: bookmarkFile(await browser.bookmarks.getTree()) };
}

function setUpBridge() {
  bridgeSetup = bridgeSetup
    .then(registerBridge)
    .catch((error: unknown) =>
      console.error("Bookmark import setup failed", error)
    );
}

async function registerBridge() {
  const matches = [serverMatchPattern(await serverUrl.getValue())];
  const allowed = await browser.permissions.contains({ origins: matches });
  const [registered] = await browser.scripting.getRegisteredContentScripts({
    ids: [BRIDGE_SCRIPT_ID],
  });
  if (allowed && registered?.matches?.join() === matches.join()) {
    return;
  }
  if (registered) {
    await browser.scripting.unregisterContentScripts({
      ids: [BRIDGE_SCRIPT_ID],
    });
  }
  if (!allowed) {
    return;
  }
  await browser.scripting.registerContentScripts([
    {
      id: BRIDGE_SCRIPT_ID,
      matches,
      js: [BRIDGE_SCRIPT_FILE],
      runAt: "document_idle",
      persistAcrossSessions: false,
    },
  ]);
}
