export type Engine = "chromium" | "firefox" | "webkit";

const BOOKMARK_MANAGER_SHORTCUT =
  "Open the bookmark manager: ⌘⌥B on a Mac, Ctrl+Shift+O on Windows and Linux.";
const CHROMIUM_EXPORT = "Click ⋮ at the top right, then Export bookmarks.";
const SAVE_THE_FILE = "Save the file, then drop it below.";

export const BROWSERS = [
  {
    name: "Chrome",
    engine: "chromium",
    exportSteps: [BOOKMARK_MANAGER_SHORTCUT, CHROMIUM_EXPORT, SAVE_THE_FILE],
  },
  {
    name: "Safari",
    engine: "webkit",
    exportSteps: [
      "In the menu bar, choose File → Export Browsing Data to File…, tick only Bookmarks and save.",
      "Safari saves a .zip file: open it to find Bookmarks.html. On Safari 17 or earlier, choose File → Export → Bookmarks… instead.",
      "Drop Bookmarks.html below.",
    ],
  },
  {
    name: "Firefox",
    engine: "firefox",
    exportSteps: [
      "Open the Library: ⌘⇧O on a Mac, Ctrl+Shift+O on Windows and Linux.",
      "Click Import and Backup, then Export Bookmarks to HTML…",
      SAVE_THE_FILE,
    ],
  },
  {
    name: "Edge",
    engine: "chromium",
    exportSteps: [
      "Open your favorites: ⌘⇧O on a Mac, Ctrl+Shift+O on Windows.",
      "Click ⋯ (More options), then Export favorites.",
      SAVE_THE_FILE,
    ],
  },
  {
    name: "Brave",
    engine: "chromium",
    exportSteps: [BOOKMARK_MANAGER_SHORTCUT, CHROMIUM_EXPORT, SAVE_THE_FILE],
  },
  {
    name: "Arc",
    engine: "chromium",
    exportSteps: [
      "Open arc://bookmarks in a new tab.",
      `${CHROMIUM_EXPORT} Pinned tabs and Favorites in Arc's sidebar aren't bookmarks, so they aren't in this file.`,
      SAVE_THE_FILE,
    ],
  },
  {
    name: "Opera",
    engine: "chromium",
    exportSteps: [
      "Open opera://bookmarks in a new tab.",
      "Click Import / Export at the bottom of the left sidebar, then Export bookmarks.",
      SAVE_THE_FILE,
    ],
  },
  {
    name: "Vivaldi",
    engine: "chromium",
    exportSteps: [
      "Open the Vivaldi menu (on a Mac, the menu bar) and choose File → Export Bookmarks…",
      SAVE_THE_FILE,
    ],
  },
] as const satisfies readonly {
  engine: Engine;
  exportSteps: readonly string[];
  name: string;
}[];

export type KnownBrowser = (typeof BROWSERS)[number];

export type BrowserName = KnownBrowser["name"];

export interface CurrentBrowser {
  engine: Engine | undefined;
  name: BrowserName | undefined;
}

const BRANDS: [brand: string, name: BrowserName][] = [
  ["Microsoft Edge", "Edge"],
  ["Opera", "Opera"],
  ["Opera GX", "Opera"],
  ["Brave", "Brave"],
  ["Vivaldi", "Vivaldi"],
  ["Google Chrome", "Chrome"],
];

const USER_AGENTS: [pattern: RegExp, browser: CurrentBrowser][] = [
  [/\bEdgA?\//u, { name: "Edge", engine: "chromium" }],
  [/\bOPR\//u, { name: "Opera", engine: "chromium" }],
  [/\bVivaldi\//u, { name: "Vivaldi", engine: "chromium" }],
  [/\bFirefox\//u, { name: "Firefox", engine: "firefox" }],
  [/\bChrome\//u, { name: "Chrome", engine: "chromium" }],
  [/\bVersion\/[\d.]+.*\bSafari\//u, { name: "Safari", engine: "webkit" }],
];

const LOOK_ALIKES_OF_CHROME = new Set<BrowserName>(["Arc", "Vivaldi"]);

export function currentBrowser() {
  const hints = navigator as Navigator & {
    brave?: unknown;
    userAgentData?: { brands: { brand: string }[] };
  };
  return detectBrowser({
    brands: hints.userAgentData?.brands.map(({ brand }) => brand) ?? [],
    userAgent: navigator.userAgent,
    isBrave: hints.brave !== undefined,
  });
}

export function detectBrowser({
  brands,
  userAgent,
  isBrave,
}: {
  brands: string[];
  isBrave: boolean;
  userAgent: string;
}): CurrentBrowser {
  if (isBrave) {
    return { name: "Brave", engine: "chromium" };
  }
  const branded = BRANDS.find(([brand]) => brands.includes(brand));
  if (branded) {
    return { name: branded[1], engine: "chromium" };
  }
  if (brands.includes("Chromium")) {
    return { name: undefined, engine: "chromium" };
  }
  const matched = USER_AGENTS.find(([pattern]) => pattern.test(userAgent));
  return matched ? matched[1] : { name: undefined, engine: undefined };
}

export function canImportDirectly(
  pick: BrowserName,
  current: CurrentBrowser,
  extensionEngine: Engine | undefined
) {
  if (engineOf(pick) !== extensionEngine) {
    return false;
  }
  return (
    current.name === undefined ||
    current.name === pick ||
    (current.name === "Chrome" && LOOK_ALIKES_OF_CHROME.has(pick))
  );
}

function engineOf(name: BrowserName) {
  return BROWSERS.find((browser) => browser.name === name)?.engine;
}
