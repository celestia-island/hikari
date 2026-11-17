/**
 * HkPopover `aboveChrome` contract (2026-11-17 user direction): a
 * popover whose trigger lives ON the window caption band opts into the
 * above-titlebar root, so its panel paints OVER the band row instead of
 * being buried under it. The default keeps the overlay root — a plain
 * page popover must not jump above the titlebar.
 */
import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import { TOP_ROOT_SELECTOR } from "../overlay/topRoot";
import { OVERLAY_ROOT_SELECTOR } from "../overlay/overlayRoot";
import HkPopover from "./HkPopover";

const apps: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

afterEach(() => {
  for (const { app, container } of apps.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.body
    .querySelectorAll(".hk-popover-panel, .hk-popover-scrim, .hk-popover-backdrop")
    .forEach((el) => el.remove());
});

function mountPopover(aboveChrome?: boolean) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const anchor = document.createElement("button");
  container.appendChild(anchor);
  const open = ref(false);
  const app = createApp({
    render: () =>
      h(
        HkPopover as never,
        {
          modelValue: open.value,
          anchorRef: anchor,
          title: "probe",
          aboveChrome,
          "onUpdate:modelValue": (v: boolean) => { open.value = v; },
        },
        () => h("div", { class: "probe-body" }, "content"),
      ),
  });
  app.mount(container);
  apps.push({ app, container });
  return { open };
}

describe("HkPopover aboveChrome layer", () => {
  it("teleports an opted-in popover into the above-titlebar root", async () => {
    const { open } = mountPopover(true);
    open.value = true;
    await nextTick();
    await nextTick();

    const panel = document.body.querySelector(".hk-popover-panel");
    expect(panel, "the panel must mount").not.toBeNull();
    const topRoot = document.querySelector(TOP_ROOT_SELECTOR);
    expect(topRoot, "the above-titlebar root must exist").not.toBeNull();
    expect(panel!.closest(TOP_ROOT_SELECTOR)).toBe(topRoot);
    // The backdrop half of the surface follows the same home, so a click
    // on the band area is caught by the popover's own dismissal layer.
    const backdrop = document.body.querySelector(".hk-popover-backdrop");
    if (backdrop) expect(backdrop.closest(TOP_ROOT_SELECTOR)).toBe(topRoot);
  });

  it("joins the layer when its anchor lives inside an above-titlebar surface", async () => {
    // Round-1 verification finding (2026-11-17): a popover opened FROM an
    // above-titlebar surface (the filter panel's "add condition" chooser)
    // used to stay in the overlay root — painted under its own parent and
    // dismissed by the parent's cross-root shield. The nested surface must
    // inherit the root from its anchor.
    const container = document.createElement("div");
    document.body.appendChild(container);
    const innerAnchor = ref<HTMLElement | null>(null);
    const outerOpen = ref(true);
    const innerOpen = ref(true);
    const app = createApp({
      render: () =>
        h(
          HkPopover as never,
          {
            modelValue: outerOpen.value,
            aboveChrome: true,
            title: "outer",
            "onUpdate:modelValue": (v: boolean) => { outerOpen.value = v; },
          },
          () =>
            h("div", null, [
              h("button", {
                class: "inner-anchor",
                ref: (el: unknown) => { innerAnchor.value = (el as HTMLElement) ?? null; },
              }, "inner"),
              h(
                HkPopover as never,
                {
                  modelValue: innerOpen.value,
                  anchorRef: innerAnchor.value,
                  title: "inner",
                  "onUpdate:modelValue": (v: boolean) => { innerOpen.value = v; },
                },
                () => h("div", { class: "inner-body" }, "inner content"),
              ),
            ]),
        ),
    });
    app.mount(container);
    apps.push({ app, container });
    await nextTick();
    await nextTick();
    await nextTick();

    const panels = Array.from(document.body.querySelectorAll(".hk-popover-panel"));
    expect(panels.length, "both the outer and the nested panel must mount").toBe(2);
    for (const panel of panels) {
      expect(panel.closest(TOP_ROOT_SELECTOR), "every nested level joins the top root").not.toBeNull();
    }
  });

  it("keeps the default popover in the overlay root (never above the titlebar)", async () => {
    const { open } = mountPopover(false);
    open.value = true;
    await nextTick();
    await nextTick();

    const panel = document.body.querySelector(".hk-popover-panel");
    expect(panel).not.toBeNull();
    expect(panel!.closest(OVERLAY_ROOT_SELECTOR)).not.toBeNull();
    expect(panel!.closest(TOP_ROOT_SELECTOR)).toBeNull();
  });
});
