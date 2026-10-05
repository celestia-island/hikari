/**
 * HkPopover `closed` contract: the settled-leave edge hosts reclaim
 * focus from (the template field's Escape path). Pins:
 *
 *   - a close emits `closed` exactly once, AFTER the panel has left
 *     the DOM (that ordering is the whole point — focus is only
 *     orphaned once the panel is gone);
 *   - opening emits nothing;
 *   - unmounting while open does NOT emit (`closed` means "closed",
 *     not "disposed" — the UNMOUNT phase skips the after-leave hook).
 */
import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import HkPopover from "./HkPopover";

const apps: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

afterEach(() => {
  for (const { app, container } of apps.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.body
    .querySelectorAll(".hk-popover-panel, .hk-popover-scrim")
    .forEach((el) => el.remove());
});

function mountPopover() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const open = ref(false);
  const closedCalls: boolean[] = [];
  const app = createApp({
    render: () =>
      h(
        HkPopover as never,
        {
          modelValue: open.value,
          title: "probe",
          "onUpdate:modelValue": (v: boolean) => { open.value = v; },
          onClosed: () => closedCalls.push(!!document.body.querySelector(".hk-popover-panel")),
        },
        () => h("div", { class: "probe-body" }, "content"),
      ),
  });
  app.mount(container);
  apps.push({ app, container });
  return { open, closedCalls };
}

describe("HkPopover closed event", () => {
  it("fires once on a settled close, with the panel already gone", async () => {
    const { open, closedCalls } = mountPopover();
    await nextTick();
    expect(closedCalls).toHaveLength(0); // opening emits nothing

    open.value = true;
    await nextTick();
    expect(document.body.querySelector(".hk-popover-panel")).not.toBeNull();

    open.value = false;
    await nextTick();
    await new Promise((r) => setTimeout(r, 30));
    await nextTick();

    expect(closedCalls).toHaveLength(1);
    // The edge that matters: by the time `closed` ran, the panel had
    // left the DOM (focus orphaned), not merely started leaving.
    expect(closedCalls[0]).toBe(false);
  });

  it("does not emit on unmount-while-open", async () => {
    const { open, closedCalls } = mountPopover();
    await nextTick();
    open.value = true;
    await nextTick();
    expect(document.body.querySelector(".hk-popover-panel")).not.toBeNull();

    apps.pop()!.app.unmount();
    await nextTick();
    await new Promise((r) => setTimeout(r, 30));
    await nextTick();
    expect(closedCalls).toHaveLength(0);
  });
});
