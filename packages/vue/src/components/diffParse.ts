/**
 * Unified-diff parsing for HkDiffViewer — pure functions, no Vue.
 *
 * Input is classic unified-diff text (`--- a/<path>` / `+++ b/<path>`
 * headers followed by `@@ -oldStart[,oldCount] +newStart[,newCount @@`
 * hunks). Only the hunk bodies are modeled; file headers are skipped
 * (the consumer already knows the path and renders it itself).
 *
 * Line numbering follows the unified format contract: 1-based, and a
 * `,count` of zero pins the start to the line BEFORE the range (so a
 * pure-addition hunk reads `@@ -0,0 +1,31 @@`).
 */

export type DiffLineKind = "context" | "add" | "del";

export interface DiffLine {
  kind: DiffLineKind;
  /** 1-based old-side line number (null for additions). */
  oldNo: number | null;
  /** 1-based new-side line number (null for deletions). */
  newNo: number | null;
  /** Line content without the +/-/space prefix. */
  text: string;
}

export interface DiffHunk {
  /** The raw `@@ … @@` line including any trailing section heading. */
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface ParsedDiff {
  hunks: DiffHunk[];
  /**
   * Highest new-side line number covered by the last hunk (0 when the
   * diff carries no hunks). The collapsed region after the last hunk
   * spans `endCovered + 1 … totalLines`.
   */
  endCovered: number;
}

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Parse unified-diff text into hunks. Malformed hunks degrade gracefully:
 * a line that is neither prefix-tagged nor a new hunk header terminates
 * the current hunk instead of corrupting line numbering.
 */
export function parseUnifiedDiff(diff: string): ParsedDiff {
  const hunks: DiffHunk[] = [];
  let cur: DiffHunk | null = null;
  let oldNo = 0;
  let newNo = 0;

  // A trailing newline is the last line's terminator, not an extra line.
  const text = diff.endsWith("\n") ? diff.slice(0, -1) : diff;
  for (const rawLine of text.split("\n")) {
    // Tolerate CRLF streams: a stray \r must not leak into line text.
    const raw = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    const h = HUNK_RE.exec(raw);
    if (h) {
      cur = {
        header: raw,
        oldStart: Number(h[1]),
        oldCount: h[2] === undefined ? 1 : Number(h[2]),
        newStart: Number(h[3]),
        newCount: h[4] === undefined ? 1 : Number(h[4]),
        lines: [],
      };
      hunks.push(cur);
      // A zero-count range starts one line earlier (the range is empty);
      // the +1 below lands the first tagged line on the declared start.
      oldNo = cur.oldStart + (cur.oldCount === 0 ? 1 : 0);
      newNo = cur.newStart + (cur.newCount === 0 ? 1 : 0);
      continue;
    }
    if (!cur) continue; // file headers (---/+++), index lines, …
    const tag = raw[0];
    if (tag === "\\") continue; // "\ No newline at end of file"
    const text = raw.slice(1);
    if (tag === "+") {
      cur.lines.push({ kind: "add", oldNo: null, newNo, text });
      newNo += 1;
    } else if (tag === "-") {
      cur.lines.push({ kind: "del", oldNo, newNo: null, text });
      oldNo += 1;
    } else if (tag === " " || raw === "") {
      // A truly empty line is a context line whose trailing space was
      // stripped by an overeager serializer — accept it as context.
      cur.lines.push({ kind: "context", oldNo, newNo, text: raw === "" ? "" : text });
      oldNo += 1;
      newNo += 1;
    } else {
      // Unknown line: end the hunk rather than corrupt numbering.
      cur = null;
    }
  }

  const last = hunks[hunks.length - 1];
  // Same zero-count anchor rule as computeGaps (R2): a deletion hunk
  // `@@ -5,2 +4,0 @@` positions after new line 4, so it covers 1..4 —
  // and a whole-file deletion still floors at 0 (nothing covered).
  const endCovered = last
    ? Math.max(last.newStart + (last.newCount === 0 ? 1 : 0) + last.newCount - 1, 0)
    : 0;
  return { hunks, endCovered };
}

/** One collapsed stretch of unchanged lines, addressed on the new side. */
export interface UnchangedGap {
  /** 1-based new-side line number of the first hidden line. */
  start: number;
  /** Number of hidden lines. */
  count: number;
  /**
   * Shift from new-side to old-side numbering at this point in the file
   * (oldNo = newNo − shift), so fetched context lines render with both
   * line numbers.
   */
  shift: number;
  /** Expansion anchor: "end" for the leading gap (reveal near the first
   *  hunk first), "start" for every later gap. */
  anchor: "start" | "end";
  /** Index of the hunk that follows this gap (`hunks.length` = trailing). */
  beforeHunk: number;
}

/**
 * Compute the collapsed unchanged regions around `hunks`, each tagged
 * with the hunk it precedes so the renderer can interleave hunks and
 * gaps without index arithmetic. `totalLines` is the current file's line
 * count; pass undefined/null when unknown — the trailing region is then
 * omitted (it cannot be sized).
 */
export function computeGaps(parsed: ParsedDiff, totalLines?: number | null): UnchangedGap[] {
  const gaps: UnchangedGap[] = [];
  let prevEnd = 0; // highest new-side line covered so far
  parsed.hunks.forEach((hunk, i) => {
    // Zero-count ranges anchor one line into the existing side — the SAME
    // adjustment the parser applies to line numbering (R2 finding: a
    // `@@ -4,0 +5,2 @@` insertion sits after old line 4, so the leading
    // gap is new 1..4 with shift 0, not 1..4-with-shift-1; using the raw
    // starts rendered an "old 0" and mislabelled expanded context).
    const oldAnchor = hunk.oldStart + (hunk.oldCount === 0 ? 1 : 0);
    const newAnchor = hunk.newStart + (hunk.newCount === 0 ? 1 : 0);
    const gapStart = prevEnd + 1;
    const gapEnd = newAnchor - 1;
    if (gapEnd >= gapStart) {
      gaps.push({
        start: gapStart,
        count: gapEnd - gapStart + 1,
        shift: newAnchor - oldAnchor,
        anchor: i === 0 && prevEnd === 0 ? "end" : "start",
        beforeHunk: i,
      });
    }
    prevEnd = newAnchor + hunk.newCount - 1;
  });
  // A whole-file deletion ends at new-side 0 under the anchor rule; clamp
  // before sizing anything so the trailing region can never invent
  // line 0 (R1 finding: loadContext(0, …) is off the 1-based contract).
  const covered = Math.max(prevEnd, 0);
  if (totalLines != null && totalLines > covered) {
    const last = parsed.hunks[parsed.hunks.length - 1];
    const lastOldAnchor = last.oldStart + (last.oldCount === 0 ? 1 : 0);
    const lastNewAnchor = last.newStart + (last.newCount === 0 ? 1 : 0);
    gaps.push({
      start: covered + 1,
      count: totalLines - covered,
      shift: last ? lastNewAnchor + last.newCount - (lastOldAnchor + last.oldCount) : 0,
      anchor: "start",
      beforeHunk: parsed.hunks.length,
    });
  }
  return gaps;
}
