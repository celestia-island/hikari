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

  it("consumes Escape while the panel is open so hosting dialogs stay put", async () => {
    // The trigger commonly renders inside a dialog that closes on
    // bubbled Escape (HkModal/HkDrawer). One press must close ONLY the
    // dropdown; with the dropdown already closed the key bubbles on so
    // the dialog's own Escape semantics are untouched.
    setViewportWidth(1280);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const dialogKeydowns: KeyboardEvent[] = [];
    host.addEventListener("keydown", (ev) => dialogKeydowns.push(ev as KeyboardEvent));

    const app = createApp({
      render: () =>
        h("div", { onKeydown: () => {} }, [
          h(HSelect, {
            modelValue: "",
            "onUpdate:modelValue": () => {},
            options: [
              { value: "a", label: "Option A" },
              { value: "b", label: "Option B" },
            ],
          }),
        ]),
    });
    app.mount(host);
    await nextTick();

    const trigger = host.querySelector<HTMLButtonElement>(".hk-select-trigger")!;

    // Panel open: Escape closes it AND is consumed.
    trigger.click();
    await nextTick();
    const escapeOpen = new KeyboardEvent("keydown", {
      key: "Escape", bubbles: true, cancelable: true,
    });
    trigger.dispatchEvent(escapeOpen);
    await nextTick();
    expect(escapeOpen.defaultPrevented).toBe(true);
    expect(dialogKeydowns).toHaveLength(0);

    // Panel closed: the same key bubbles to the hosting dialog.
    const escapeClosed = new KeyboardEvent("keydown", {
      key: "Escape", bubbles: true, cancelable: true,
    });
    trigger.dispatchEvent(escapeClosed);
    await nextTick();
    expect(escapeClosed.defaultPrevented).toBe(false);
    expect(dialogKeydowns).toHaveLength(1);

    app.unmount();
    host.remove();
  });

  it("titles the opened surface from panelTitle without a visible label", async () => {
    // Consumers whose visible label lives outside the field (a titled
    // row) still need the mobile sheet header / popout a11y name; an
    // untitled surface registers an unnamed blocking layer on phones.
    setViewportWidth(375);
    const el = document.createElement("div");
    document.body.appendChild(el);
    const app = createApp({
      render: () =>
        h(HSelect, {
          modelValue: "",
          "onUpdate:modelValue": () => {},
          panelTitle: "What this screen shows",
          options: [
            { value: "a", label: "Option A" },
            { value: "b", label: "Option B" },
          ],
        }),
    });
    app.mount(el);
    await nextTick();

    // No visible field label rendered above the trigger.
    expect(document.querySelector(".hk-select-label")).toBeNull();

    const trigger = document.querySelector<HTMLButtonElement>(".hk-select-trigger")!;
    trigger.click();
    await nextTick();

    const title = document.querySelector<HTMLElement>(".hk-select-sheet-title");
    expect(title?.textContent?.trim()).toBe("What this screen shows");
    // The sheet panel is the a11y-named dialog for the surface.
    const panel = document.querySelector<HTMLElement>(".hk-select-sheet-panel");
    expect(panel?.getAttribute("aria-label")).toBe("What this screen shows");

    app.unmount();
    el.remove();
  });
});
