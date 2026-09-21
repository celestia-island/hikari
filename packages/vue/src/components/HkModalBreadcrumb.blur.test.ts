/**
 * Source contract for the breadcrumb strip's blur stand-down (2026-09-21
 * chest field report, round 5 — the "content blinks once" residual).
 *
 * The strip floats over every popup band, so its backdrop-filter
 * re-samples the whole blurred band each time the sheet behind it
 * resizes or swaps content; on the phone GPU that re-filter read as a
 * one-shot flash per wizard step. The family pattern (HkModal /
 * HkDrawer / HkPopover) is a host-tunable blur knob that defaults to
 * NONE on ≤767px — the strip was the last surface without it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkModalBreadcrumb.scss"), "utf-8");

/** Brace-aware `@media <query>` block extractor. */
function mediaBlocks(source: string, query: string): string[] {
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const at = source.indexOf(`@media ${query}`, from);
    if (at < 0) break;
    const open = source.indexOf("{", at);
    let depth = 0;
    let i = open;
    for (; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    blocks.push(source.slice(at, i + 1));
    from = i + 1;
  }
  return blocks;
}

describe("HkModalBreadcrumb blur contract", () => {
  it("keeps the base blur host-tunable through the family knob", () => {
    const rule = src.match(/\.hk-modal-breadcrumb\s*\{[^}]*\}/)![0]!;
    expect(rule).toContain(
      "backdrop-filter: var(--hk-modal-breadcrumb-blur, blur(var(--blur-md)));",
    );
    // No naked blur declaration left on the strip itself.
    expect(rule).not.toMatch(/backdrop-filter:\s*blur\(/);
  });

  it("stands the blur down on ≤767px by default", () => {
    const blocks = mediaBlocks(src, "(max-width: 767px)");
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toContain(".hk-modal-breadcrumb");
    expect(blocks[0]).toContain(
      "backdrop-filter: var(--hk-modal-breadcrumb-blur-mobile, none);",
    );
  });
});
