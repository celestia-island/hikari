import { describe, expect, it } from "vitest";

import { fuzzyScore, fuzzyScoreFields, fuzzySearch } from "./fuzzy";

describe("fuzzyScore", () => {
  it("treats an empty query as a (zero-score) match", () => {
    expect(fuzzyScore("", "anything")).toEqual({ matched: true, score: 0 });
  });

  it("scores an exact substring highest, with a boundary bonus", () => {
    const mid = fuzzyScore("err", "terrors"); // substring, but mid-word (prev = 't')
    const start = fuzzyScore("err", "error log"); // substring at a word edge
    expect(mid.matched).toBe(true);
    expect(start.matched).toBe(true);
    // Substring at a word boundary should beat a mid-word substring.
    expect(start.score).toBeGreaterThan(mid.score);
  });

  it("matches as a subsequence with run + boundary bonuses", () => {
    const res = fuzzyScore("rep", "report");
    expect(res.matched).toBe(true);
    expect(res.score).toBeGreaterThan(0);
  });

  it("does not match when characters are out of order / missing", () => {
    expect(fuzzyScore("xyz", "report").matched).toBe(false);
    expect(fuzzyScore("rp", "par").matched).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(fuzzyScore("REP", "report").matched).toBe(true);
    expect(fuzzyScore("rep", "REPORT").matched).toBe(true);
  });
});

describe("fuzzyScoreFields", () => {
  it("returns the best weighted score across fields", () => {
    const res = fuzzyScoreFields("err", [
      { text: "Report: execution error", weight: 3 },
      { text: "ferry crossing", weight: 1 },
    ]);
    expect(res.matched).toBe(true);
    expect(res.score).toBeGreaterThan(0);
  });

  it("reports no match when no field matches", () => {
    expect(fuzzyScoreFields("zzz", [{ text: "report" }]).matched).toBe(false);
  });
});

describe("fuzzySearch", () => {
  interface Rec { title: string; body: string }
  const records: Rec[] = [
    { title: "Execution error", body: "fuel cell tripped" },
    { title: "Daily summary", body: "all systems nominal" },
    { title: "ferry schedule", body: "crossing at noon" },
  ];
  const fieldsOf = (r: Rec) => [
    { text: r.title, weight: 3 },
    { text: r.body, weight: 1 },
  ];

  it("returns all records (score 0) for an empty query", () => {
    const out = fuzzySearch("", records, fieldsOf);
    expect(out).toHaveLength(records.length);
  });

  it("requires every whitespace-separated term to match some field", () => {
    const out = fuzzySearch("error fuel", records, fieldsOf);
    expect(out).toHaveLength(1);
    expect(out[0].record.title).toBe("Execution error");
  });

  it("drops records where any term is absent", () => {
    const out = fuzzySearch("error nominal", records, fieldsOf);
    expect(out).toHaveLength(0);
  });

  it("ranks higher-scoring matches first", () => {
    const pool: Rec[] = [
      { title: "error", body: "" },            // title-only exact
      { title: "misc", body: "an error ocurred" }, // body subsequence
    ];
    const out = fuzzySearch("error", pool, fieldsOf);
    expect(out[0].record.title).toBe("error");
  });
});
