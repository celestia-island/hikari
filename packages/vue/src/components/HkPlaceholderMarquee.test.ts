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

afterEach(() => {
  for (const m of mounts.splice(0)) {
    m.app.unmount();
    m.container.remove();
  }
});

describe("HkPlaceholderMarquee", () => {
  it("renders three identical copies for the seamless wrap", () => {
    const { container } = mountMarquee({ text: "a very long placeholder" });
    const copies = [...container.querySelectorAll(".hk-placeholder-marquee__copy")];
    expect(copies).toHaveLength(3);
    expect(copies.map((c) => c.textContent)).toEqual([
      "a very long placeholder",
      "a very long placeholder",
      "a very long placeholder",
    ]);
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
    // The exposed API lives on the component's setup result; reach it through
    // the root element's __vueParentComponent wiring jsdom provides.
    const el = container.querySelector(".hk-placeholder-marquee") as HTMLElement & {
      __vueParentComponent?: { exposed?: { setActive?(a: boolean): void } };
    };
    const exposed = el?.__vueParentComponent?.exposed;
    expect(exposed).toBeTruthy();
    expect(typeof exposed!.setActive).toBe("function");
    expect(() => exposed!.setActive!(true)).not.toThrow();
    expect(() => exposed!.setActive!(false)).not.toThrow();
  });

  it("re-renders the copies when the text prop changes", async () => {
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
    expect(copies.map((c) => c.textContent?.trim())).toEqual(["second", "second", "second"]);
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

  it("hides the native placeholder and mounts the marquee overlay by default", () => {
    const { container } = mountInput({
      placeholder: "marquee is the default overflow behavior",
    });
    const input = container.querySelector("input")!;
    expect(input.getAttribute("placeholder")).toBe("");
    expect(container.querySelector(".hk-placeholder-marquee")).toBeTruthy();
    const copies = [...container.querySelectorAll(".hk-placeholder-marquee__copy")];
    expect(copies).toHaveLength(3);
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
