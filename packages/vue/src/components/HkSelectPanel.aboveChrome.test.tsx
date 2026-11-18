/**
 * HkSelectPanel `aboveChrome` contract (2026-11-17 user direction): the
 * shared dropdown surface behind every top-bar menu (workspace picker,
 * account menus, platform switcher) must paint OVER the window caption
 * band when its trigger lives there. Opted-in panels teleport to the
 * above-titlebar root; the default keeps the overlay root.
 */
import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import { TOP_ROOT_SELECTOR } from "../overlay/topRoot";
import { OVERLAY_ROOT_SELECTOR } from "../overlay/overlayRoot";
import HkSelectPanel from "./HkSelectPanel";

const apps: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

afterEach(() => {
  for (const { app, container } of apps.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.body.querySelectorAll(".hk-select-popout-host").forEach((el) => el.remove());
});

function mountPanel(aboveChrome?: boolean) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const anchor = document.createElement("button");
  container.appendChild(anchor);
  const app = createApp({
    render: () =>
      h(
        HkSelectPanel as never,
        { open: true, anchorRef: anchor, title: "probe", aboveChrome },
        () => h("div", { class: "probe-row" }, "row"),
      ),
  });
  app.mount(container);
  apps.push({ app, container });
}

describe("HkSelectPanel aboveChrome layer", () => {
  it("teleports an opted-in popout into the above-titlebar root and marks it", async () => {
    mountPanel(true);
    await nextTick();
    await nextTick();

    const host = document.body.querySelector(".hk-select-popout-host");
    expect(host, "the popout host must mount").not.toBeNull();
    expect(host!.closest(TOP_ROOT_SELECTOR)).toBe(document.querySelector(TOP_ROOT_SELECTOR));
    expect(host!.hasAttribute("data-hk-top-layer")).toBe(true);
  });

  it("keeps the default popout in the overlay root", async () => {
    mountPanel(false);
    await nextTick();
    await nextTick();

    const host = document.body.querySelector(".hk-select-popout-host");
    expect(host).not.toBeNull();
    expect(host!.closest(OVERLAY_ROOT_SELECTOR)).not.toBeNull();
    expect(host!.closest(TOP_ROOT_SELECTOR)).toBeNull();
    expect(host!.hasAttribute("data-hk-top-layer")).toBe(false);
  });
});
