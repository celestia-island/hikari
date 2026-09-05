/**
 * Source contract for the unified window-close affordance (user directive:
 * unify on the shared icon button + one close glyph, not per-component ✕
 * SVG copies).
 *
 * Every window chrome close control — modal header, drawer header,
 * popover/select mobile-sheet heading row — must be an HkIconButton
 * carrying the registry's X glyph and the shared `hk-window-close`
 * grammar class (window-close.scss). No window component keeps its own
 * inline ✕ line-SVG any more: one glyph, one chrome, many windows.
 *
 * Pinned here so a refactor cannot silently re-sprout per-component close
 * SVG copies — the same "looks unified but drifted" failure class the
 * sheet-dock contracts guard against.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const WINDOW_FILES = [
  "HkModal.tsx",
  "HkPopover.tsx",
  "HkDrawer.tsx",
  "HkSelectPanel.tsx",
  "HkImageLightbox.tsx",
];

describe("unified window-close contract", () => {
  it("renders every close control as HkIconButton + the functional close key", () => {
    for (const f of WINDOW_FILES) {
      const src = readFileSync(join(here, f), "utf-8");
      expect(src, `${f} must carry the shared grammar class`).toContain(
        "hk-window-close",
      );
      // Semantic key: the theme context's material pack can swap the glyph
      // family at runtime (iconRegistry resolves close → X by default).
      expect(src, `${f} must render the functional close key`).toContain(
        'HIcon name="close"',
      );
      expect(src, `${f} must close via HkIconButton`).toContain("HIconButton");
    }
  });

  it("keeps no per-component inline ✕ SVG duplicates", () => {
    for (const f of WINDOW_FILES) {
      const src = readFileSync(join(here, f), "utf-8");
      expect(src, `${f} must not re-inline the ✕ line SVG`).not.toContain(
        'x1="18"',
      );
    }
  });
});
