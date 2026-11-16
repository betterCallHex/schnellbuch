import { describe, expect, test as it } from "bun:test";
import { portsFor, SLOT_COUNT, slotFor, stackName } from "./ports";

const READABLE_NAME = /^my-feature-[0-9a-f]{8}$/u;

describe("worktree ports", () => {
  it("the same path always gets the same ports", () => {
    expect(slotFor("/work/schnellbuch")).toBe(slotFor("/work/schnellbuch"));
  });

  it("different worktrees get different slots", () => {
    const slots = new Set(
      ["main", "feature-a", "feature-b", "fix-c", "agent-1", "agent-2"].map(
        (name) => slotFor(`/work/schnellbuch/.worktrees/${name}`)
      )
    );
    expect(slots.size).toBe(6);
  });

  it("a slot's three ports sit together inside 20000-29999", () => {
    expect(portsFor(0)).toEqual({ backend: 20_000, site: 20_001, web: 20_002 });
    expect(portsFor(SLOT_COUNT - 1).web).toBe(29_992);
    expect(portsFor(SLOT_COUNT)).toEqual(portsFor(0));
  });

  it("stack names are readable and unique per path", () => {
    expect(stackName("/work/My Feature!")).toMatch(READABLE_NAME);
    expect(stackName("/a/x")).not.toBe(stackName("/b/x"));
  });
});
