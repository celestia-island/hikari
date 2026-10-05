/**
 * templateGrammar — the shared `{{ token }}` fill-template mini-grammar.
 *
 * One parser serves every template surface (the HkTemplateField editor,
 * the HkTemplateText renderer, and any consumer that needs to reason
 * about a fill template programmatically): a value is a flat sequence of
 * literal text runs and whole tokens, and the serialization is
 * BYTE-EXACT — a token segment carries the exact raw text it was parsed
 * from (`{{name}}`, `{{ name }}`, `{{  name }}` all stay verbatim), so
 * parse→serialize round-trips the string and an editor can map caret
 * offsets through a re-render without any length algebra.
 *
 * The grammar is deliberately conservative: only `{{ word }}` with a
 * bare identifier inside (`[A-Za-z0-9_]+`) is a token. Anything else —
 * pipes/filters, dotted paths, spaces inside the braces — stays literal
 * text, so engines with richer grammars (tera filters, mustache
 * sections) never get silently rewritten by merely rendering through
 * these components.
 */

/** One vocabulary entry the host knows how to fill. */
export interface HkTemplateTokenDef {
  /** The bare identifier spelled inside the braces (`md5_email`). */
  name: string;
  /** Human label for menus; defaults to `name`. */
  label?: string;
  /** What the value is / how the host computes it — shown in the chip
   * editor and as the read-only chip's title. */
  description?: string;
  /** Optional grouping key for menus (`email`, `username`…). */
  group?: string;
}

export interface HkTemplateTokenSegment {
  kind: "token";
  /** The bare identifier (`md5_email`). */
  token: string;
  /** The exact source text (`{{ md5_email }}`) — serialization is
   * byte-exact, so this is never normalized. */
  raw: string;
}

export interface HkTemplateTextSegment {
  kind: "text";
  text: string;
}

export type HkTemplateSegment = HkTemplateTokenSegment | HkTemplateTextSegment;

const TOKEN_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/**
 * Split a fill template into literal text and whole tokens. Adjacent
 * text runs are merged; the empty string parses to an empty list.
 */
export function parseTemplate(text: string): HkTemplateSegment[] {
  const segments: HkTemplateSegment[] = [];
  let cursor = 0;
  TOKEN_RE.lastIndex = 0;
  for (let m = TOKEN_RE.exec(text); m; m = TOKEN_RE.exec(text)) {
    if (m.index > cursor) {
      segments.push({ kind: "text", text: text.slice(cursor, m.index) });
    }
    segments.push({ kind: "token", token: m[1]!, raw: m[0] });
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) {
    segments.push({ kind: "text", text: text.slice(cursor) });
  }
  return segments;
}

/**
 * Fold segments back into the template string. Byte-exact by
 * construction: text runs pass through and tokens re-emit their `raw`.
 */
export function serializeTemplate(segments: readonly HkTemplateSegment[]): string {
  return segments
    .map((s) => (s.kind === "text" ? s.text : s.raw))
    .join("");
}

/** The canonical display spelling of a token name for chips and menus
 * (`md5_email` → `{{ md5_email }}`). Chips render this text so the
 * styled form still reads as the exact template it serializes to. */
export function formatTokenDisplay(token: string): string {
  return `{{ ${token} }}`;
}

/** Build a name→def lookup for a vocabulary (last entry wins, matching
 * consumers that append overrides). */
export function templateTokenIndex(
  defs: readonly HkTemplateTokenDef[],
): Map<string, HkTemplateTokenDef> {
  const map = new Map<string, HkTemplateTokenDef>();
  for (const def of defs) map.set(def.name, def);
  return map;
}
