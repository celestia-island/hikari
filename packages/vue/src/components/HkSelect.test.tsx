import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import { HSelect } from "../index";

/**
 * Mobile select contract: below the touch breakpoint the select renders
 * as a bottom sheet (scrim + panel + grabber) instead of an anchored
 * popout. The sheet's option list must carry side insets — full-row
 * option pills used to glue to both screen edges and read as a broken
 * edge-to-edge strip (the language picker popover keeps margins, which
 * made the mismatch visible).
 */

const originalWidth = window.innerWidth;

function setViewportWidth(px: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: px,
  });
}

async function mountSelect() {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const app = createApp({
    render: () =>
      h(HSelect, {
        modelValue: "",
        "onUpdate:modelValue": () => {},
        options: [
          { value: "a", label: "Option A" },
          { value: "b", label: "Option B" },
        ],
      }),
  });
  app.mount(el);
  await nextTick();
  return { el, app };
}

describe("HSelect mobile sheet", () => {
  afterEach(() => {
    setViewportWidth(originalWidth);
    document.body.innerHTML = "";
  });

  it("renders a bottom sheet with side-inset options on touch widths", async () => {
    setViewportWidth(375);
    const { app } = await mountSelect();
    const trigger = document.querySelector<HTMLButtonElement>(".hk-select-trigger")!;
    trigger.click();
    await nextTick();

    const panel = document.querySelector<HTMLElement>(".hk-select-sheet-panel");
    expect(panel).not.toBeNull();
    const scrim = document.querySelector(".hk-select-sheet-scrim");
    expect(scrim).not.toBeNull();
    // No anchored popout in sheet mode.
    expect(document.querySelector(".hk-select-popout")).toBeNull();

    // The list node must exist (side insets are enforced in SCSS —
    // padding-inline on .hk-select-sheet-list — which happy-dom does not
    // compute; the visual assertion lives in the stylesheet).
    const list = document.querySelector<HTMLElement>(".hk-select-sheet-list");
    expect(list).not.toBeNull();
    const options = panel!.querySelectorAll(".hk-select-option");
    expect(options.length).toBe(2);

    app.unmount();
  });

  it("renders an anchored popout on desktop widths", async () => {
    setViewportWidth(1280);
    const { app } = await mountSelect();
    const trigger = document.querySelector<HTMLButtonElement>(".hk-select-trigger")!;
    trigger.click();
    await nextTick();

    expect(document.querySelector(".hk-select-sheet-panel")).toBeNull();
    const popout = document.querySelector<HTMLElement>(".hk-select-popout");
    expect(popout).not.toBeNull();

    app.unmount();
  });
});
