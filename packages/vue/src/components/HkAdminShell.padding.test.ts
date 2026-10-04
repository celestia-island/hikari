import { describe, expect, it } from "vitest";

import { mobileSideGutterFree, scanPaddingSides, splitPaddingSides } from "./HkAdminShell";

/**
 * Direct unit tests for the padding-shorthand helpers behind
 * `HkAdminShell`'s `contentBleedOnMobile`.
 *
 * WHY THIS FILE EXISTS (and why the component-level suite cannot replace
 * it): the DOM assertions in HkAdminShell.test.tsx run through
 * happy-dom's CSS parser, which refuses to round-trip exactly the values
 * these helpers exist to protect — `var(...)` with a fallback, `clamp()`,
 * a quoted argument — and normalizes the ones it does keep, so a
 * regression there is invisible at the component level (round-2 and
 * round-3 verification both proved a surviving mutant that the DOM suite
 * scored green). The helpers are exported for this file only: they are
 * not re-exported from the package barrel.
 *
 * The contract, in one line each:
 * - `splitPaddingSides` splits on TOP-LEVEL whitespace only (functions
 *   and quoted arguments are one track), tolerates tabs/newlines and
 *   surrounding whitespace, and never lets a stray `)` invert the depth;
 * - `mobileSideGutterFree` keeps the vertical tracks, zeroes the
 *   horizontal ones, and returns the value VERBATIM whenever the rewrite
 *   could produce a declaration a browser would drop whole.
 */
describe("splitPaddingSides", () => {
  it("splits a plain shorthand into its tracks", () => {
    expect(splitPaddingSides("2rem")).toEqual(["2rem"]);
    expect(splitPaddingSides("1rem 2rem")).toEqual(["1rem", "2rem"]);
    expect(splitPaddingSides("1rem 2rem 3rem")).toEqual(["1rem", "2rem", "3rem"]);
    expect(splitPaddingSides("1rem 2rem 3rem 4rem")).toEqual(["1rem", "2rem", "3rem", "4rem"]);
  });

  it("treats every CSS separator like a space and drops no empty track", () => {
    expect(splitPaddingSides("1rem\t2rem")).toEqual(["1rem", "2rem"]);
    expect(splitPaddingSides("1rem\n2rem")).toEqual(["1rem", "2rem"]);
    expect(splitPaddingSides("1rem \n\t 2rem")).toEqual(["1rem", "2rem"]);
    expect(splitPaddingSides("  1rem 2rem  ")).toEqual(["1rem", "2rem"]);
    expect(splitPaddingSides("")).toEqual([]);
    expect(splitPaddingSides("   ")).toEqual([]);
  });

  it("keeps a function value as ONE track, however many spaces it holds", () => {
    expect(splitPaddingSides("calc(1rem + 2px)")).toEqual(["calc(1rem + 2px)"]);
    expect(splitPaddingSides("calc(1rem + 2px) 1rem")).toEqual(["calc(1rem + 2px)", "1rem"]);
    expect(splitPaddingSides("1rem calc(2px + 3px)")).toEqual(["1rem", "calc(2px + 3px)"]);
    // A space directly after "(" is inside the function too.
    expect(splitPaddingSides("calc( 1rem + 2px ) 1rem")).toEqual(["calc( 1rem + 2px )", "1rem"]);
  });

  it("balances nested parentheses", () => {
    expect(splitPaddingSides("clamp(1rem, min(2vw, 3px), 4rem) 2rem"))
      .toEqual(["clamp(1rem, min(2vw, 3px), 4rem)", "2rem"]);
    expect(splitPaddingSides("calc(1rem + calc(2px * 2))"))
      .toEqual(["calc(1rem + calc(2px * 2))"]);
  });

  it("keeps a quoted argument intact, its parens and spaces included", () => {
    expect(splitPaddingSides("var(--pad, \") 1rem\") 2rem"))
      .toEqual(["var(--pad, \") 1rem\")", "2rem"]);
    expect(splitPaddingSides("var(--pad, ' + ')")).toEqual(["var(--pad, ' + ')"]);
    // A paren inside a SINGLE-quoted argument, and the other quote char
    // inside it: only the matching quote closes the string.
    expect(splitPaddingSides("var(--pad, ') x') 2rem"))
      .toEqual(["var(--pad, ') x')", "2rem"]);
    expect(splitPaddingSides("var(--pad, 'a\") b') 2rem"))
      .toEqual(["var(--pad, 'a\") b')", "2rem"]);
  });

  it("opens a quote at top level too (and reports it unterminated)", () => {
    expect(splitPaddingSides("\"a b")).toEqual(["\u0022a b"]);
    expect(scanPaddingSides("\"a b").balanced).toBe(false);
  });

  it("never lets a stray close paren invert the depth", () => {
    // Malformed CSS in, but the tracks must not silently merge: without
    // the clamp the `)` would drive the depth to -1 and swallow the next
    // separator.
    expect(splitPaddingSides("1rem ) 2rem")).toEqual(["1rem", ")", "2rem"]);
  });

  it("reports an unterminated function or quote as unbalanced", () => {
    expect(scanPaddingSides("calc(1rem + 2px")).toEqual({
      sides: ["calc(1rem + 2px"],
      balanced: false,
    });
    expect(scanPaddingSides("1rem 2rem").balanced).toBe(true);
    expect(scanPaddingSides("calc(1rem + 2px) 1rem").balanced).toBe(true);
    expect(scanPaddingSides("var(--pad, ') x')").balanced).toBe(true);
  });
});

describe("mobileSideGutterFree", () => {
  it("keeps the vertical tracks and zeroes the horizontal ones", () => {
    expect(mobileSideGutterFree("2rem")).toBe("2rem 0 2rem");
    expect(mobileSideGutterFree("1rem 2rem")).toBe("1rem 0 1rem");
    expect(mobileSideGutterFree("1rem 2rem 3rem")).toBe("1rem 0 3rem");
    expect(mobileSideGutterFree("1rem 2rem 3rem 4rem")).toBe("1rem 0 3rem");
    expect(mobileSideGutterFree("0")).toBe("0 0 0");
    expect(mobileSideGutterFree(" 1rem\t2rem ")).toBe("1rem 0 1rem");
  });

  it("keeps a function value whole", () => {
    expect(mobileSideGutterFree("calc(1rem + 2px)")).toBe("calc(1rem + 2px) 0 calc(1rem + 2px)");
    expect(mobileSideGutterFree("calc(1rem + 2px) 1rem")).toBe("calc(1rem + 2px) 0 calc(1rem + 2px)");
    expect(mobileSideGutterFree("5rem clamp(1rem, min(2vw, 3px), 4rem)")).toBe("5rem 0 5rem");
  });

  it("returns the value verbatim when the rewrite cannot be expressed", () => {
    // Nothing to strip.
    expect(mobileSideGutterFree("")).toBe("");
    expect(mobileSideGutterFree("   ")).toBe("   ");
    // A CSS-wide keyword cannot be combined per side: `inherit 0 inherit`
    // is not a padding at all, so bleeding would cost the page its
    // vertical clearance.
    for (const keyword of ["inherit", "initial", "unset", "revert", "revert-layer"]) {
      expect(mobileSideGutterFree(keyword), keyword).toBe(keyword);
      expect(mobileSideGutterFree(keyword.toUpperCase()), keyword).toBe(keyword.toUpperCase());
    }
    // A comment's text is not a track; rebuilding would emit one
    // ("1rem 0 x") that a browser drops whole. An UNCLOSED comment bails
    // the same way, and so does a quoted `/*` — the guard reads the raw
    // text and does not try to be clever about strings.
    expect(mobileSideGutterFree("1rem /* x */ 2rem")).toBe("1rem /* x */ 2rem");
    expect(mobileSideGutterFree("1rem /* x 2rem")).toBe("1rem /* x 2rem");
    expect(mobileSideGutterFree("var(--pad, \"/*\") 2rem")).toBe("var(--pad, \"/*\") 2rem");
  });

  it("refuses any value carrying a backslash escape", () => {
    // The scanner does not decode CSS escapes, and an escape can hide a
    // quote, a paren or a whole keyword — `"\69 nherit"` IS `inherit` to
    // an engine (measured in Chromium), so the literal text is not the
    // value and no rewrite of it can be trusted. Round 4/5 verification
    // measured every one of these losing all four sides to a dropped
    // declaration.
    const escaped = [
      "\\69 nherit",
      "var(--pad, \"a\\\"b\") 2rem",
      "var(--pad, 'a\\'b') 2rem",
      "var(--pad, a\\(b) 2rem",
      "\"a\\\" b\" 1rem",
    ];
    for (const value of escaped) {
      expect(mobileSideGutterFree(value), value).toBe(value);
    }
  });

  it("refuses a value whose functions or quotes never close", () => {
    // CSS auto-closes an open function at EOF, so the AUTHORED value can
    // be a real padding (Chromium: 18px on all four sides for
    // "calc(1rem + 2px") while the rewrite of it is not — the rewrite
    // would cost the page every side, vertical included.
    const unterminated = [
      "calc(1rem + 2px",
      "calc(1rem",
      "min(1rem, 2rem",
      "1rem calc(2px",
      "\"a b",
      "var(--pad, 'x",
    ];
    for (const value of unterminated) {
      expect(mobileSideGutterFree(value), value).toBe(value);
    }
  });

  it("still rewrites a keyword-shaped track that is not alone", () => {
    // Only a LONE keyword is unrewritable; as one track of several it is
    // just a value the author wrote.
    expect(mobileSideGutterFree("inherit 2rem")).toBe("inherit 0 inherit");
    expect(mobileSideGutterFree("1rem inherit")).toBe("1rem 0 1rem");
  });
});
