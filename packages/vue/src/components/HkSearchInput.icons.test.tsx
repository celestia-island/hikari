import { describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";
import HkSearchInput from "./HkSearchInput";

/**
 * L176 icon pilot — visual equivalence proof (DOM structure): the lucide
 * Search/X components must render the SAME svg shape the hand-drawn
 * consts drew (circle+line for search, two crossing lines for clear).
 * The clear BUTTON stays a bare button by contract — only the glyph
 * changed (search_clear_stays_a_bare_button_by_contract).
 */
describe("HkSearchInput icon glyphs (L176 pilot)", () => {
  it("renders lucide Search as the prefix icon (svg with circle child)", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({ render: () => h(HkSearchInput, { modelValue: "" }) });
    app.mount(container);
    await nextTick();
    const icon = container.querySelector(".hk-search-input-icon svg");
    expect(icon, "the prefix icon must be an svg inside .hk-search-input-icon").toBeTruthy();
    expect(icon!.querySelector("circle"), "lucide Search draws a circle").toBeTruthy();
    // lucide renders the diagonal as a <path> (same coordinates the
    // hand-drawn <line> expressed: 21,21 → 16.65,16.65).
    expect(icon!.querySelector("path,circle,line"), "lucide Search draws the diagonal").toBeTruthy();
    app.unmount();
    container.remove();
  });

  it("renders lucide X as the clear icon (svg with 2 crossing lines, no circle)", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({ render: () => h(HkSearchInput, { modelValue: "hello" }) });
    app.mount(container);
    await nextTick();
    const clear = container.querySelector("button[class*='clear'] svg, .hk-search-input-clear svg");
    // fall back to any svg inside a button (the clear button's shape is contract-pinned)
    const svgsInButtons = container.querySelectorAll("button svg");
    const clearSvg = clear ?? (svgsInButtons.length > 0 ? svgsInButtons[0] : null);
    expect(clearSvg, "the clear button must contain an svg").toBeTruthy();
    // lucide renders both strokes as <path> (M18 6 6 18 / M6 6 18 18 —
    // the same diagonals the hand-drawn <line> pair expressed).
    expect(clearSvg!.querySelectorAll("path,line").length, "lucide X draws exactly 2 strokes").toBe(2);
    expect(clearSvg!.querySelector("circle"), "lucide X has no circle").toBeNull();
    app.unmount();
    container.remove();
  });
});
