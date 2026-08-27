/**
 * Source contract: popover glass content reads --hk-popover-bg/--hk-popover-blur
 * so a host surface-finish preference (chest html[data-surface]) can re-skin
 * floating dropdown layers without forking the component.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkPopover.scss"), "utf-8");

describe("HkPopover glass layer surface hooks", () => {
  it("keeps the glass background host-tunable with the historical default", () => {
    const block = src.slice(src.indexOf(".hii-dropdown-content"));
    expect(block).toContain("var(--hk-popover-bg, rgb(var(--color-surface)))");
    expect(block).toContain("var(--hk-popover-blur,");
  });
});
