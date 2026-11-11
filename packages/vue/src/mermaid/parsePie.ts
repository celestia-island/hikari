/**
 * parsePie.ts — `pie` parser, a line-oriented mirror of ratatui-markdown's
 * `pie.rs`:
 *
 *  - `pie` may carry `title X` on the same line; a separate `title X`
 *    line also works and wins if it appears later;
 *  - slices are `"Label": 12.5` (quoted — the value follows the closing
 *    quote, a colon is optional) or `Label: 12.5` (unquoted — the LAST
 *    colon splits label from value);
 *  - values must parse as positive numbers.
 *
 * No slices → not a pie chart → null.
 */

import type { MermaidPieDoc } from "./types";
import { MermaidParseError } from "./parseGraph";

function parseSlice(line: string): { label: string; value: number } | null {
  let labelPart: string;
  let valuePart: string;
  if (line.startsWith('"')) {
    const endQuote = line.indexOf('"', 1);
    if (endQuote < 0) return null;
    labelPart = line.slice(1, endQuote);
    const rest = line.slice(endQuote + 1).trim();
    valuePart = rest.startsWith(":") ? rest.slice(1).trim() : rest;
  } else {
    const colon = line.lastIndexOf(":");
    if (colon < 0) return null;
    labelPart = line.slice(0, colon).trim();
    valuePart = line.slice(colon + 1).trim();
  }
  const value = Number(valuePart);
  if (!Number.isFinite(value) || value <= 0) return null;
  return { label: labelPart, value };
}

export function parsePie(source: string): MermaidPieDoc {
  let title: string | null = null;
  const slices: Array<{ label: string; value: number }> = [];

  for (const raw of source.split(/\r\n|\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("%%")) continue;

    if (line.startsWith("pie")) {
      const rest = line.slice(3).trim();
      if (rest.startsWith("title ")) title = rest.slice(6).trim();
      continue;
    }
    if (line.startsWith("title ")) {
      title = line.slice(6).trim();
      continue;
    }
    const slice = parseSlice(line);
    if (slice) slices.push(slice);
  }

  if (slices.length === 0) throw new MermaidParseError("pie chart has no slices");
  return { kind: "pie", title, slices };
}
