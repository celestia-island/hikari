import { describe, expect, it } from "vitest";

import { computeGaps, parseUnifiedDiff } from "./diffParse";

/**
 * diffParse — the pure half of HkDiffViewer. The pins that matter:
 * line numbering on both sides (the renderer's fetched context lines
 * must slot into exactly these numbers), zero-count hunk starts, and
 * gap computation (leading / inter-hunk / trailing, with the old-side
 * shift that lets context lines show both numbers).
 */

const SAMPLE = [
  "--- a/config/app.toml",
  "+++ b/config/app.toml",
  "@@ -10,4 +10,5 @@ fn main() {",
  " context-a",
  "-old-line",
  "+new-line-a",
  "+new-line-b",
  " context-b",
  " context-b2",
  "@@ -30,3 +31,3 @@",
  " context-c",
  "-gone",
  "+here",
  " context-d",
  "",
].join("\n");

describe("parseUnifiedDiff", () => {
  it("parses hunks with both-side line numbers", () => {
    const { hunks, endCovered } = parseUnifiedDiff(SAMPLE);
    expect(hunks).toHaveLength(2);

    const [h0, h1] = hunks;
    expect(h0.header).toBe("@@ -10,4 +10,5 @@ fn main() {");
    expect(h0.lines.map((l) => [l.kind, l.oldNo, l.newNo, l.text])).toEqual([
      ["context", 10, 10, "context-a"],
      ["del", 11, null, "old-line"],
      ["add", null, 11, "new-line-a"],
      ["add", null, 12, "new-line-b"],
      ["context", 12, 13, "context-b"],
      ["context", 13, 14, "context-b2"],
    ]);
    expect(h1.oldStart).toBe(30);
    expect(h1.newStart).toBe(31);
    expect(endCovered).toBe(33);
  });

  it("treats an omitted count as 1 and a zero count as an empty range", () => {
    const { hunks } = parseUnifiedDiff("@@ -0,0 +1 @@\n+only\n");
    expect(hunks[0].oldStart).toBe(0);
    expect(hunks[0].oldCount).toBe(0);
    expect(hunks[0].lines).toEqual([{ kind: "add", oldNo: null, newNo: 1, text: "only" }]);

    const del = parseUnifiedDiff("@@ -5 +4,0 @@\n-gone\n");
    expect(del.hunks[0].lines).toEqual([{ kind: "del", oldNo: 5, newNo: null, text: "gone" }]);
    // A deletion positions after new line 4 (the zero-count anchor rule),
    // so the covered new-side range is 1..4 — NOT 1..3 (R2: the raw-start
    // formula baked an off-by-one into this pin once).
    expect(del.endCovered).toBe(4);
  });

  it("computes gaps for a pure insertion hunk like git -U0 (R2)", () => {
    // `@@ -4,0 +5,2 @@` = insertion AFTER old line 4: the leading gap is
    // new 1..4 with shift 0, and the trailing side resumes at old 5.
    const parsed = parseUnifiedDiff("@@ -4,0 +5,2 @@\n+a\n+b\n");
    expect(computeGaps(parsed, 8)).toEqual([
      { start: 1, count: 4, shift: 0, anchor: "end", beforeHunk: 0 },
      { start: 7, count: 2, shift: 2, anchor: "start", beforeHunk: 1 },
    ]);
  });

  it("computes gaps for a pure deletion hunk like git -U0 (R2)", () => {
    // `@@ -5,2 +4,0 @@` = old 5..6 deleted, positioned after new line 4:
    // the unchanged new line 5 must expand ABOVE as part of no gap and
    // resume numbering at old 7 after the hunk (shift −2).
    const parsed = parseUnifiedDiff("@@ -5,2 +4,0 @@\n-gone-a\n-gone-b\n");
    expect(parsed.endCovered).toBe(4);
    expect(computeGaps(parsed, 6)).toEqual([
      { start: 1, count: 4, shift: 0, anchor: "end", beforeHunk: 0 },
      { start: 5, count: 2, shift: -2, anchor: "start", beforeHunk: 1 },
    ]);
  });

  it("skips file headers and \\-markers, and tolerates stripped blank context lines", () => {
    const diff = [
      "--- a/x",
      "+++ b/x",
      "@@ -1,4 +1,4 @@",
      " a",
      "", // a context line whose trailing space got stripped
      "-b",
      "+c",
      "\\ No newline at end of file",
      " d",
    ].join("\n");
    const { hunks } = parseUnifiedDiff(diff);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].lines.map((l) => l.kind)).toEqual(["context", "context", "del", "add", "context"]);
  });

  it("returns no hunks for empty or non-diff input", () => {
    expect(parseUnifiedDiff("").hunks).toEqual([]);
    expect(parseUnifiedDiff("hello\nworld").hunks).toEqual([]);
    expect(parseUnifiedDiff("").endCovered).toBe(0);
  });

  it("never invents line 0 for a whole-file deletion (R1)", () => {
    const parsed = parseUnifiedDiff("@@ -1,3 +0,0 @@\n-a\n-b\n-c\n");
    expect(parsed.endCovered).toBe(0);
    expect(computeGaps(parsed, 0)).toEqual([]);
    expect(computeGaps(parsed, null)).toEqual([]);
  });

  it("lands a stray context line on line 1 inside a zero-count old range (R1)", () => {
    // Malformed body (a context line where the old side is empty): the
    // defensive +1 on zero-count ranges is the only thing keeping this
    // line on the 1-based contract. Pins the behavior Mutation A broke.
    const { hunks } = parseUnifiedDiff("@@ -0,0 +1,2 @@\n ctx\n+a\n");
    expect(hunks[0].lines).toEqual([
      { kind: "context", oldNo: 1, newNo: 1, text: "ctx" },
      { kind: "add", oldNo: null, newNo: 2, text: "a" },
    ]);
  });

  it("tolerates CRLF line endings without leaking \\r into text", () => {
    const { hunks } = parseUnifiedDiff("@@ -1,2 +1,2 @@\r\n-old\r\n+new\r\n ctx\r\n");
    expect(hunks[0].lines).toEqual([
      { kind: "del", oldNo: 1, newNo: null, text: "old" },
      { kind: "add", oldNo: null, newNo: 1, text: "new" },
      { kind: "context", oldNo: 2, newNo: 2, text: "ctx" },
    ]);
  });
});

describe("computeGaps", () => {
  it("computes leading, inter-hunk and trailing gaps with old-side shifts", () => {
    const parsed = parseUnifiedDiff(SAMPLE);
    const gaps = computeGaps(parsed, 60);
    expect(gaps).toEqual([
      // Lines 1–9 precede the first hunk (newStart 10, oldStart 10 → shift 0).
      { start: 1, count: 9, shift: 0, anchor: "end", beforeHunk: 0 },
      // Hunk 0 covers new 10–14, hunk 1 starts at 31 → gap 15–30.
      // Old-side shift at hunk 1: newStart 31 − oldStart 30 = 1.
      { start: 15, count: 16, shift: 1, anchor: "start", beforeHunk: 1 },
      // Trailing: 34–60, shift from hunk 1's end: (31+3)−(30+3) = 1.
      { start: 34, count: 27, shift: 1, anchor: "start", beforeHunk: 2 },
    ]);
  });

  it("omits the trailing gap when the total line count is unknown", () => {
    const parsed = parseUnifiedDiff(SAMPLE);
    const gaps = computeGaps(parsed, null);
    expect(gaps).toHaveLength(2);
    expect(gaps.every((g) => g.beforeHunk < 2)).toBe(true);
  });

  it("produces no gaps for a whole-file addition", () => {
    const parsed = parseUnifiedDiff("@@ -0,0 +1,3 @@\n+a\n+b\n+c\n");
    expect(computeGaps(parsed, 3)).toEqual([]);
  });
});
