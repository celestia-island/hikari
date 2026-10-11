import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import HkSliderField from "./HkSliderField";
import HkTokenInput, { compactTokenCount } from "./HkTokenInput";
import HkModalCtor from "./HkModal";

/**
 * The two-component contract (the panel composes them; the library
 * ships them SEPARATE and generic):
 *
 * HkSliderField — the boxed slider with leading/trailing slots; no
 * opinion about the value's meaning; the slider takes the room the
 * slots leave; both slots may host dropdowns/editors.
 *
 * HkTokenInput — the standalone token editor (value segment + unit
 * dropdown + the draggable precision editor); rides any slot.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

const setWidth = (w: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: w,
  });
  window.dispatchEvent(new Event("resize"));
};

function mountNode(renderNode: () => ReturnType<typeof h>) {
  setWidth(1280);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: renderNode });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  for (const el of [...document.querySelectorAll(".hk-modal-root, .hk-select-popout")]) {
    el.remove();
  }
});

function pinRect(el: HTMLElement, width = 288) {
  Object.defineProperty(el, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({ left: 0, width, height: 18, top: 0, right: width, bottom: 18, x: 0, y: 0 }) as DOMRect,
  });
}

describe("HkSliderField", () => {
  it("renders the box with both slots and the flexing slider between", () => {
    const c = mountNode(() =>
      h(HkSliderField, { modelValue: 3, min: 0, max: 8, step: 1, showTicks: true, ariaLabel: "L" }, {
        leading: () => h("span", { class: "lead" }, "L"),
        trailing: () => h("span", { class: "trail" }, "T"),
      }),
    );
    const box = c.querySelector(".hk-slider-field") as HTMLElement;
    expect(box.getAttribute("role")).toBe("group");
    expect(box.getAttribute("aria-label")).toBe("L");
    expect(c.querySelectorAll(".hk-slider-tick").length).toBe(9);
    expect(c.querySelector(".hk-slider-field-slot[data-side='leading'] .lead")).toBeTruthy();
    expect(c.querySelector(".hk-slider-field-slot[data-side='trailing'] .trail")).toBeTruthy();
    // Source contract: the box chrome stays generic — no token/budget
    // words in EITHER file, and the scss still carries its structure
    // (an emptied file must not pass vacuously).
    const here = dirname(fileURLToPath(import.meta.url));
    const scss = readFileSync(join(here, "HkSliderField.scss"), "utf-8");
    const tsx = readFileSync(join(here, "HkSliderField.tsx"), "utf-8");
    expect(scss).not.toMatch(/token|budget/i);
    expect(tsx).not.toMatch(/token|budget/i);
    expect(scss).toContain(".hk-slider-field");
    expect(scss).toContain(".hk-slider-field-slot");
  });

  it("commits drags and honors disabled", async () => {
    const seen: number[] = [];
    const v = ref(0);
    const c = mountNode(() =>
      h(HkSliderField, {
        modelValue: v.value,
        min: 0,
        max: 8,
        "onUpdate:modelValue": (n: number) => {
          v.value = n;
          seen.push(n);
        },
      }),
    );
    const slider = c.querySelector(".hk-slider") as HTMLElement;
    pinRect(slider);
    slider.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 144, pointerId: 1, buttons: 1 }));
    expect(seen.at(-1)).toBe(4);
    // Disabled: no commits, and BOTH chrome layers flag it — the
    // inner slider's own is-disabled proves the pass-through (a broken
    // one would let the slider commit while the box looks disabled).
    const seen2: number[] = [];
    const c2 = mountNode(() =>
      h(HkSliderField, {
        modelValue: 0,
        min: 0,
        max: 8,
        disabled: true,
        "onUpdate:modelValue": (n: number) => seen2.push(n),
      }),
    );
    const s2 = c2.querySelector(".hk-slider") as HTMLElement;
    pinRect(s2);
    s2.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 144, pointerId: 1, buttons: 1 }));
    expect(seen2).toEqual([]);
    expect(s2.classList.contains("is-disabled")).toBe(true);
    expect((c2.querySelector(".hk-slider-field") as HTMLElement).classList.contains("is-disabled")).toBe(true);
  });

  it("a dropdown rides the trailing slot untouched (the composition is the host's)", () => {
    const c = mountNode(() =>
      h(HkSliderField, { modelValue: 0, min: 0, max: 8 }, {
        trailing: () => h(HkTokenInput, { modelValue: 128000 }),
      }),
    );
    expect(c.querySelector(".hk-slider-field-slot[data-side='trailing'] .hk-token-input")).toBeTruthy();
    expect((c.querySelector(".hk-token-input-value") as HTMLElement).textContent).toBe("128K");
  });
});

describe("HkTokenInput", () => {
  interface Harness {
    container: HTMLElement;
    emitted: Array<number | null>;
    unitEmitted: Array<string>;
  }

  function mountInput(props: Record<string, unknown> = {}, slots: Record<string, unknown> = {}): Harness {
    const value = ref<number | null>((props.modelValue as number | null) ?? null);
    const unit = ref<string>("auto");
    const emitted: Array<number | null> = [];
    const unitEmitted: Array<string> = [];
    const container = mountNode(() =>
      h(
        HkTokenInput,
        {
          ...props,
          modelValue: value.value,
          unit: unit.value as "auto" | "K" | "M" | "B",
          "onUpdate:modelValue": (v: number | null) => {
            value.value = v;
            emitted.push(v);
          },
          "onUpdate:unit": (u: string) => {
            unit.value = u;
            unitEmitted.push(u);
          },
        },
        slots.editor ? { editor: () => (slots.editor as () => unknown)() } : {},
      ),
    );
    return { container, emitted, unitEmitted };
  }

  async function pickOption(trigger: HTMLButtonElement, label: string) {
    trigger.click();
    await nextTick();
    const popout = document.querySelector<HTMLElement>(".hk-select-popout");
    expect(popout, "the select popout opened").toBeTruthy();
    const row = [...popout!.querySelectorAll<HTMLElement>(".hk-select-option")].find(
      (o) => o.textContent?.trim() === label,
    );
    expect(row, `the ${label} option`).toBeTruthy();
    row!.click();
    await nextTick();
  }

  it("shows the compact value and — for unset", () => {
    const a = mountInput({ modelValue: 128000 });
    expect((a.container.querySelector(".hk-token-input-value") as HTMLElement).textContent).toBe("128K");
    const b = mountInput({});
    expect((b.container.querySelector(".hk-token-input-value") as HTMLElement).textContent).toBe("—");
  });

  it("a custom format wins over the default compaction", () => {
    const a = mountInput({ modelValue: 128000, format: () => "custom" });
    expect((a.container.querySelector(".hk-token-input-value") as HTMLElement).textContent).toBe("custom");
  });

  it("opens the draggable precision editor from the value segment", async () => {
    const a = mountInput({ modelValue: 128000, editorTitle: "Context" });
    (a.container.querySelector(".hk-token-input-value") as HTMLButtonElement).click();
    await nextTick();
    const frame = document.querySelector<HTMLElement>(".hk-modal-content[data-draggable]");
    expect(frame, "the draggable desktop window").toBeTruthy();
    const input = frame!.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("128");
  });

  it("commits unit-scaled absolutes live; unparseable intermediates commit nothing", async () => {
    const a = mountInput({ modelValue: 128000 });
    (a.container.querySelector(".hk-token-input-value") as HTMLButtonElement).click();
    await nextTick();
    const input = document.querySelector<HTMLInputElement>(".hk-modal-content input")!;
    expect(input.value).toBe("128");
    input.value = "2";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(a.emitted.at(-1)).toBe(2000);
    input.value = "1e";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(input.value).toBe("1e");
    expect(a.emitted.filter((v) => v === null)).toEqual([]);
    input.value = "1e3";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    // K-seeded: 1e3 = 1000 in-unit = 1,000,000 tokens.
    expect(a.emitted.at(-1)).toBe(1_000_000);
    expect(input.value).toBe("1e3");
  });

  it("deliberately emptying the input unsets (text-cleared, not button)", async () => {
    const a = mountInput({ modelValue: 128000 });
    (a.container.querySelector(".hk-token-input-value") as HTMLButtonElement).click();
    await nextTick();
    const input = document.querySelector<HTMLInputElement>(".hk-modal-content input")!;
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(a.emitted.at(-1)).toBe(null);
  });

  it("select-all + typing 0 keeps the keystroke (no transient null)", async () => {
    const a = mountInput({ modelValue: 128000 });
    (a.container.querySelector(".hk-token-input-value") as HTMLButtonElement).click();
    await nextTick();
    const input = document.querySelector<HTMLInputElement>(".hk-modal-content input")!;
    input.value = "0";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(input.value).toBe("0");
    expect(a.emitted.filter((v) => v === null)).toEqual([]);
  });

  it("clearing unsets; unit flips re-express, never rescale", async () => {
    const a = mountInput({ modelValue: 1_500_000 });
    (a.container.querySelector(".hk-token-input-value") as HTMLButtonElement).click();
    await nextTick();
    const editorSelect = document.querySelector<HTMLButtonElement>(
      ".hk-modal-content .hk-token-editor .hk-select-trigger",
    )!;
    const input = document.querySelector<HTMLInputElement>(".hk-modal-content input")!;
    await pickOption(editorSelect, "K");
    expect(input.value).toBe("1500");
    expect(a.emitted).toEqual([]);
    (document.querySelector(".hk-token-input-clear") as HTMLButtonElement).click();
    await nextTick();
    expect(a.emitted.at(-1)).toBe(null);
    await vi.waitFor(() => {
      expect(document.querySelector(".hk-modal-content")).toBeNull();
    }, { timeout: 1500 });
  });

  it("a unit flip with unparseable text clears rather than skewing the scale", async () => {
    const a = mountInput({ modelValue: 128000 });
    (a.container.querySelector(".hk-token-input-value") as HTMLButtonElement).click();
    await nextTick();
    const input = document.querySelector<HTMLInputElement>(".hk-modal-content input")!;
    const editorSelect = document.querySelector<HTMLButtonElement>(
      ".hk-modal-content .hk-token-editor .hk-select-trigger",
    )!;
    input.value = "1e";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    await pickOption(editorSelect, "M");
    expect(input.value).toBe("");
    expect(a.emitted.filter((v) => v === null)).toEqual([null]);
  });

  it("the suffix dropdown switches the display unit (fixed K re-expresses)", async () => {
    const a = mountInput({ modelValue: 2_000_000 });
    expect((a.container.querySelector(".hk-token-input-value") as HTMLElement).textContent).toBe("2M");
    await pickOption(a.container.querySelector<HTMLButtonElement>(".hk-token-input .hk-select-trigger")!, "K");
    expect(a.unitEmitted.at(-1)).toBe("K");
    await nextTick();
    expect((a.container.querySelector(".hk-token-input-value") as HTMLElement).textContent).toBe("2000K");
  });

  it("an #editor slot replaces the built-in editor", async () => {
    const a = mountInput({ modelValue: 64000, editorTitle: "E" }, { editor: () => h("button", { class: "custom-editor" }, "custom") });
    (a.container.querySelector(".hk-token-input-value") as HTMLButtonElement).click();
    await nextTick();
    expect(document.querySelector(".custom-editor")).toBeTruthy();
    expect(document.querySelector(".hk-token-editor")).toBeNull();
  });

  it("disables both segments together", () => {
    const a = mountInput({ modelValue: 16000, disabled: true });
    expect((a.container.querySelector(".hk-token-input-value") as HTMLButtonElement).disabled).toBe(true);
    expect(a.container.querySelector(".hk-token-input .hk-select-trigger")!.hasAttribute("disabled")).toBe(true);
  });
});

describe("compactTokenCount", () => {
  it("compacts decimal magnitudes", () => {
    expect(compactTokenCount(750)).toBe("750");
    expect(compactTokenCount(16000)).toBe("16K");
    expect(compactTokenCount(1500000)).toBe("1.5M");
    expect(compactTokenCount(3_000_000_000)).toBe("3B");
    expect(compactTokenCount(null)).toBe("");
  });
});

describe("HkModal draggable (carried pins)", () => {
  async function mountDraggableModal() {
    setWidth(1280);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const open = ref(true);
    const app = createApp({
      setup: () => () =>
        h(
          HkModalCtor,
          {
            modelValue: open.value,
            title: "T",
            draggable: true,
            "onUpdate:modelValue": (v: boolean) => (open.value = v),
          },
          { default: () => "body" },
        ),
    });
    app.mount(container);
    mounts.push({ app, container });
    await nextTick();
    return { container, open };
  }

  it("drags via pointer and hover alone never moves the frame", async () => {
    await mountDraggableModal();
    const frame = document.querySelector<HTMLElement>(".hk-modal-content")!;
    const header = frame.querySelector<HTMLElement>(".hk-modal-header")!;
    const d = (t: string, x: number, opts: Partial<PointerEventInit> = {}) =>
      new PointerEvent(t, { bubbles: true, clientX: x, pointerId: 7, buttons: 1, ...opts });
    header.dispatchEvent(d("pointerdown", 100));
    header.dispatchEvent(d("pointermove", 260));
    expect(frame.style.getPropertyValue("--hk-modal-shift-x")).toBe("160px");
    header.dispatchEvent(d("pointerdown", 100));
    header.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 400, pointerId: 7, buttons: 0 }));
    expect(frame.style.getPropertyValue("--hk-modal-shift-x")).toBe("160px");
  });

  it("a close mid-drag never ghosts into the next open", async () => {
    const { open } = await mountDraggableModal();
    const frame = document.querySelector<HTMLElement>(".hk-modal-content")!;
    const header = frame.querySelector<HTMLElement>(".hk-modal-header")!;
    const d = (t: string, x: number) =>
      new PointerEvent(t, { bubbles: true, clientX: x, pointerId: 7, buttons: 1 });
    header.dispatchEvent(d("pointerdown", 100));
    open.value = false;
    await nextTick();
    open.value = true;
    await nextTick();
    const frame2 = document.querySelector<HTMLElement>(".hk-modal-content")!;
    frame2.querySelector<HTMLElement>(".hk-modal-header")!.dispatchEvent(d("pointermove", 300));
    expect(frame2.style.getPropertyValue("--hk-modal-shift-x")).toBe("");
  });
});
