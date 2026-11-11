/**
 * parseGantt.ts — `gantt` parser, a line-oriented mirror of ratatui-markdown's
 * `gantt.rs`:
 *
 *  - `title X` (also `dateFormat` / `axisFormat` lines, which are skipped
 *    without interpretation — the TS layout derives its own day axis);
 *  - `section NAME` opens a section; tasks before any section land in an
 *    anonymous one;
 *  - `Task name: id, after dep1 dep2, 5d` — after the FIRST colon: the
 *    first field is the task id, `after ...` lists dependency ids (a
 *    comma-separated `after a,b` splits per the Rust port), a `Nd` field
 *    is the duration, and any other first loose field is taken as the
 *    duration verbatim.
 *
 * A gantt with no tasks at all → null.
 */

import type { MermaidGanttDoc } from "./types";
import { MermaidParseError } from "./parseGraph";

function parseTask(line: string): { name: string; id: string | null; deps: string[]; duration: string | null } | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const name = line.slice(0, colon).trim();
  const parts = line
    .slice(colon + 1)
    .split(",")
    .map((p) => p.trim());

  let id: string | null = parts.length > 0 ? parts[0] : null;
  let deps: string[] | null = null;
  let duration: string | null = null;

  for (const part of parts.slice(1)) {
    if (part === "") continue;
    if (/^\d+(?:\.\d+)?d$/.test(part)) {
      duration = part;
      continue;
    }
    if (part.startsWith("after ")) {
      deps = part
        .slice(6)
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "");
      continue;
    }
    if (duration === null) duration = part;
  }

  return { name, id: id === "" ? null : id, deps: deps ?? [], duration };
}

export function parseGantt(source: string): MermaidGanttDoc {
  let title: string | null = null;
  const sections: MermaidGanttDoc["sections"] = [];
  let current: { name: string; tasks: MermaidGanttDoc["sections"][number]["tasks"] } | null = null;

  for (const raw of source.split(/\r\n|\n/)) {
    const line = raw.trim();
    if (line === "" || line === "gantt") continue;

    if (line.startsWith("title ")) {
      title = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("dateFormat") || line.startsWith("axisFormat") || line.startsWith("%%")) continue;

    if (line.startsWith("section ")) {
      if (current && current.tasks.length > 0) sections.push(current);
      current = { name: line.slice(8).trim(), tasks: [] };
      continue;
    }

    const task = parseTask(line);
    if (task) {
      if (!current) current = { name: "", tasks: [] };
      current.tasks.push(task);
    }
  }
  if (current && current.tasks.length > 0) sections.push(current);

  if (sections.every((s) => s.tasks.length === 0)) {
    throw new MermaidParseError("gantt chart has no tasks");
  }
  return { kind: "gantt", title, sections };
}
