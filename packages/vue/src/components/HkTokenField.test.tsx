import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkTokenField, { compactTokens, DEFAULT_TOKEN_STOPS, HkTokenValueEditor } from "./HkTokenField";
import HkModalCtor from "./HkModal";

/**
 * HkTokenField contract tests (repo convention: raw createApp +
 * document queries, no @vue/test-utils):
 * - the doubling ladder drives the slider in INDEX space (drags commit
 *   the stop's token count)
 * - an off-ladder value keeps the exact budget, resting the thumb at
 *   the nearest stop (data-off-ladder marks the value segment)
 * - the value segment opens the precision editor (a DRAGGABLE desktop
 *   window through HkAdaptiveDialog) whose numeric input commits
 *   unit-scaled absolutes and whose clear unsets
 * - the suffix unit dropdown switches the display unit; unit flips
 *   inside the editor re-express the same absolute value
 * - an #editor slot replaces the built-in editor (the composition
 *   contract the model editor asked for)
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

interface FieldHarness {
  container: HTMLElement;
  value: ReturnType<typeof ref<number | null>>;
  unit: ReturnType<typeof ref<string>>;
  emitted: Array<number | null>;
  unitEmitted: Array<string>;
}

function mountField(
  props: Record<string, unknown> = {},
  slots: Record<string, unknown> = {},
): FieldHarness {
  setWidth(1280);
  const container = document.createElement("div");
  document.body.appendChild(container);
  // Seeded from props so the controlled flow round-trips: the ref
  // feeds back whatever the field emits.
  const value = ref<number | null>((props.modelValue as number | null) ?? null);
  const unit = ref<string>("auto");
  const emitted: Array<number | null> = [];
  const unitEmitted: Array<string> = [];
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(
          HkTokenField,
          {
            ...props,
            modelValue: value.value as number | null,
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
        );
    },
  });
  const app = createApp(Wrapper);
  app.mount(container);
  mounts.push({ app, container });
  return { container, value, unit, emitted, unitEmitted };
}

/** Pin a 288px-wide, left-0 rect so index-space drag math is exact
 * (9 stops × 36px per rung). */
function pinRect(el: HTMLElement) {
  Object.defineProperty(el, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({ left: 0, width: 288, height: 18, top: 0, right: 288, bottom: 18, x: 0, y: 0 }) as DOMRect,
  });
}

function pointer(type: string, clientX: number) {
  return new PointerEvent(type, { bubbles: true, clientX, pointerId: 1, pointerType: "touch" });
}

async function dragSlider(h: FieldHarness, clientX: number) {
  const slider = h.container.querySelector(".hk-slider") as HTMLElement;
  pinRect(slider);
  slider.dispatchEvent(pointer("pointerdown", clientX));
  window.dispatchEvent(pointer("pointerup", clientX));
  await nextTick();
}

function fieldSelects(h: FieldHarness): HTMLButtonElement[] {
  return [...h.container.querySelectorAll<HTMLButtonElement>(".hk-select-trigger")];
}

async function pickOption(selectTrigger: HTMLButtonElement, label: string) {
  selectTrigger.click();
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

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  // Teleported popups (dialogs, popouts) unmount with their apps, but
  // any stragglers must not leak into the next case's queries.
  for (const el of [...document.querySelectorAll(".hk-modal-root, .hk-select-popout")]) {
    el.remove();
  }
});

describe("HkTokenField", () => {
  it("renders the default ladder in index space and commits a drag's stop", async () => {
    const h = mountField({ modelValue: 16_000 });
    const slider = h.container.querySelector(".hk-slider") as HTMLElement;
    expect(slider.getAttribute("aria-valuemin")).toBe("0");
    expect(slider.getAttribute("aria-valuemax")).toBe(String(DEFAULT_TOKEN_STOPS.length - 1));
    // Press at 144/288 = index 4 = 256K.
    await dragSlider(h, 144);
    expect(h.emitted.at(-1)).toBe(256_000);
  });

  it("rests the thumb at the NEAREST stop for an off-ladder value, keeping the exact budget", () => {
    // 300K sits between 256K (idx 4) and 512K (idx 5), nearer the former.
    const h = mountField({ modelValue: 300_000 });
    const slider = h.container.querySelector(".hk-slider") as HTMLElement;
    expect(slider.getAttribute("aria-valuenow")).toBe("4");
    expect(h.container.querySelector(".hk-token-field")!.getAttribute("data-off-ladder")).toBeTruthy();
    expect(h.container.querySelector(".hk-token-field-value")!.textContent).toBe("300K");
    // Nothing was emitted — the exact value stands until a drag.
    expect(h.emitted).toEqual([]);
  });

  it("a drag to another rung replaces an off-ladder value with that stop", async () => {
    const h = mountField({ modelValue: 300_000 });
    // The thumb already rests at index 4 (256K); press index 5 (512K).
    await dragSlider(h, 180);
    expect(h.emitted.at(-1)).toBe(512_000);
  });

  it("pressing the rung the thumb already rests on keeps the exact value", async () => {
    const h = mountField({ modelValue: 300_000 });
    await dragSlider(h, 144); // index 4 — already there
    expect(h.emitted).toEqual([]);
  });

  it("opens a draggable precision editor from the value segment", async () => {
    const h = mountField({ modelValue: 128_000, editorTitle: "Context" });
    (h.container.querySelector(".hk-token-field-value") as HTMLButtonElement).click();
    await nextTick();
    const frame = document.querySelector<HTMLElement>(".hk-modal-content[data-draggable]");
    expect(frame, "the draggable desktop window").toBeTruthy();
    const input = frame!.querySelector("input") as HTMLInputElement;
    // Seeded at the auto-compacted magnitude (K) — 128.
    expect(input.value).toBe("128");
  });

  it("the editor commits unit-scaled absolutes live", async () => {
    const h = mountField({ modelValue: 1_500_000 });
    (h.container.querySelector(".hk-token-field-value") as HTMLButtonElement).click();
    await nextTick();
    const input = document.querySelector(".hk-modal-content input") as HTMLInputElement;
    expect(input.value).toBe("1.5");
    input.value = "2";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(h.emitted.at(-1)).toBe(2_000_000);
  });

  it("clearing in the editor unsets the value", async () => {
    const h = mountField({ modelValue: 128_000 });
    (h.container.querySelector(".hk-token-field-value") as HTMLButtonElement).click();
    await nextTick();
    (document.querySelector(".hk-token-field-clear") as HTMLButtonElement).click();
    await nextTick();
    expect(h.emitted.at(-1)).toBe(null);
    // The window folds out through its leave transition.
    await vi.waitFor(() => {
      expect(document.querySelector(".hk-modal-content")).toBeNull();
    }, { timeout: 1500 });
  });

  it("the suffix dropdown switches the display unit", async () => {
    const h = mountField({ modelValue: 2_000_000 });
    expect(h.container.querySelector(".hk-token-field-value")!.textContent).toBe("2M");
    // Fixed K re-expresses the SAME budget (not the auto form).
    await pickOption(fieldSelects(h)[0]!, "K");
    expect(h.unitEmitted.at(-1)).toBe("K");
    await nextTick();
    expect(h.container.querySelector(".hk-token-field-value")!.textContent).toBe("2000K");
  });

  it("unit flips inside the editor re-express, never rescale, the budget", async () => {
    const h = mountField({ modelValue: 1_500_000 });
    (h.container.querySelector(".hk-token-field-value") as HTMLButtonElement).click();
    await nextTick();
    const editorSelect = document.querySelector<HTMLButtonElement>(
      ".hk-modal-content .hk-token-editor .hk-select-trigger",
    )!;
    const input = document.querySelector<HTMLInputElement>(".hk-modal-content input")!;
    expect(input.value).toBe("1.5");
    await pickOption(editorSelect, "K");
    expect(input.value).toBe("1500");
    expect(h.emitted).toEqual([]);
  });

  it("an #editor slot replaces the built-in editor", async () => {
    // NB: the harness is `f` here — `h` stays Vue's hyperscript.
    const f = mountField(
      { modelValue: 64_000, editorTitle: "Edit" },
      { editor: () => h("button", { class: "custom-editor" }, "custom") },
    );
    (f.container.querySelector(".hk-token-field-value") as HTMLButtonElement).click();
    await nextTick();
    expect(document.querySelector(".custom-editor")).toBeTruthy();
    expect(document.querySelector(".hk-token-editor")).toBeNull();
  });

  it("disables every part together", () => {
    const h = mountField({ modelValue: 16_000, disabled: true });
    expect((h.container.querySelector(".hk-slider") as HTMLElement).classList.contains("is-disabled")).toBe(true);
    expect((h.container.querySelector(".hk-token-field-value") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("HkTokenValueEditor (standalone)", () => {
  it("seeds in the entry unit and commits scaled absolutes", async () => {
    setWidth(1280);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const seen: Array<number | null> = [];
    const app = createApp({
      setup: () => () =>
        h(HkTokenValueEditor, {
          modelValue: 128_000,
          unit: "K",
          stops: [...DEFAULT_TOKEN_STOPS],
          "onUpdate:modelValue": (v: number | null) => seen.push(v),
        }),
    });
    app.mount(container);
    mounts.push({ app, container });
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("128");
    input.value = "64";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(seen.at(-1)).toBe(64_000);
    // Empty unsets rather than zeroing.
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(seen.at(-1)).toBe(null);
  });
});

describe("compactTokens", () => {
  it("compacts decimal magnitudes", () => {
    expect(compactTokens(750)).toBe("750");
    expect(compactTokens(16_000)).toBe("16K");
    expect(compactTokens(128_000)).toBe("128K");
    expect(compactTokens(1_500_000)).toBe("1.5M");
    expect(compactTokens(3_000_000_000)).toBe("3B");
  });
});

describe("HkTokenField — typing survives round-trips (R1 P2 pins)", () => {
  it("select-all + typing 0 over 128K keeps the keystroke (no transient null)", async () => {
    const h = mountField({ modelValue: 128_000 });
    (h.container.querySelector(".hk-token-field-value") as HTMLButtonElement).click();
    await nextTick();
    const input = document.querySelector<HTMLInputElement>(".hk-modal-content input")!;
    input.value = "0";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    // Nothing committed (0 is not a valid budget) but the TEXT stays.
    expect(input.value).toBe("0");
    expect(h.emitted.filter((v) => v === null)).toEqual([]);
  });

  it("a transiently unparseable intermediate (1e) commits nothing", async () => {
    const h = mountField({ modelValue: 128_000 });
    (h.container.querySelector(".hk-token-field-value") as HTMLButtonElement).click();
    await nextTick();
    const input = document.querySelector<HTMLInputElement>(".hk-modal-content input")!;
    input.value = "1e";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(input.value).toBe("1e");
    expect(h.emitted.filter((v) => v === null)).toEqual([]);
    // Completing the exponent commits the parsed absolute (K-seeded:
    // 1e3 = 1000 in-unit = 1,000,000 tokens).
    input.value = "1e3";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(h.emitted.at(-1)).toBe(1_000_000);
  });

  it("a unit flip with unparseable text clears rather than skewing the scale", async () => {
    const h = mountField({ modelValue: 128_000 });
    (h.container.querySelector(".hk-token-field-value") as HTMLButtonElement).click();
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
    expect(h.emitted.filter((v) => v === null)).toEqual([null]);
  });
});

describe("HkModal draggable (R1 pins)", () => {
  async function mountDraggableModal() {
    setWidth(1280);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const open = ref(true);
    const HkModal = HkModalCtor;
    const app = createApp({
      setup: () => () =>
        h(
          HkModal,
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

  it("drags via pointer and writes the shift vars; hover alone never moves the frame", async () => {
    const { container } = await mountDraggableModal();
    const frame = document.querySelector<HTMLElement>(".hk-modal-content")!;
    const header = frame.querySelector<HTMLElement>(".hk-modal-header")!;
    expect(frame.getAttribute("data-draggable")).toBeTruthy();
    const d = (t: string, x: number, opts: Partial<PointerEventInit> = {}) =>
      new PointerEvent(t, { bubbles: true, clientX: x, pointerId: 7, buttons: 1, ...opts });
    header.dispatchEvent(d("pointerdown", 100));
    // With the header holding pointer capture, moves retarget to the
    // header — even far outside its box.
    header.dispatchEvent(d("pointermove", 260));
    expect(frame.style.getPropertyValue("--hk-modal-shift-x")).toBe("160px");
    // A subsequent press whose moves carry no button (pure hover)
    // never moves the frame.
    header.dispatchEvent(d("pointerdown", 100));
    header.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 400, pointerId: 7, buttons: 0 }));
    expect(frame.style.getPropertyValue("--hk-modal-shift-x")).toBe("160px");
  });
});
