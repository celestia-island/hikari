import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The drag affordance contract: the grab cursor/touch lock MUST ride
 *  the frame selector — an earlier iteration targeted `.hk-modal[...]`
 *  (a class no element carries) and shipped dead CSS (2026-10-11 R2
 *  mutation M1 caught it with zero red). */
describe("HkModal draggable affordance (styles contract)", () => {
  it("scopes the grab handle to the frame's data attribute", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const scss = readFileSync(join(here, "HkModal.scss"), "utf-8");
    const block = scss.match(/\.hk-modal-content\[data-draggable\]\s+\.hk-modal-header\s*{[^}]*}/)?.[0] ?? "";
    expect(block, "the live drag-affordance selector").toContain("cursor: grab");
    expect(block).toContain("touch-action: none");
    expect(scss).not.toMatch(/\.hk-modal\[data-draggable\]/);
  });
});
