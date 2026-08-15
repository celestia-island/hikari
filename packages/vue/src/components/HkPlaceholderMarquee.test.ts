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
  vi.spyOn(copy, "getBoundingClientRect").mockReturnValue({ width: copyWidth } as DOMRect);
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

  it("collapses back to a hidden probe when the window grows past the text", async () => {
    const { container } = mountMarquee({ text: "shrinking story" });
    await forceGeometry(container, 500, 200);
    expect(container.querySelectorAll(".hk-placeholder-marquee__copy")).toHaveLength(3);
    await forceGeometry(container, 500, 800);
    const host = container.querySelector(".hk-placeholder-marquee") as HTMLElement;
    expect(container.querySelectorAll(".hk-placeholder-marquee__copy")).toHaveLength(1);
    expect(host.classList.contains("hk-placeholder-marquee--hidden")).toBe(true);
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

  it("exposes setActive without throwing in both directions", async () => {
    const { container } = mountMarquee({ text: "scrolls" });
    await nextTick();
    const exposed = marqueeExposed(container);
    expect(exposed).toBeTruthy();
    expect(typeof exposed!.setActive).toBe("function");
    expect(() => exposed!.setActive!(true)).not.toThrow();
    expect(() => exposed!.setActive!(false)).not.toThrow();
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
