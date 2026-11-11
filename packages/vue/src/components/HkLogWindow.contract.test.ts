import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Copy-feedback contract for HkLogWindow's toolbar (user direction
 * 2026-11-11: EVERY click-to-copy control keeps CONSTANT text — the
 * shared toast is the only feedback; a control whose wording mutates
 * under the cursor reads as a second, competing signal beside it).
 *
 * The copy button lives inside the HModal sheet, whose open
 * choreography never settles under happy-dom — the DOM is unreachable
 * from vitest, so the contract is pinned on the source (the same
 * source-contract pattern TopicMindMap.styles.test.ts uses for
 * stylesheet rules vitest cannot resolve).
 */
const here = dirname(fileURLToPath(import.meta.url));
const tsx = readFileSync(join(here, "HkLogWindow.tsx"), "utf-8");

describe("HkLogWindow copy feedback", () => {
  it("rides the shared clipboard-with-toast path, not the bare hook", () => {
    expect(tsx).toMatch(/useClipboardWithToast,\s*useToast/);
    // The bare hook has no toast — its only feedback channel was the
    // copied-state tooltip flip this contract retires.
    expect(tsx).not.toMatch(/useClipboard[,}]/);
    expect(tsx).toMatch(/useClipboardWithToast\(useToast\(\)\)/);
  });

  it("keeps the copy control's tooltip constant — no copied-state flip", () => {
    // Comments stripped first: the guard is about CODE reading the
    // copied state, not prose explaining the contract.
    const code = tsx
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    // No copied-state read anywhere in the component: the flip cannot
    // come back through a side door (a computed, a local ref, …).
    expect(code).not.toMatch(/\bcopied\b/);
    const title = /title=\{t\("hikari::log\.copy", "Copy"\)\}/;
    expect(tsx).toMatch(title);
    expect(tsx).not.toMatch(/hikari::log\.copied/);
  });
});
