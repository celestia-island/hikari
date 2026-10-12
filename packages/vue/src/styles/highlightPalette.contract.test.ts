import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The syntax-palette contract (theme/highlight.scss).
 *
 * `useHighlight()` emits `.hljs-*` spans; this sheet is the ONLY thing
 * that colours them, so the pairs documented in channels.scss must stay
 * mapped to their `--code-*` tokens — if a restyle ever swaps a var() for
 * a bare hex, themed hosts stop flipping light/dark for that class and
 * the sheet silently forks the palette the host owns.
 *
 * Assertions run on the BODY (comment lines stripped): the header and
 * inline comments deliberately NAME the classes they explain, so matching
 * against the raw sheet would hit prose instead of rules.
 */
const body = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "theme/highlight.scss"),
  "utf-8",
)
  .split("\n")
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n");

/** Pull one declaration block by a selector fragment (regex-escaped). */
function blockFor(selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    String.raw`\.hljs-${esc}\b[\s\S]*?\{([^}]*)\}`,
  );
  const m = re.exec(body);
  expect(m, `positive control: the .hljs-${selector} rule exists`).not.toBeNull();
  return m![1];
}

describe("highlight palette (theme/highlight.scss)", () => {
  it("rides the --code-* family for every colour, One Dark as fallback", () => {
    const colorRules = body.match(/color:\s*[^;]+;/g) ?? [];
    expect(colorRules.length).toBeGreaterThan(5); // positive control
    for (const rule of colorRules) {
      expect(
        rule,
        `every colour must ride the token family: "${rule}"`,
      ).toMatch(/color:\s*var\(--code-[a-z]+,\s*#[0-9a-fA-F]{6}\);/);
    }
  });

  it("keeps the pairs channels.scss documents canonical", () => {
    expect(blockFor("keyword")).toContain("var(--code-keyword, #c678dd)");
    expect(blockFor("selector-tag")).toContain("var(--code-keyword, #c678dd)");
    expect(blockFor("built_in")).toContain("var(--code-builtin, #c678dd)");
    expect(blockFor("string")).toContain("var(--code-string, #98c379)");
    expect(blockFor("number")).toContain("var(--code-number, #d19a66)");
    expect(blockFor("literal")).toContain("var(--code-number, #d19a66)");
    expect(blockFor("attr")).toContain("var(--code-number, #d19a66)");
    expect(blockFor("title.function_")).toContain("var(--code-function, #61afef)");
    expect(blockFor("type")).toContain("var(--code-type, #e5c07b)");
    expect(blockFor("title.class_")).toContain("var(--code-type, #e5c07b)");
    expect(blockFor("variable")).toContain("var(--code-variable, #e06c75)");
    expect(blockFor("template-variable")).toContain("var(--code-variable, #e06c75)");
  });

  it("renders comments grey AND italic, as documented", () => {
    const b = blockFor("comment");
    expect(b).toContain("var(--code-comment, #5c6370)");
    expect(b).toMatch(/font-style:\s*italic/);
  });

  it("does not paint backgrounds or the .hljs base — surfaces own those", () => {
    expect(body).not.toMatch(/background[^;{]*:/);
    expect(body).not.toMatch(/^\.hljs\s*\{/m);
    // The diff classes belong to the diff surfaces, not the palette.
    expect(body).not.toContain(".hljs-addition");
    expect(body).not.toContain(".hljs-deletion");
  });

  it("is actually composed into the styles entry — a sheet nobody @uses is dead", () => {
    const entry = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "index.scss"),
      "utf-8",
    );
    expect(
      entry.match(/@use\s+"\.\/theme\/[^"]+\.scss";/g) ?? [],
      "positive control: the entry composes theme sheets",
    ).toContain("@use \"./theme/channels.scss\";");
    expect(entry).toContain('@use "./theme/highlight.scss";');
  });
});
