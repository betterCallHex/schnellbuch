import { createHash } from "node:crypto";
import { basename } from "node:path";

// Each worktree gets a slot of ports in 20000-29999, derived from its path,
// so parallel checkouts never collide unless their hashes do (and then the
// stack moves to the next free slot).
const PORT_BASE = 20_000;
export const SLOT_COUNT = 1000;
const PORTS_PER_SLOT = 10;
const HEX = 16;
const NAME_HASH_LENGTH = 8;
const NOT_SLUG = /[^a-z0-9]+/gu;
const EDGE_DASHES = /^-+|-+$/gu;

export interface StackPorts {
  backend: number;
  site: number;
  web: number;
}

function hashPath(path: string) {
  const digest = createHash("sha256").update(path).digest("hex");
  return Number.parseInt(digest.slice(0, NAME_HASH_LENGTH), HEX);
}

export function slotFor(path: string) {
  return hashPath(path) % SLOT_COUNT;
}

export function portsFor(slot: number): StackPorts {
  const base = PORT_BASE + (slot % SLOT_COUNT) * PORTS_PER_SLOT;
  return { backend: base, site: base + 1, web: base + 2 };
}

// A readable, unique name for the worktree's backend and state directory.
export function stackName(path: string) {
  const slug =
    basename(path)
      .toLowerCase()
      .replace(NOT_SLUG, "-")
      .replace(EDGE_DASHES, "") || "worktree";
  const hash = hashPath(path).toString(HEX).padStart(NAME_HASH_LENGTH, "0");
  return `${slug}-${hash}`;
}
