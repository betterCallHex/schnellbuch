const ENTITY = /&(?<code>#x[\da-f]+|#\d+|[a-z]+);/giu;
const ATTRIBUTE =
  /(?<name>[a-z_:-]+)(?:\s*=\s*(?:"(?<double>[^"]*)"|'(?<single>[^']*)'|(?<bare>[^\s"'>]+)))?/giu;
const SPECIAL_CHARACTERS = /[&<>"']/gu;
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};
const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const MAX_CODE_POINT = 0x10_ff_ff;

export function decodeEntities(text: string) {
  return text.replace(ENTITY, (entity, code: string) => {
    const lowered = code.toLowerCase();
    if (lowered.startsWith("#")) {
      const value = lowered.startsWith("#x")
        ? Number.parseInt(lowered.slice(2), 16)
        : Number.parseInt(lowered.slice(1), 10);
      return value > 0 && value <= MAX_CODE_POINT
        ? String.fromCodePoint(value)
        : entity;
    }
    return NAMED_ENTITIES[lowered] ?? entity;
  });
}

export function escapeHtml(text: string) {
  return text.replace(
    SPECIAL_CHARACTERS,
    (character) => ESCAPES[character] ?? character
  );
}

// Attribute names are lowercased; values are decoded. A bare attribute
// (`FOLDED`) gets an empty string.
export function readAttributes(tagSource: string) {
  const attributes: Partial<Record<string, string>> = {};
  for (const match of tagSource.matchAll(ATTRIBUTE)) {
    const { name, double, single, bare } = match.groups ?? {};
    if (name) {
      attributes[name.toLowerCase()] = decodeEntities(
        double ?? single ?? bare ?? ""
      );
    }
  }
  return attributes;
}
