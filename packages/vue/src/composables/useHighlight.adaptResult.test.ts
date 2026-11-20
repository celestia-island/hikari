import { describe, expect, it } from "vitest";

import { adaptHighlightResult } from "./useHighlight";
import type { HighlightResult } from "../wasm/highlight/hikari_wasm_highlight.js";

/**
 * The wasm seam: the binding returns `HighlightResult = { html?: string }`
 * (generated — `wasm/highlight/hikari_wasm_highlight.d.ts` +
 * `interfaces/hikari-highlight-types.d.ts`), not a string. Handing that
 * record straight back made `HkDiffViewer`'s `v-html` render every row as
 * "[object Object]"; the old string-returning mock could not see it.
 *
 * These cases are the whole contract of `adaptHighlightResult`, pinned
 * table-driven and independent of the lazy-load/mock path: an `html`
 * string is highlighted HTML, and anything the wasm declines to answer
 * (`html: undefined`, or the field absent entirely) is `null`, which
 * callers render as plaintext.
 */
const CASES: Array<{ name: string; result: HighlightResult; expected: string | null }> = [
  {
    name: "html present → highlighted HTML",
    result: { html: `<span class="hl">fn</span> main` },
    expected: `<span class="hl">fn</span> main`,
  },
  {
    name: "html explicitly undefined → null (plaintext fallback)",
    result: { html: undefined },
    expected: null,
  },
  {
    name: "html field absent → null (plaintext fallback)",
    result: {},
    expected: null,
  },
  {
    // `""` is a real answer, so the guard must be `??` and not `||`:
    // an empty-but-present html is highlighted-and-empty, not "no answer".
    name: "html empty string is kept, not coerced to null",
    result: { html: "" },
    expected: "",
  },
];

describe("adaptHighlightResult (wasm record → string | null)", () => {
  for (const { name, result, expected } of CASES) {
    it(name, () => {
      expect(adaptHighlightResult(result)).toBe(expected);
    });
  }

  it("never returns the record itself", () => {
    // The original defect in one line: whatever the wasm says, the value
    // that reaches `v-html` must be a string or null, never an object.
    for (const { result } of CASES) {
      const adapted = adaptHighlightResult(result);
      expect(typeof adapted === "string" || adapted === null).toBe(true);
    }
  });
});