import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkMorphingTabs, { type TabItem } from "./HkMorphingTabs";

/** Let Vue's out-in panel transition and the post-measure indicator render
 *  finish in happy-dom (frame/timeout based). */
async function settle(): Promise<void> {
  await nextTick();
  await new Promise((r) => setTimeout(r, 20));
  await nextTick();
}

const tabs: TabItem[] = [
  { key: "color", label: "Color" },
  { key: "wallpaper", label: "Wallpaper" },
  { key: "style", label: "Style" },
  { key: "dpi", label: "DPI Controls" },
];

const PANEL_TEXT: Record<string, string> = {
  color: "Color panel",
  wallpaper: "Wallpaper panel",
  style: "Style panel",
  dpi: "DPI panel",
};

/** Mount HkMorphingTabs with a live v-model and one slot panel per tab
 *  (the repo's test convention — no @vue/test-utils; assert the DOM). */
function mountTabs(initial = "color"): {
  root: HTMLElement;
  modelValue: ReturnType<typeof ref<string>>;
  unmount: () => void;
} {
  const modelValue = ref(initial);
  const Host = defineComponent({
    setup() {
      return () =>
        h(
          HkMorphingTabs as never,
          {
            tabs,
            modelValue: modelValue.value,
            "onUpdate:modelValue": (v: string) => { modelValue.value = v; },
          },
          Object.fromEntries(
            Object.entries(PANEL_TEXT).map(([key, text]) => [
              key,
              () => h("p", { class: `panel-${key}` }, text),
            ]),
          ),
        );
    },
  });
  const el = document.createElement("div");
  document.body.appendChild(el);
  const app = createApp(Host);
  app.mount(el);
  return { root: el, modelValue, unmount: () => { app.unmount(); el.remove(); } };
}

function triggers(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll(".hk-morphing-tabs-trigger"));
}

describe("HkMorphingTabs", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()!();
  });

  /** Stub trigger layout (happy-dom has none); returns an undo handle. */
  function stubTriggerGeometry(root: HTMLElement, offsets: number[], width: number): () => void {
    const restore: Array<() => void> = [];
    triggers(root).forEach((trg, i) => {
      Object.defineProperty(trg, "offsetLeft", { value: offsets[i] ?? 0, configurable: true });
      Object.defineProperty(trg, "offsetWidth", { value: width, configurable: true });
      restore.push(() => {
        delete (trg as unknown as Record<string, unknown>).offsetLeft;
        delete (trg as unknown as Record<string, unknown>).offsetWidth;
      });
    });
    return () => restore.forEach((fn) => fn());
  }

  it("renders one trigger per tab plus the indicator", () => {
    const { root, unmount } = mountTabs();
    expect(triggers(root)).toHaveLength(4);
    const indicator = root.querySelector(".hk-morphing-tabs-indicator");
    expect(indicator).not.toBeNull();
    expect(indicator!.getAttribute("aria-hidden")).toBe("true");
    expect(root.querySelector(".hk-morphing-tabs-triggers")!.getAttribute("role")).toBe("tablist");
    unmount();
  });

  it("clicking a trigger emits update:modelValue and moves selection", async () => {
    const { root, modelValue, unmount } = mountTabs("color");
    triggers(root)[1].click();
    await nextTick();
    expect(modelValue.value).toBe("wallpaper");
    expect(triggers(root)[1].getAttribute("aria-selected")).toBe("true");
    expect(triggers(root)[0].getAttribute("aria-selected")).toBe("false");
    unmount();
  });

  it("positions the indicator with measured trigger geometry", async () => {
    const { root, unmount } = mountTabs("style");
    // Unequal offsets: what equal-width percentage math gets wrong.
    cleanups.push(stubTriggerGeometry(root, [2, 82, 162, 262], 78));
    await nextTick();
    await nextTick();
    const triggersEl = root.querySelector(".hk-morphing-tabs-triggers")!;
    expect(triggersEl.getAttribute("data-ready")).toBe("true");
    const indicator = root.querySelector(".hk-morphing-tabs-indicator") as HTMLElement;
    expect(indicator.style.transform).toBe("translateX(162px)");
    expect(indicator.style.width).toBe("78px");
    unmount();
  });

  it("switches the panel slot content with modelValue", async () => {
    const { root, modelValue, unmount } = mountTabs("color");
    expect(root.querySelector(".hk-morphing-tabs-panel")!.textContent).toContain("Color panel");
    modelValue.value = "dpi";
    await settle();
    expect(root.querySelector(".hk-morphing-tabs-panel")!.textContent).toContain("DPI panel");
    unmount();
  });
});
