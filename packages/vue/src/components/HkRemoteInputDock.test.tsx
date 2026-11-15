import { afterEach, describe, expect, it, vitest } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkRemoteInputDock from "./HkRemoteInputDock";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

interface Mounted {
  container: HTMLElement;
  dial: HTMLButtonElement;
  modes: () => HTMLButtonElement[];
  btns: () => HTMLButtonElement[];
}

/** Mount a dock through a wrapper app (the HkFab.test.tsx pattern). */
function mountDock(props: Record<string, unknown> = {}, slot?: () => ReturnType<typeof h>): Mounted {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkRemoteInputDock, props, slot ? { default: slot } : undefined);
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);

  const dial = container.querySelector<HTMLButtonElement>(".hk-remote-input-dock__dial");
  if (!dial) throw new Error("dock did not render its dial");
  return {
    container,
    dial,
    modes: () => [...container.querySelectorAll<HTMLButtonElement>(".hk-remote-input-dock__mode")],
    btns: () => [...container.querySelectorAll<HTMLButtonElement>(".hk-remote-input-dock__btn")],
  };
}

afterEach(() => {
  while (mounts.length) mounts.pop()?.unmount();
  while (containers.length) containers.pop()?.remove();
});

describe("HkRemoteInputDock", () => {
  it("hidden prop renders nothing", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const app = createApp({ render: () => h(HkRemoteInputDock, { hidden: true }) });
    mounts.push(app);
    app.mount(container);
    expect(container.querySelector(".hk-remote-input-dock")).toBeNull();
  });

  it("the dial expands the card; the mode radios drive update:mode", async () => {
    const seen: string[] = [];
    const m = mountDock({ mode: "direct", "onUpdate:mode": (v: string) => seen.push(v) });
    expect(m.container.querySelector(".hk-remote-input-dock__card")).toBeNull();
    m.dial.click();
    await nextTick();
    expect(m.container.querySelector(".hk-remote-input-dock__card")).not.toBeNull();
    const radios = m.modes();
    expect(radios[0]!.getAttribute("aria-checked")).toBe("true");
    expect(radios[1]!.getAttribute("aria-checked")).toBe("false");
    radios[1]!.click();
    await nextTick();
    expect(seen).toEqual(["virtual"]);
  });

  it("pad hold-buttons drive the actions with an absolute held mask", async () => {
    const actions = { setButtons: vitest.fn(), wheel: vitest.fn() };
    const m = mountDock({ mode: "virtual", actions });
    m.dial.click();
    await nextTick();
    const btns = m.btns();
    // [left, middle, right, wheelUp, wheelDown]
    btns[0]!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(actions.setButtons).toHaveBeenLastCalledWith(0b001);
    btns[2]!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(actions.setButtons).toHaveBeenLastCalledWith(0b101);
    btns[0]!.dispatchEvent(new Event("pointerup", { bubbles: true }));
    expect(actions.setButtons).toHaveBeenLastCalledWith(0b100);
    // An unheld pad's pointerleave must not fire a phantom release.
    actions.setButtons.mockClear();
    btns[1]!.dispatchEvent(new Event("pointerleave", { bubbles: true }));
    expect(actions.setButtons).not.toHaveBeenCalled();
  });

  it("wheel taps ride the actions; without actions the pad disables", async () => {
    const actions = { setButtons: vitest.fn(), wheel: vitest.fn() };
    const m = mountDock({ actions });
    m.dial.click();
    await nextTick();
    const btns = m.btns();
    btns[3]!.click();
    btns[4]!.click();
    expect(actions.wheel.mock.calls).toEqual([[1], [-1]]);

    while (mounts.length) mounts.pop()?.unmount();
    while (containers.length) containers.pop()?.remove();
    const bare = mountDock();
    bare.dial.click();
    await nextTick();
    expect(bare.btns()[0]!.disabled).toBe(true);
  });

  it("outside pointerdown and Escape close the card", async () => {
    const m = mountDock();
    m.dial.click();
    await nextTick();
    expect(m.container.querySelector(".hk-remote-input-dock__card")).not.toBeNull();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
    await nextTick();
    expect(m.container.querySelector(".hk-remote-input-dock__card")).toBeNull();
  });

  it("a HELD pad keeps the card open across outside touches", async () => {
    const actions = { setButtons: vitest.fn(), wheel: vitest.fn() };
    const m = mountDock({ actions });
    m.dial.click();
    await nextTick();
    const btns = m.btns();
    btns[0]!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    // A touch on the canvas (outside the dock) while the pad is held:
    // the card must stay open — the held button is still in use.
    document.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await nextTick();
    expect(m.container.querySelector(".hk-remote-input-dock__card")).not.toBeNull();
    // Releasing the pad: an outside touch now closes.
    btns[0]!.dispatchEvent(new Event("pointerup", { bubbles: true }));
    document.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await nextTick();
    expect(m.container.querySelector(".hk-remote-input-dock__card")).toBeNull();
  });

  it("every card-unmount path force-releases held bits", async () => {
    // (a) Escape closes → release
    const a = { setButtons: vitest.fn(), wheel: vitest.fn() };
    const ma = mountDock({ actions: a });
    ma.dial.click();
    await nextTick();
    ma.btns()[2]!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await nextTick();
    expect(a.setButtons).toHaveBeenLastCalledWith(0);

    // (b) hidden while open → release
    const b = { setButtons: vitest.fn(), wheel: vitest.fn() };
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const app = createApp({
      setup() {
        const hidden = ref(false);
        return () => [
          h(HkRemoteInputDock, { actions: b, hidden: hidden.value }),
          h("button", { class: "flip", onClick: () => { hidden.value = true; } }, "flip"),
        ];
      },
    });
    mounts.push(app);
    app.mount(container);
    (container.querySelector<HTMLButtonElement>(".hk-remote-input-dock__dial"))!.click();
    await nextTick();
    const padBtns = [...container.querySelectorAll<HTMLButtonElement>(".hk-remote-input-dock__btn")];
    padBtns[0]!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(b.setButtons).toHaveBeenLastCalledWith(0b001);
    (container.querySelector<HTMLButtonElement>(".flip"))!.click();
    await nextTick();
    expect(container.querySelector(".hk-remote-input-dock")).toBeNull();
    expect(b.setButtons).toHaveBeenLastCalledWith(0); // hidden force-releases
    // A hidden dock swallows no Escape: the listener stood down.
    const esc = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    document.dispatchEvent(esc);
    expect(esc.defaultPrevented).toBe(false);
  });

  it("component UNMOUNT releases a held pad (the third teardown path)", async () => {
    const actions = { setButtons: vitest.fn(), wheel: vitest.fn() };
    const m = mountDock({ actions });
    m.dial.click();
    await nextTick();
    m.btns()[1]!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(actions.setButtons).toHaveBeenLastCalledWith(0b010);
    while (mounts.length) mounts.pop()?.unmount();
    expect(actions.setButtons).toHaveBeenLastCalledWith(0);
  });

  it("actions vanishing mid-hold clears the strand locally", async () => {
    const actions = { setButtons: vitest.fn(), wheel: vitest.fn() };
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const app = createApp({
      setup() {
        const live = ref<typeof actions | null>(actions);
        return () => [
          h(HkRemoteInputDock, { actions: live.value }),
          h("button", { class: "drop", onClick: () => { live.value = null; } }, "drop"),
          h("button", { class: "revive", onClick: () => { live.value = actions; } }, "revive"),
        ];
      },
    });
    mounts.push(app);
    app.mount(container);
    (container.querySelector<HTMLButtonElement>(".hk-remote-input-dock__dial"))!.click();
    await nextTick();
    const pad = () => [...container.querySelectorAll<HTMLButtonElement>(".hk-remote-input-dock__btn")];
    pad()[0]!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(actions.setButtons).toHaveBeenLastCalledWith(0b001);
    // The wire vanishes mid-hold: no release frame can ride it (it is
    // GONE), but the local bit must not linger into the next session.
    (container.querySelector<HTMLButtonElement>(".drop"))!.click();
    await nextTick();
    (container.querySelector<HTMLButtonElement>(".revive"))!.click();
    await nextTick();
    actions.setButtons.mockClear();
    pad()[0]!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(actions.setButtons).toHaveBeenLastCalledWith(0b001); // the strand died with the old wire
  });

  it("the radiogroup roves tabindex and switches on arrows", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const mode = ref<"direct" | "virtual">("direct");
    const app = createApp({
      setup: () => () =>
        h(HkRemoteInputDock, {
          mode: mode.value,
          "onUpdate:mode": (v: "direct" | "virtual") => { mode.value = v; },
        }),
    });
    mounts.push(app);
    app.mount(container);
    (container.querySelector<HTMLButtonElement>(".hk-remote-input-dock__dial"))!.click();
    await nextTick();
    const radios = () => [...container.querySelectorAll<HTMLButtonElement>(".hk-remote-input-dock__mode")];
    expect(radios()[0]!.tabIndex).toBe(0);
    expect(radios()[1]!.tabIndex).toBe(-1);
    radios()[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await nextTick();
    expect(mode.value, "the arrow flipped the mode").toBe("virtual");
    expect(radios()[1]!.tabIndex, "focus roved to the now-checked radio").toBe(0);
  });

  it("the pad carries its accessible group role and labels", async () => {
    const m = mountDock({ actions: { setButtons: () => {}, wheel: () => {} } });
    m.dial.click();
    await nextTick();
    const pad = m.container.querySelector('[class="hk-remote-input-dock__pad"]');
    expect(pad!.getAttribute("role")).toBe("group");
    expect(pad!.getAttribute("aria-label")).toBeTruthy();
    const labelled = [...m.btns()].every((b) => b.getAttribute("aria-label"));
    expect(labelled, "every pad button is labelled").toBe(true);
  });

  it("renders host view controls through the default slot", async () => {
    const m = mountDock({}, () => h("button", { class: "host-ctl" }, "FIT"));
    m.dial.click();
    await nextTick();
    expect(m.container.querySelector(".hk-remote-input-dock__host .host-ctl")).not.toBeNull();
  });
});
