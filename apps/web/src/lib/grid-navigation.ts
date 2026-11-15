const STEP_BY_KEY: Record<string, "previous" | "next" | "up" | "down"> = {
  ArrowLeft: "previous",
  ArrowRight: "next",
  ArrowUp: "up",
  ArrowDown: "down",
};

export function isGridArrowKey(key: string) {
  return key in STEP_BY_KEY;
}

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
