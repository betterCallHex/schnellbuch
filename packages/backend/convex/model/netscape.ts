import { ConvexError } from "convex/values";
import { decodeEntities, escapeHtml, readAttributes } from "./html";

// The "Netscape bookmark file" every major browser exports and imports.
// One module owns both directions so export → import round-trips by
// construction.

export interface FileBookmark {
  // Milliseconds since the epoch.
  addedAt?: number;
  kind: "bookmark";
  title: string;
  url: string;
}

export interface FileFolder {
  addedAt?: number;
  children: FileNode[];
  kind: "folder";
  title: string;
}

export type FileNode = FileBookmark | FileFolder;

export type BookmarkFileSource =
  | "Chrome"
  | "Edge"
  | "Firefox"
  | "Safari"
  | "SchnellBuch"
  | "a browser";

// A ConvexError, so the message reaches the person who picked the file.
class NotABookmarkFileError extends ConvexError<string> {
  constructor() {
    super(
      "That file isn't a bookmarks export. Export your bookmarks from your browser as an HTML file and try again."
    );
    this.name = "NotABookmarkFileError";
  }
}

const DOCTYPE = /<!doctype\s+netscape-bookmark-file-1\s*>/iu;
const TOKEN =
  /<dl\b[^>]*>|<\/dl\s*>|<h3\b(?<folderAttributes>[^>]*)>(?<folderTitle>[\s\S]*?)<\/h3\s*>|<a\b(?<linkAttributes>[^>]*)>(?<linkTitle>[\s\S]*?)<\/a\s*>/giu;
const TAG = /<[^>]*>/gu;
const WHITESPACE_RUN = /\s+/gu;
const SCHNELLBUCH_MARK = "<!-- Exported from SchnellBuch -->";
const SECONDS_UPPER_BOUND = 1e11;
const MILLISECONDS_UPPER_BOUND = 1e14;
const MS_PER_SECOND = 1000;
const INDENT = "    ";
const EDGE_TOOLBAR = /<h3\b[^>]*>\s*favorites bar\s*<\/h3>/iu;
const CHROME_TOOLBAR = /personal_toolbar_folder/iu;
const CHROME_BAR_NAME = /bookmarks bar/iu;
const FIREFOX_MARKS =
  /<h1>\s*bookmarks menu\s*<\/h1>|unfiled_bookmarks_folder/iu;
const SAFARI_MARKS = /com\.apple\.readinglist|<h3\b[^>]*\bfolded\b/iu;

export function parseBookmarkFile(html: string) {
  const root: FileFolder = { kind: "folder", title: "", children: [] };
  const state: ParseState = {
    root,
    stack: [],
    sawList: false,
    sawEntry: false,
  };
  for (const match of html.matchAll(TOKEN)) {
    readToken(state, match[0].toLowerCase(), match.groups ?? {});
  }
  if (!(DOCTYPE.test(html) || (state.sawList && state.sawEntry))) {
    throw new NotABookmarkFileError();
  }
  return { source: detectSource(html), children: root.children };
}

interface ParseState {
  pendingFolder?: FileFolder;
  root: FileFolder;
  sawEntry: boolean;
  sawList: boolean;
  stack: FileFolder[];
}

function readToken(
  state: ParseState,
  token: string,
  groups: Partial<Record<string, string>>
) {
  const current = state.stack.at(-1) ?? state.root;
  if (token.startsWith("<dl")) {
    // A list belongs to the folder heading just before it.
    state.sawList = true;
    state.stack.push(state.pendingFolder ?? current);
    state.pendingFolder = undefined;
    return;
  }
  if (token.startsWith("</dl")) {
    state.stack.pop();
    return;
  }
  state.sawEntry = true;
  if (groups.folderAttributes !== undefined) {
    const folder: FileFolder = {
      kind: "folder",
      title: textOf(groups.folderTitle ?? ""),
      addedAt: parseAddDate(readAttributes(groups.folderAttributes).add_date),
      children: [],
    };
    current.children.push(folder);
    state.pendingFolder = folder;
    return;
  }
  const attributes = readAttributes(groups.linkAttributes ?? "");
  current.children.push({
    kind: "bookmark",
    title: textOf(groups.linkTitle ?? ""),
    url: (attributes.href ?? "").trim(),
    addedAt: parseAddDate(attributes.add_date),
  });
}

export function serializeBookmarkFile(children: FileNode[]) {
  return [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    "<!-- This is an automatically generated file.",
    "     It will be read and overwritten.",
    "     DO NOT EDIT! -->",
    SCHNELLBUCH_MARK,
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Bookmarks</H1>",
    ...serializeList(children, 0),
    "",
  ].join("\n");
}

export function countBookmarks(nodes: FileNode[]): number {
  return nodes.reduce(
    (total, node) =>
      total + (node.kind === "bookmark" ? 1 : countBookmarks(node.children)),
    0
  );
}

function serializeList(children: FileNode[], depth: number): string[] {
  const indent = INDENT.repeat(depth);
  return [
    `${indent}<DL><p>`,
    ...children.flatMap((node) => serializeNode(node, depth + 1)),
    `${indent}</DL><p>`,
  ];
}

function serializeNode(node: FileNode, depth: number): string[] {
  const indent = INDENT.repeat(depth);
  const addDate =
    node.addedAt === undefined
      ? ""
      : ` ADD_DATE="${Math.floor(node.addedAt / MS_PER_SECOND)}"`;
  if (node.kind === "bookmark") {
    return [
      `${indent}<DT><A HREF="${escapeHtml(node.url)}"${addDate}>${escapeHtml(node.title)}</A>`,
    ];
  }
  return [
    `${indent}<DT><H3${addDate}>${escapeHtml(node.title)}</H3>`,
    ...serializeList(node.children, depth),
  ];
}

function textOf(html: string) {
  return decodeEntities(html.replace(TAG, ""))
    .replace(WHITESPACE_RUN, " ")
    .trim();
}

// Browsers write seconds; a few tools write milliseconds or microseconds.
function parseAddDate(value: string | undefined) {
  const number = Number(value);
  if (!(value && Number.isFinite(number)) || number <= 0) {
    return;
  }
  if (number < SECONDS_UPPER_BOUND) {
    return number * MS_PER_SECOND;
  }
  if (number < MILLISECONDS_UPPER_BOUND) {
    return number;
  }
  return Math.floor(number / MS_PER_SECOND);
}

function detectSource(html: string): BookmarkFileSource {
  if (html.includes(SCHNELLBUCH_MARK)) {
    return "SchnellBuch";
  }
  if (EDGE_TOOLBAR.test(html)) {
    return "Edge";
  }
  if (CHROME_TOOLBAR.test(html) && CHROME_BAR_NAME.test(html)) {
    return "Chrome";
  }
  if (FIREFOX_MARKS.test(html)) {
    return "Firefox";
  }
  if (SAFARI_MARKS.test(html)) {
    return "Safari";
  }
  return "a browser";
}
