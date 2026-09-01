import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import { HkPlaceholderMarquee } from "./HkPlaceholderMarquee";
import HkInput from "./HkInput";

interface Mounted<T> {
  app: ReturnType<typeof createApp>;
  container: HTMLElement;
  vm: T;
}

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountMarquee(props: Record<string, unknown> = {}): Mounted<InstanceType<typeof HkPlaceholderMarquee>> & { container: HTMLElement } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkPlaceholderMarquee, { ...props }) });
  app.mount(container);
  mounts.push({ app, container });
  const root = app._container?.firstElementChild
    ? (app as unknown as { _instance?: { proxy?: InstanceType<typeof HkPlaceholderMarquee> } })._instance?.proxy
    : undefined;
  void root;
  // The component root instance: mount() renders a single root node owned by
  // HkPlaceholderMarquee, so the app's root proxy IS the marquee instance.
  const vm = (app._instance as unknown as { proxy: InstanceType<typeof HkPlaceholderMarquee> } | undefined)?.proxy;
  return { app, container, vm: vm! };
}

function mountInput(props: Record<string, unknown> = {}) {
  const model = ref("");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render() {
      return h(HkInput, {
        ...props,
        modelValue: model.value,
        "onUpdate:modelValue": (v: string) => {
          model.value = v;
        },
      });
    },
  });
  app.mount(container);
  mounts.push({ app, container });
  return { model, app, container };
}

type MarqueeExposed = {
  setActive?(a: boolean): void;
  measure?(): void;
};

function marqueeExposed(container: HTMLElement): MarqueeExposed | undefined {
  const el = container.querySelector(".hk-placeholder-marquee") as (HTMLElement & {
    __vueParentComponent?: { exposed?: MarqueeExposed };
  }) | null;
  return el?.__vueParentComponent?.exposed;
}

/** Simulate real layout for the clipping window and the first copy, then
 * re-run the component's measurement so the render reflects the geometry. */
async function forceGeometry(
  container: HTMLElement,
  copyWidth: number,
  hostWidth: number,
) {
  const host = container.querySelector(".hk-placeholder-marquee") as HTMLElement;
  const copy = container.querySelector(".hk-placeholder-marquee__copy") as HTMLElement;
  expect(host && copy).toBeTruthy();
  Object.defineProperty(host, "clientWidth", { configurable: true, get: () => hostWidth });
  Object.defineProperty(copy, "offsetWidth", { configurable: true, get: () => copyWidth });
  marqueeExposed(container)?.measure?.();
  await nextTick();
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const m of mounts.splice(0)) {
    m.app.unmount();
    m.container.remove();
  }
});

describe("HkPlaceholderMarquee", () => {
  it("stays a hidden single-copy probe while the text fits", () => {
    const { container } = mountMarquee({ text: "用户名" });
    const host = container.querySelector(".hk-placeholder-marquee") as HTMLElement;
    const copies = [...container.querySelectorAll(".hk-placeholder-marquee__copy")];
    // No layout in jsdom → nothing overflows → one measuring copy, layer
    // hidden; the host input's native placeholder does the actual showing.
    expect(copies).toHaveLength(1);
    expect(copies[0].textContent).toBe("用户名");
    expect(host.classList.contains("hk-placeholder-marquee--hidden")).toBe(true);
    // The strip carries no animation while the text fits.
    expect(container.querySelector(".hk-placeholder-marquee__strip--scroll")).toBeNull();
  });

  it("renders three identical copies for the seamless wrap once the text overflows", async () => {
    const { container } = mountMarquee({ text: "a very long placeholder" });
    await forceGeometry(container, /* copy incl. spacing */ 500, /* window */ 200);
    const host = container.querySelector(".hk-placeholder-marquee") as HTMLElement;
    const copies = [...container.querySelectorAll(".hk-placeholder-marquee__copy")];
    expect(copies).toHaveLength(3);
    expect(copies.map((c) => c.textContent)).toEqual([
      "a very long placeholder",
      "a very long placeholder",
      "a very long placeholder",
    ]);
    expect(host.classList.contains("hk-placeholder-marquee--hidden")).toBe(false);
  });

  it("drives the sweep with CSS custom properties instead of per-frame JS", async () => {
    const { container } = mountMarquee({ text: "advent calendar of placeholders" });
    await forceGeometry(container, 500, 200);
    const strip = container.querySelector(".hk-placeholder-marquee__strip") as HTMLElement;
    // The animation class rides the strip; the loop geometry is published
    // as custom properties (never recomputed per frame by JS).
    expect(strip.classList.contains("hk-placeholder-marquee__strip--scroll")).toBe(true);
    expect(strip.style.getPropertyValue("--hk-marquee-shift")).toBe("-500px");
    // 500px at the default 24px/s → 20.833s per loop.
    expect(strip.style.getPropertyValue("--hk-marquee-duration")).toBe("20.833s");
    expect(strip.getAttribute("style")).not.toContain("transform");
  });

  it("collapses back to a hidden probe when the window grows past the text", async () => {
    const { container } = mountMarquee({ text: "shrinking story" });
    await forceGeometry(container, 500, 200);
    expect(container.querySelectorAll(".hk-placeholder-marquee__copy")).toHaveLength(3);
    await forceGeometry(container, 500, 800);
    const host = container.querySelector(".hk-placeholder-marquee") as HTMLElement;
    expect(container.querySelectorAll(".hk-placeholder-marquee__copy")).toHaveLength(1);
    expect(host.classList.contains("hk-placeholder-marquee--hidden")).toBe(true);
    expect(container.querySelector(".hk-placeholder-marquee__strip--scroll")).toBeNull();
  });

  it("renders a single ellipsis copy in truncate variant", () => {
    const { container } = mountMarquee({ text: "too long", variant: "truncate" });
    expect(container.querySelector(".hk-placeholder-marquee--truncate")).toBeTruthy();
    expect(container.querySelectorAll(".hk-placeholder-marquee__copy")).toHaveLength(0);
  });

  it("renders nothing for empty text", () => {
    const { container } = mountMarquee({ text: "" });
    expect(container.querySelector(".hk-placeholder-marquee")).toBeNull();
  });

  it("exposes setActive: focus parks the sweep via data-parked, blur resumes", async () => {
    const { container } = mountMarquee({ text: "scrolls" });
    await forceGeometry(container, 500, 200);
    await nextTick();
    const exposed = marqueeExposed(container);
    expect(exposed).toBeTruthy();
    const host = container.querySelector(".hk-placeholder-marquee") as HTMLElement;
    exposed!.setActive!(true);
    await nextTick();
    expect(host.hasAttribute("data-parked")).toBe(true);
    exposed!.setActive!(false);
    await nextTick();
    expect(host.hasAttribute("data-parked")).toBe(false);
  });

  it("republishes the loop geometry when the text changes while the overflow persists", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const textRef = ref("first placeholder");
    const app = createApp({
      render: () => h(HkPlaceholderMarquee, { text: textRef.value }),
    });
    app.mount(container);
    mounts.push({ app, container });
    // Overflow with copy width 500.
    const host = container.querySelector(".hk-placeholder-marquee") as HTMLElement;
    const copy = container.querySelector(".hk-placeholder-marquee__copy") as HTMLElement;
    Object.defineProperty(host, "clientWidth", { configurable: true, get: () => 200 });
    Object.defineProperty(copy, "offsetWidth", { configurable: true, get: () => 500 });
    marqueeExposed(container)?.measure?.();
    await nextTick();
    // Swap the text AND the laid-out width while still overflowing — the
    // vars must republish (this used to freeze on the stale measurement).
    textRef.value = "a much longer second placeholder";
    await nextTick();
    Object.defineProperty(copy, "offsetWidth", { configurable: true, get: () => 700 });
    marqueeExposed(container)?.measure?.();
    await nextTick();
    const strip = container.querySelector(".hk-placeholder-marquee__strip") as HTMLElement;
    expect(strip.classList.contains("hk-placeholder-marquee__strip--scroll")).toBe(true);
    expect(strip.style.getPropertyValue("--hk-marquee-shift")).toBe("-700px");
    // 700px at 24px/s → 29.167s per loop.
    expect(strip.style.getPropertyValue("--hk-marquee-duration")).toBe("29.167s");
  });

  it("re-renders the copy when the text prop changes", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const textRef = ref("first");
    const app = createApp({
      render: () => h(HkPlaceholderMarquee, { text: textRef.value }),
    });
    app.mount(container);
    mounts.push({ app, container });
    textRef.value = "second";
    await nextTick();
    const copies = [...container.querySelectorAll(".hk-placeholder-marquee__copy")];
    expect(copies.map((c) => c.textContent?.trim())).toEqual(["second"]);
  });
});

describe("HkInput placeholder-variant", () => {
  it("keeps the native placeholder in truncate mode and mounts no marquee", () => {
    const { container } = mountInput({
      placeholder: "truncation keeps the native placeholder",
      placeholderVariant: "truncate",
    });
    const input = container.querySelector("input")!;
    expect(input.getAttribute("placeholder")).toBe("truncation keeps the native placeholder");
    expect(container.querySelector(".hk-placeholder-marquee")).toBeNull();
  });

  it("keeps the native placeholder and mounts only a hidden probe while the text fits", () => {
    const { container } = mountInput({
      placeholder: "short placeholder that fits",
    });
    const input = container.querySelector("input")!;
    // Not overflowing → the native placeholder shows; the overlay is a
    // hidden one-copy measuring probe, never visible.
    expect(input.getAttribute("placeholder")).toBe("short placeholder that fits");
    const host = container.querySelector(".hk-placeholder-marquee") as HTMLElement;
    expect(host).toBeTruthy();
    expect(host.classList.contains("hk-placeholder-marquee--hidden")).toBe(true);
    expect(container.querySelectorAll(".hk-placeholder-marquee__copy")).toHaveLength(1);
  });

  it("swaps to the visible marquee and blanks the native placeholder on overflow", async () => {
    const model = ref("");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render() {
        return h(HkInput, {
          placeholder: "an extremely long placeholder text",
          modelValue: model.value,
          "onUpdate:modelValue": (v: string) => {
            model.value = v;
          },
        });
      },
    });
    app.mount(container);
    mounts.push({ app, container });
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("placeholder")).toBe("an extremely long placeholder text");
    await forceGeometry(container, 500, 200);
    expect(input.getAttribute("placeholder")).toBe("");
    expect(container.querySelectorAll(".hk-placeholder-marquee__copy")).toHaveLength(3);
  });

  it("parks the sweep when the host input is focused", async () => {
    const { container } = mountInput({
      placeholder: "focus parks the sweeping placeholder sign",
    });
    await forceGeometry(container, 500, 200);
    const host = container.querySelector(".hk-placeholder-marquee") as HTMLElement;
    const input = container.querySelector("input") as HTMLInputElement;
    input.dispatchEvent(new Event("focus"));
    await nextTick();
    expect(host.hasAttribute("data-parked")).toBe(true);
    input.dispatchEvent(new Event("blur"));
    await nextTick();
    expect(host.hasAttribute("data-parked")).toBe(false);
  });

  it("drops the overlay once the input holds a value", async () => {
    const mounted = mountInput({ placeholder: "typing hides the layer" });
    expect(mounted.container.querySelector(".hk-placeholder-marquee")).toBeTruthy();
    mounted.model.value = "typed";
    await nextTick();
    expect(mounted.container.querySelector(".hk-placeholder-marquee")).toBeNull();
  });

  it("never mounts the overlay when disabled", () => {
    const { container } = mountInput({
      placeholder: "disabled inputs show nothing",
      disabled: true,
    });
    expect(container.querySelector(".hk-placeholder-marquee")).toBeNull();
  });
});
