/**
 * parseQuadrant.ts — `quadrantChart` parser, a line-oriented mirror of
 * ratatui-markdown's `quadrant.rs`:
 *
 *  - `quadrantChart Title` (title on the keyword line) or `title X`;
 *  - `x-axis Low --> High` / `y-axis Low --> High` (two-part `-->` split;
 *    missing axes default to Low/High per the Rust port);
 *  - `quadrant-N Caption` (or bare `quadrant-N` = default `QN`);
 *  - points: `Label: [x, y]` — coords must parse as finite numbers.
 *
 * A chart with no points is not a chart → null (Rust parity).
 */

import type { MermaidQuadrantDoc } from "./types";
import { MermaidParseError } from "./parseGraph";
import { PLAIN_FLOAT } from "./parsePie";

export function parseQuadrant(source: string): MermaidQuadrantDoc {
  let title: string | null = null;
  let xAxisLeft = "";
  let xAxisRight = "";
  let yAxisBottom = "";
  let yAxisTop = "";
  const quadrants: Array<string | null> = [null, null, null, null];
  const points: MermaidQuadrantDoc["points"] = [];

  for (const raw of source.split(/\r\n|\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("%")) continue;

    if (line.startsWith("quadrantChart")) {
      const part = line.slice(13).trim();
      if (part !== "") title = part;
      continue;
    }
    if (line.startsWith("title ")) {
      title = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("x-axis ")) {
      const parts = line.slice(7).split("-->");
      if (parts.length === 2) {
        xAxisLeft = parts[0].trim();
        xAxisRight = parts[1].trim();
      }
      continue;
    }
    if (line.startsWith("y-axis ")) {
      const parts = line.slice(7).split("-->");
      if (parts.length === 2) {
        yAxisBottom = parts[0].trim();
        yAxisTop = parts[1].trim();
      }
      continue;
    }

    let matchedQuadrant = false;
    for (let i = 0; i < 4; i += 1) {
      const prefix = `quadrant-${i + 1} `;
      const alt = `quadrant-${i + 1}`;
      if (line.startsWith(prefix)) {
        quadrants[i] = line.slice(prefix.length).trim();
        matchedQuadrant = true;
      } else if (line === alt) {
        quadrants[i] = `Q${i + 1}`;
        matchedQuadrant = true;
      }
    }
    if (matchedQuadrant) continue;

    const colon = line.indexOf(":");
    if (colon >= 0) {
      const label = line.slice(0, colon).trim();
      const rest = line.slice(colon + 1).trim();
      const open = rest.indexOf("[");
      const close = rest.indexOf("]");
      if (open >= 0 && close > open) {
        const coords = rest.slice(open + 1, close).trim();
        const parts = coords.split(",");
        if (parts.length === 2) {
          // Rust f64 parse semantics: plain decimals only (no hex, no
          // empty → 0) — R2 finding 9. Shared guard from parsePie.
          const xs = parts[0].trim();
          const ys = parts[1].trim();
          if (PLAIN_FLOAT.test(xs) && PLAIN_FLOAT.test(ys)) {
            const x = Number(xs);
            const y = Number(ys);
            if (Number.isFinite(x) && Number.isFinite(y)) {
              points.push({ label, x, y });
            }
          }
        }
      }
    }
  }

  if (points.length === 0) {
    throw new MermaidParseError("quadrant chart has no points");
  }
  return {
    kind: "quadrant",
    title,
    xAxisLeft: xAxisLeft === "" ? "Low" : xAxisLeft,
    xAxisRight: xAxisRight === "" ? "High" : xAxisRight,
    yAxisBottom: yAxisBottom === "" ? "Low" : yAxisBottom,
    yAxisTop: yAxisTop === "" ? "High" : yAxisTop,
    quadrants,
    points,
  };
}
