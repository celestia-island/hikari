import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkSwitch from "./HkSwitch";

/**
 * HkSwitch contract tests:
 * - role: the interactive control is a NATIVE <input type="checkbox">
 *   inside a real <label> — keyboard interaction (Space) rides the
 *   platform checkbox for free, so the tests exercise the input's
 *   activation, which is exactly what a Space keypress produces
 *   (happy-dom does not synthesize Space → click, so dispatching a raw
 *   KeyboardEvent would assert nothing real)
 * - model flip on activation emits !modelValue exactly once — the track
 *   handler calls preventDefault() so the label's native click-forwarding
 *   cannot produce a second toggle; that dedup is pinned here
 * - data-checked / data-disabled state markers, size/color modifiers,
 *   checked/unchecked track contents, label shell
 *
 * House style: raw createApp mounts on a shared container list torn down
 * after each case; DOM assertions via document queries.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

/** v-model harness: mirrors consumer usage, records every emitted value. */
function mountVModel(initial: boolean, props: Record<string, unknown> = {}) {
  const model = ref<boolean>(initial);
  const emitted: Array<boolean> = [];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(defineComponent({
    setup: () => () =>
      h(HkSwitch, {
        ...props,
        modelValue: model.value,
        "onUpdate:modelValue": (v: boolean) => {
          model.value = v;
          emitted.push(v);
        },
      }),
  }));
  app.mount(container);
  mounts.push({ app, container });
  const input = () => container.querySelector<HTMLInputElement>("input")!;
  const root = () => container.querySelector<HTMLElement>("label")!;
  const track = () => container.querySelector<HTMLElement>(".hk-switch-track")!;
  return { container, model, emitted, input, root, track };
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkSwitch rendering", () => {
  it("exposes a native checkbox inside the label with md/primary defaults", () => {
    const c = mount(h(HkSwitch));
    const root = c.querySelector<HTMLElement>("label")!;
    expect(root).not.toBeNull();
    expect(root.className).toBe("hk-switch hk-switch-md hk-switch-primary");
    expect(root.hasAttribute("data-checked")).toBe(false);
    const input = c.querySelector<HTMLInputElement>("input")!;
    expect(input.type).toBe("checkbox");
    expect(input.checked).toBe(false);
    expect(c.querySelector(".hk-switch-track")).not.toBeNull();
    expect(c.querySelector(".hk-switch-thumb")).not.toBeNull();
  });

  it("maps modelValue=true to the checked markers on root and input", () => {
    const c = mount(h(HkSwitch, { modelValue: true }));
    expect(c.querySelector<HTMLElement>("label")!.getAttribute("data-checked")).toBe("");
    expect(c.querySelector<HTMLInputElement>("input")!.checked).toBe(true);
  });

  it("maps size and color props to modifiers", () => {
    const c = mount(h(HkSwitch, { size: "sm", color: "danger" }));
    const cls = c.querySelector("label")!.className;
    expect(cls).toContain("hk-switch-sm");
    expect(cls).toContain("hk-switch-danger");
    expect(cls).not.toContain("hk-switch-md");
    expect(cls).not.toContain("hk-switch-primary");
  });

  it("swaps the track contents with the checked state", () => {
    const off = mount(h(HkSwitch, {
      checkedContent: "on-text",
      uncheckedContent: "off-text",
    }));
    const offContent = off.querySelector<HTMLElement>(".hk-switch-content")!;
    expect(offContent.className).toContain("hk-switch-content-off");
    expect(offContent.textContent).toBe("off-text");
    expect(off.querySelector(".hk-switch-content-on")).toBeNull();

    const on = mount(h(HkSwitch, {
      modelValue: true,
      checkedContent: "on-text",
      uncheckedContent: "off-text",
    }));
    const onContent = on.querySelector<HTMLElement>(".hk-switch-content")!;
    expect(onContent.className).toContain("hk-switch-content-on");
    expect(onContent.textContent).toBe("on-text");
    expect(on.querySelector(".hk-switch-content-off")).toBeNull();
  });

  it("renders the label prop through the HkLabel shell", () => {
    const c = mount(h(HkSwitch, { label: "Dark mode" }));
    expect(c.querySelector(".hk-label")!.textContent).toBe("Dark mode");
  });
});

describe("HkSwitch toggling", () => {
  it("flips the model exactly once per track click (preventDefault dedup)", async () => {
    const t = mountVModel(false);
    t.track().click();
    await nextTick();
    // The track handler toggles AND calls preventDefault so the wrapping
    // label cannot forward a second click to the native input — without
    // that guard one tap would emit twice and net-zero the flip.
    expect(t.emitted).toEqual([true]);
    expect(t.model.value).toBe(true);
    expect(t.root().getAttribute("data-checked")).toBe("");

    t.track().click();
    await nextTick();
    expect(t.emitted).toEqual([true, false]);
  });

  it("toggles through the label text via native label→input forwarding", async () => {
    const t = mountVModel(false, { label: "Dark mode" });
    (t.container.querySelector(".hk-label") as HTMLElement).click();
    await nextTick();
    expect(t.emitted).toEqual([true]);
    // The forwarded click natively flipped the input's checkedness.
    expect(t.input().checked).toBe(true);
  });

  it("flips via the native checkbox activation (the Space-key path)", async () => {
    const t = mountVModel(true);
    // A real Space keypress on a focused checkbox produces exactly this
    // input activation (checked flip + change event); the component owns
    // no custom key handlers, so the platform control IS the keyboard
    // story. Enter is not a checkbox activation key — nothing to assert.
    t.input().click();
    await nextTick();
    expect(t.emitted).toEqual([false]);
    expect(t.input().checked).toBe(false);
  });

  it("drops every toggle path while disabled", async () => {
    const t = mountVModel(false, { disabled: true });
    expect(t.root().getAttribute("data-disabled")).toBe("");
    expect(t.input().disabled).toBe(true);
    t.track().click();
    t.input().click();
    // Also the label-forwarding path: the platform drops clicks on a
    // disabled input, so the forwarded activation dies too.
    (t.container.querySelector(".hk-switch-thumb") as HTMLElement).click();
    await nextTick();
    expect(t.emitted).toEqual([]);
    expect(t.model.value).toBe(false);
  });
});
