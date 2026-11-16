export interface ImportCounts {
  duplicates: number;
  failed: number;
  imported: number;
  nonWeb: number;
  total: number;
}

export function importProgress(counts: ImportCounts) {
  const handled =
    counts.imported + counts.duplicates + counts.nonWeb + counts.failed;
  return counts.total === 0 ? 1 : Math.min(handled / counts.total, 1);
}

export function importSummary(counts: ImportCounts) {
  const skipped = [
    plural(counts.duplicates, "duplicate", "duplicates"),
    plural(counts.nonWeb, "non-web link", "non-web links"),
    plural(counts.failed, "failed link", "failed links"),
  ].filter((part) => part !== undefined);
  const imported = `Imported ${counts.imported} ${counts.imported === 1 ? "bookmark" : "bookmarks"}.`;
  return skipped.length === 0
    ? imported
    : `${imported} Skipped ${joinWithAnd(skipped)}.`;
}

function plural(count: number, one: string, many: string) {
  if (count === 0) {
    return;
  }
  return `${count} ${count === 1 ? one : many}`;
}

function joinWithAnd(parts: string[]) {
  if (parts.length <= 1) {
    return parts.join("");
  }
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}
