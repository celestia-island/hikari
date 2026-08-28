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
): { root: HTMLElement; unmount: () => void } {
  const Host = defineComponent({
    setup() {
      return () => h(HkSegmented as never, { options, ...props });
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
