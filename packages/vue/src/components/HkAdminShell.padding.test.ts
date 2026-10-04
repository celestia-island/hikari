import { describe, expect, it } from "vitest";

import { mobileSideGutterFree, splitPaddingSides } from "./HkAdminShell";

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
  });

  it("never lets a stray close paren invert the depth", () => {
    // Malformed CSS in, but the tracks must not silently merge: without
    // the clamp the `)` would drive the depth to -1 and swallow the next
    // separator.
    expect(splitPaddingSides("1rem ) 2rem")).toEqual(["1rem", ")", "2rem"]);
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
    // ("1rem 0 x") that a browser drops whole.
    expect(mobileSideGutterFree("1rem /* x */ 2rem")).toBe("1rem /* x */ 2rem");
  });

  it("still rewrites a keyword-shaped track that is not alone", () => {
    // Only a LONE keyword is unrewritable; as one track of several it is
    // just a value the author wrote.
    expect(mobileSideGutterFree("inherit 2rem")).toBe("inherit 0 inherit");
    expect(mobileSideGutterFree("1rem inherit")).toBe("1rem 0 1rem");
  });
});
