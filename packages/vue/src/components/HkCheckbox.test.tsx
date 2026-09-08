import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkCheckbox from "./HkCheckbox";

/**
 * HkCheckbox contract tests:
 * - tri-state model wiring: false → unlit box, true → check icon (or dot
 *   in radio mode), null → indeterminate dash (checkbox mode only)
 * - the label shell is a real <label> wrapping the native input, so
 *   clicking the TEXT forwards to the input and toggles (label association)
 * - change events carry the input's NEW checked value; disabled drops them
 * - the data-animating pulse is set on change and cleared by the 300ms
 *   cron one-shot
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
function mountVModel(initial: boolean | null, props: Record<string, unknown> = {}) {
  const model = ref<boolean | null>(initial);
  const emitted: Array<boolean> = [];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(defineComponent({
    setup: () => () =>
      h(HkCheckbox, {
        ...props,
        modelValue: model.value as boolean,
        "onUpdate:modelValue": (v: boolean) => {
          model.value = v;
          emitted.push(v);
        },
      }),
  }));
  app.mount(container);
  mounts.push({ app, container });
  const input = () => container.querySelector<HTMLInputElement>("input")!;
  const box = () => container.querySelector<HTMLElement>(".hk-checkbox-box")!;
  const root = () => container.querySelector<HTMLElement>("label")!;
  return { container, model, emitted, input, box, root };
}

afterEach(() => {
  vi.useRealTimers();
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkCheckbox model states", () => {
  it("renders an unlit box and an unchecked native checkbox by default", () => {
    const c = mount(h(HkCheckbox));
    const root = c.querySelector<HTMLElement>("label")!;
    expect(root.className).toBe("hk-checkbox hk-checkbox-md");
    expect(root.getAttribute("data-type")).toBe("checkbox");
    const input = c.querySelector<HTMLInputElement>("input")!;
    expect(input.type).toBe("checkbox");
    expect(input.checked).toBe(false);
    const box = c.querySelector<HTMLElement>(".hk-checkbox-box")!;
    expect(box.hasAttribute("data-checked")).toBe(false);
    expect(box.hasAttribute("data-indeterminate")).toBe(false);
    expect(c.querySelector(".hk-checkbox-icon")).toBeNull();
    expect(c.querySelector(".hk-checkbox-indeterminate")).toBeNull();
  });

  it("maps modelValue=true to the checked box with the check icon", () => {
    const c = mount(h(HkCheckbox, { modelValue: true }));
    const box = c.querySelector<HTMLElement>(".hk-checkbox-box")!;
    expect(box.getAttribute("data-checked")).toBe("");
    expect(c.querySelector<HTMLInputElement>("input")!.checked).toBe(true);
    // The glyph is the lucide Check svg itself (lucide puts the class on
    // its root <svg>), not the radio dot.
    expect(c.querySelector("svg.hk-checkbox-icon")).not.toBeNull();
    expect(c.querySelector(".hk-checkbox-dot")).toBeNull();
  });

  it("maps modelValue=null to the indeterminate dash without checking the input", () => {
    const c = mount(h(HkCheckbox, { modelValue: null as unknown as boolean }));
    const box = c.querySelector<HTMLElement>(".hk-checkbox-box")!;
    expect(box.getAttribute("data-indeterminate")).toBe("");
    expect(box.hasAttribute("data-checked")).toBe(false);
    // null is NOT true: the native input stays unchecked.
    expect(c.querySelector<HTMLInputElement>("input")!.checked).toBe(false);
    expect(c.querySelector(".hk-checkbox-indeterminate")).not.toBeNull();
    expect(c.querySelector(".hk-checkbox-icon")).toBeNull();
  });

  it("radio mode swaps the check icon for the dot and drops the indeterminate dash", () => {
    const checked = mount(h(HkCheckbox, { modelValue: true, type: "radio" }));
    expect(checked.querySelector("label")!.getAttribute("data-type")).toBe("radio");
    expect(checked.querySelector<HTMLInputElement>("input")!.type).toBe("radio");
    expect(checked.querySelector(".hk-checkbox-dot")).not.toBeNull();
    expect(checked.querySelector(".hk-checkbox-icon")).toBeNull();

    // null in radio mode: no dash — indeterminate is checkbox-only.
    const unset = mount(h(HkCheckbox, { modelValue: null as unknown as boolean, type: "radio" }));
    expect(unset.querySelector(".hk-checkbox-indeterminate")).toBeNull();
    expect(unset.querySelector(".hk-checkbox-dot")).toBeNull();
  });

  it("maps the size prop to the shell modifier", () => {
    const c = mount(h(HkCheckbox, { size: "sm" }));
    expect(c.querySelector("label")!.className).toContain("hk-checkbox-sm");
  });
});

describe("HkCheckbox label", () => {
  it("renders the label prop through the HkLabel shell", () => {
    const c = mount(h(HkCheckbox, { label: "Remember login" }));
    const label = c.querySelector<HTMLElement>(".hk-label")!;
    expect(label).not.toBeNull();
    expect(label.textContent).toBe("Remember login");
  });

  it("prefers default-slot content over the label prop", () => {
    const c = mount(
      h(HkCheckbox, { label: "plain" }, () => ["rich ", h("b", "text")]),
    );
    expect(c.querySelector(".hk-label")!.textContent).toBe("rich text");
  });

  it("renders no label shell without label prop or slot", () => {
    const c = mount(h(HkCheckbox));
    expect(c.querySelector(".hk-label")).toBeNull();
  });
});

describe("HkCheckbox change wiring", () => {
  it("round-trips v-model through native input activation", async () => {
    const t = mountVModel(false);
    t.input().click();
    await nextTick();
    expect(t.emitted).toEqual([true]);
    expect(t.model.value).toBe(true);
    expect(t.input().checked).toBe(true);
    expect(t.box().getAttribute("data-checked")).toBe("");

    t.input().click();
    await nextTick();
    expect(t.emitted).toEqual([true, false]);
    expect(t.box().hasAttribute("data-checked")).toBe(false);
  });

  it("toggles through the label text — the shell is a real <label>", async () => {
    const t = mountVModel(false, { label: "Remember login" });
    // Clicking the TEXT (not the input): the platform forwards the click
    // to the first labelable descendant — the checkbox input — which
    // toggles and fires the change the component listens to.
    (t.container.querySelector(".hk-label") as HTMLElement).click();
    await nextTick();
    expect(t.emitted).toEqual([true]);
    expect(t.input().checked).toBe(true);
  });

  it("emits the post-click indeterminate resolution as a plain boolean", async () => {
    // null (indeterminate) + click → the input lands checked → emits true.
    const t = mountVModel(null);
    t.input().click();
    await nextTick();
    expect(t.emitted).toEqual([true]);
    expect(t.box().getAttribute("data-checked")).toBe("");
    expect(t.box().hasAttribute("data-indeterminate")).toBe(false);
  });

  it("pulses data-animating on change and clears it after the 300ms cron", async () => {
    vi.useFakeTimers();
    const t = mountVModel(false);
    t.input().click();
    await nextTick();
    expect(t.root().getAttribute("data-animating")).toBe("");

    vi.advanceTimersByTime(300);
    await nextTick();
    expect(t.root().hasAttribute("data-animating")).toBe(false);
  });

  it("drops change events entirely while disabled", async () => {
    const t = mountVModel(false, { disabled: true });
    expect(t.input().disabled).toBe(true);
    expect(t.root().getAttribute("data-disabled")).toBe("");
    // The platform fires no activation on a disabled input.
    t.input().click();
    t.container.querySelector<HTMLElement>(".hk-checkbox-box")!.click();
    await nextTick();
    expect(t.emitted).toEqual([]);
    expect(t.input().checked).toBe(false);
  });
});
