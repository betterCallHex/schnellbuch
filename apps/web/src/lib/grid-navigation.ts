const STEP_BY_KEY: Record<string, "previous" | "next" | "up" | "down"> = {
  ArrowLeft: "previous",
  ArrowRight: "next",
  ArrowUp: "up",
  ArrowDown: "down",
};

export const GRID_ARROW_KEYS = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
] as const;

export function nextGridIndex({
  current,
  key,
  columns,
  count,
}: {
  current: number | undefined;
  key: string;
  columns: number;
  count: number;
}) {
  if (count === 0) {
    return;
  }
  if (current === undefined) {
    return 0;
  }
  const offsetByStep = { previous: -1, next: 1, up: -columns, down: columns };
  const step = STEP_BY_KEY[key];
  const target = step === undefined ? current : current + offsetByStep[step];
  return Math.min(Math.max(target, 0), count - 1);
}

// How many tiles of at least minWidth fit across, with gap between them.
export function gridColumns(width: number, minWidth: number, gap: number) {
  return Math.max(1, Math.floor((width + gap) / (minWidth + gap)));
}

// The keys from anchor to key, inclusive, in the order they're shown.
export function selectRange(keys: string[], anchor: string, key: string) {
  const from = keys.indexOf(anchor);
  const to = keys.indexOf(key);
  if (from === -1 || to === -1) {
    return to === -1 ? [] : [key];
  }
  return keys.slice(Math.min(from, to), Math.max(from, to) + 1);
}
