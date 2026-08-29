import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkSegmented from "./HkSegmented";

/** Let the thumb's post-measure render flush land in happy-dom (the
 *  measurement composable re-renders one tick after a modelValue change). */
async function settle(): Promise<void> {
  await nextTick();
  await new Promise((r) => setTimeout(r, 20));
  await nextTick();
}

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma", disabled: true },
];

/** Mount one HkSegmented in a throwaway app (the repo's test convention —
 *  @vue/test-utils is not a dependency; hosts render into a div and we
 *  assert against the DOM). */
function mountSegmented(
  props: Record<string, unknown>,
  slots?: { overlay?: () => unknown },
): { root: HTMLElement; unmount: () => void } {
  const Host = defineComponent({
    setup() {
      return () =>
        h(HkSegmented as never, { options, ...props }, slots ?? {});
    },
  });
  const el = document.createElement("div");
  document.body.appendChild(el);
  const app = createApp(Host);
  app.mount(el);
  return { root: el, unmount: () => { app.unmount(); el.remove(); } };
}

function segments(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll(".hk-segmented__segment"));
}

/** Stub layout geometry on the segments (happy-dom has none) and return an
 *  undo handle — the defineProperty descriptors must not leak across tests. */
function stubSegmentGeometry(root: HTMLElement, offsets: number[], width: number): () => void {
  const restore: Array<() => void> = [];
  segments(root).forEach((seg, i) => {
    Object.defineProperty(seg, "offsetLeft", { value: offsets[i] ?? 0, configurable: true });
    Object.defineProperty(seg, "offsetWidth", { value: width, configurable: true });
    restore.push(() => {
      delete (seg as unknown as Record<string, unknown>).offsetLeft;
      delete (seg as unknown as Record<string, unknown>).offsetWidth;
    });
  });
  return () => restore.forEach((fn) => fn());
}

describe("HkSegmented", () => {
  it("renders one button per option with checked state on modelValue", () => {
    const { root, unmount } = mountSegmented({ modelValue: "a" });
    const segs = segments(root);
    expect(segs).toHaveLength(3);
    expect(segs[0].getAttribute("data-checked")).toBe("true");
    expect(segs[1].getAttribute("data-checked")).toBeNull();
    unmount();
  });

  it("exposes radiogroup semantics", () => {
    const { root, unmount } = mountSegmented({ modelValue: "a" });
    expect(root.querySelector(".hk-segmented")!.getAttribute("role"))
      .toBe("radiogroup");
    expect(segments(root)[0].getAttribute("role")).toBe("radio");
    unmount();
  });

  it("ignores clicks on the already-selected segment", async () => {
    const { root, unmount } = mountSegmented({ modelValue: "a" });
    segments(root)[0].click();
    await Promise.resolve();
    // Still checked: no v-model host wired, but the click must be inert —
    // verified by the attribute staying set without any error path.
    expect(segments(root)[0].getAttribute("data-checked")).toBe("true");
    unmount();
  });

  it("disables per-option segments and the whole group", () => {
    const { root, unmount } = mountSegmented({ modelValue: "a" });
    const segs = segments(root);
    expect((segs[2] as HTMLButtonElement).disabled).toBe(true);
    unmount();
    const { root: r2, unmount: u2 } = mountSegmented({
      modelValue: "a", disabled: true,
    });
    expect(r2.querySelector(".hk-segmented")!.getAttribute("data-disabled"))
      .toBe("true");
    expect((segments(r2)[1] as HTMLButtonElement).disabled).toBe(true);
    u2();
  });
});

describe("HkSegmented tablist semantics", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()!();
  });

  function mountTabs(): {
    root: HTMLElement;
    modelValue: ReturnType<typeof ref<string>>;
    unmount: () => void;
  } {
    const modelValue = ref("a");
    const Host = defineComponent({
      setup() {
        return () =>
          h(HkSegmented as never, {
            options,
            semantics: "tablist",
            modelValue: modelValue.value,
            "onUpdate:modelValue": (v: string) => { modelValue.value = v; },
          });
      },
    });
    const el = document.createElement("div");
    document.body.appendChild(el);
    const app = createApp(Host);
    app.mount(el);
    return { root: el, modelValue, unmount: () => { app.unmount(); el.remove(); } };
  }

  function key(el: Element, k: string): void {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  }

  it("exposes tab roles with aria-selected and roving tabindex", () => {
    const { root, modelValue, unmount } = mountTabs();
    const group = root.querySelector(".hk-segmented")!;
    expect(group.getAttribute("role")).toBe("tablist");
    const segs = segments(root);
    expect(segs[0].getAttribute("role")).toBe("tab");
    expect(segs[0].getAttribute("aria-selected")).toBe("true");
    expect(segs[0].getAttribute("tabindex")).toBeNull();
    expect(segs[1].getAttribute("aria-selected")).toBe("false");
    expect(segs[1].getAttribute("tabindex")).toBe("-1");
    expect(segs[0].getAttribute("aria-checked")).toBeNull();
    void modelValue;
    unmount();
  });

  it("moves selection with arrow keys and skips disabled options", async () => {
    const { root, modelValue, unmount } = mountTabs();
    const segs = segments(root);
    key(segs[0], "ArrowRight");
    await settle();
    expect(modelValue.value).toBe("b");
    // "c" is disabled: a further step wraps around to "a".
    key(segs[1], "ArrowRight");
    await settle();
    expect(modelValue.value).toBe("a");
    key(segs[0], "ArrowLeft");
    await settle();
    expect(modelValue.value).toBe("b");
    unmount();
  });

  it("jumps with Home and End", async () => {
    const { root, modelValue, unmount } = mountTabs();
    const group = root.querySelector(".hk-segmented")!;
    key(group, "Home");
    await settle();
    expect(modelValue.value).toBe("a");
    key(group, "End");
    await settle();
    // "c" is disabled — End lands on the last enabled option.
    expect(modelValue.value).toBe("b");
    unmount();
  });

  it("also gives radio groups arrow-key navigation", async () => {
    const modelValue = ref("a");
    const Host = defineComponent({
      setup() {
        return () =>
          h(HkSegmented as never, {
            options,
            modelValue: modelValue.value,
            "onUpdate:modelValue": (v: string) => { modelValue.value = v; },
          });
      },
    });
    const el = document.createElement("div");
    document.body.appendChild(el);
    const app = createApp(Host);
    app.mount(el);
    const segs = segments(el);
    expect(el.querySelector(".hk-segmented")!.getAttribute("role")).toBe("radiogroup");
    key(segs[0], "ArrowRight");
    await settle();
    expect(modelValue.value).toBe("b");
    app.unmount();
    el.remove();
  });
});

describe("HkSegmented tail overlay", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()!();
  });

  const overlaySlot = () =>
    h("button", { type: "button", class: "strip" }, "+32.5°");

  it("renders no overlay by default", () => {
    const { root, unmount } = mountSegmented({ modelValue: "a" });
    expect(root.querySelector(".hk-segmented__overlay")).toBeNull();
    unmount();
  });

  it("renders the slot content with an equal-share fallback left", () => {
    const { root, unmount } = mountSegmented(
      { modelValue: "a", overlayFrom: 0 },
      { overlay: overlaySlot },
    );
    const overlay = root.querySelector(".hk-segmented__overlay") as HTMLElement;
    expect(overlay).not.toBeNull();
    // happy-dom has no layout: pre-measurement fallback — after option 0
    // of 3 ≈ one third of the track.
    expect(overlay.style.left).toBe("33.3333%");
    expect(overlay.querySelector(".strip")).not.toBeNull();
    unmount();
  });

  it("spans measured geometry from the anchor option to the track end", async () => {
    const { root, unmount } = mountSegmented(
      { modelValue: "a", overlayFrom: 0 },
      { overlay: overlaySlot },
    );
    cleanups.push(stubSegmentGeometry(root, [14, 64, 114], 48));
    const group = root.querySelector(".hk-segmented") as HTMLElement;
    // Track inner width for the overlay pass (clientWidth on the root).
    Object.defineProperty(group, "clientWidth", { value: 182, configurable: true });
    await settle();
    const overlay = root.querySelector(".hk-segmented__overlay") as HTMLElement;
    expect(overlay.getAttribute("data-ready")).toBe("true");
    // From option 0's right edge (14+48) + gap 2 … to 182 - 2 padding.
    expect(overlay.style.left).toBe("64px");
    expect(overlay.style.width).toBe("116px");
    unmount();
  });

  it("drops the overlay when overlayFrom anchors at the last option", () => {
    const { root, unmount } = mountSegmented(
      { modelValue: "a", overlayFrom: 2 },
      { overlay: overlaySlot },
    );
    expect(root.querySelector(".hk-segmented__overlay")).toBeNull();
    unmount();
  });
});

describe("HkSegmented sliding thumb", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()!();
  });

  /** Host with a live v-model so modelValue changes re-render. */
  function mountReactiveSegmented(): {
    root: HTMLElement;
    modelValue: ReturnType<typeof ref<string>>;
    unmount: () => void;
  } {
    const modelValue = ref("a");
    const Host = defineComponent({
      setup() {
        return () =>
          h(HkSegmented as never, {
            options,
            modelValue: modelValue.value,
            "onUpdate:modelValue": (v: string) => { modelValue.value = v; },
          });
      },
    });
    const el = document.createElement("div");
    document.body.appendChild(el);
    const app = createApp(Host);
    app.mount(el);
    return { root: el, modelValue, unmount: () => { app.unmount(); el.remove(); } };
  }

  it("renders an aria-hidden thumb span as the first root child", () => {
    const { root, unmount } = mountSegmented({ modelValue: "a" });
    const seg = root.querySelector(".hk-segmented")!;
    const thumb = seg.querySelector(".hk-segmented__thumb");
    expect(thumb).not.toBeNull();
    expect(thumb!.getAttribute("aria-hidden")).toBe("true");
    expect(seg.firstElementChild).toBe(thumb);
    // Pre-measurement (happy-dom layout is all zeros): not ready yet, and
    // the thumb carries no geometry.
    expect(seg.getAttribute("data-ready")).toBeNull();
    unmount();
  });

  it("measures the active segment and marks the root data-ready", async () => {
    const { root, unmount } = mountSegmented({ modelValue: "b" });
    // Segment "b" sits one gap (2px) past segment "a" at 14px.
    cleanups.push(stubSegmentGeometry(root, [14, 64, 114], 48));
    await nextTick();
    await nextTick();
    const seg = root.querySelector(".hk-segmented")!;
    expect(seg.getAttribute("data-ready")).toBe("true");
    const thumb = seg.querySelector(".hk-segmented__thumb") as HTMLElement;
    expect(thumb.style.transform).toBe("translateX(64px)");
    expect(thumb.style.width).toBe("48px");
    unmount();
  });

  it("moves the thumb when modelValue changes", async () => {
    const { root, modelValue, unmount } = mountReactiveSegmented();
    cleanups.push(stubSegmentGeometry(root, [14, 64, 114], 48));
    await nextTick();
    await nextTick();
    modelValue.value = "c";
    await settle();
    const thumb = root.querySelector(".hk-segmented__thumb") as HTMLElement;
    expect(thumb.style.transform).toBe("translateX(114px)");
    expect(thumb.style.width).toBe("48px");
    unmount();
  });

  it("stays without data-ready when no geometry is measurable", async () => {
    const { root, unmount } = mountSegmented({ modelValue: "a" });
    await nextTick();
    await nextTick();
    expect(root.querySelector(".hk-segmented")!.getAttribute("data-ready")).toBeNull();
    unmount();
  });

  it("keeps data-ready unset when modelValue matches no option", async () => {
    const { root, unmount } = mountSegmented({ modelValue: "nope" });
    cleanups.push(stubSegmentGeometry(root, [14, 64, 114], 48));
    await settle();
    expect(root.querySelector(".hk-segmented")!.getAttribute("data-ready")).toBeNull();
    const thumb = root.querySelector(".hk-segmented__thumb") as HTMLElement;
    expect(thumb.style.width).toBe("0px");
    unmount();
  });
});
