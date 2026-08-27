import { afterEach, describe, expect, it, vitest } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkFab from "./HkFab";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

interface Harness {
  root: HTMLElement;
  button: HTMLButtonElement;
  clicks: MouseEvent[];
  toggles: boolean[];
}

/** Mount an HkFab through a wrapper app and collect emitted click /
 *  toggle events (mirrors the HkModal.test.tsx mount pattern). */
function mountFab(props: Record<string, unknown> = {}): Harness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const harness: Harness = {
    root: null as unknown as HTMLElement,
    button: null as unknown as HTMLButtonElement,
    clicks: [],
    toggles: [],
  };

  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkFab, {
          "onClick": (e: MouseEvent) => harness.clicks.push(e),
          "onToggle": (open: boolean) => harness.toggles.push(open),
          ...props,
        });
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);

  const root = container.querySelector<HTMLElement>(".hk-fab");
  const button = container.querySelector<HTMLButtonElement>(".hk-fab-button");
  if (!root || !button) throw new Error("HkFab did not render its shell");
  harness.root = root;
  harness.button = button;
  return harness;
}

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
});

describe("HkFab shell", () => {
  it("renders a round button with the aria label and the default chevron svg", () => {
    const m = mountFab({ ariaLabel: "Jump to latest" });
    expect(m.button.getAttribute("aria-label")).toBe("Jump to latest");
    // No icon prop -> inline chevron-down fallback svg.
    expect(m.button.querySelector("svg polyline")).not.toBeNull();
  });

  it("mirrors positioning/corner/size/variant props onto data attributes", () => {
    const m = mountFab({
      positioning: "fixed",
      corner: "top-left",
      size: "lg",
      variant: "primary",
    });
    expect(m.root.getAttribute("data-positioning")).toBe("fixed");
    expect(m.root.getAttribute("data-corner")).toBe("top-left");
    expect(m.root.getAttribute("data-size")).toBe("lg");
    expect(m.root.getAttribute("data-variant")).toBe("primary");

    const plain = mountFab();
    expect(plain.root.getAttribute("data-positioning")).toBe("absolute");
    expect(plain.root.getAttribute("data-corner")).toBe("bottom-right");
    expect(plain.root.getAttribute("data-size")).toBe("md");
    expect(plain.root.getAttribute("data-variant")).toBe("glass");
  });

  it("resolves registry icons before falling back to the inline svg", () => {
    const m = mountFab({ icon: "ArrowDown" });
    // Lucide renders its own svg without this component's polyline.
    expect(m.button.querySelector(".hk-fab-icon svg")).not.toBeNull();
    expect(m.button.querySelector("svg polyline[points='6 9 12 15 18 9']")).toBeNull();
  });
});

describe("HkFab plain mode", () => {
  it("emits click for each main-button press and never toggles", () => {
    const m = mountFab({ ariaLabel: "act" });
    m.button.click();
    m.button.click();
    expect(m.clicks.length).toBe(2);
    expect(m.toggles).toEqual([]);
  });

  it("blocks emission while disabled", () => {
    const m = mountFab({ ariaLabel: "act", disabled: true });
    expect(m.button.disabled).toBe(true);
    m.button.click();
    expect(m.clicks).toEqual([]);
    expect(m.toggles).toEqual([]);
  });
});

describe("HkFab speed dial", () => {
  function mountDial() {
    const firstAction = vitest.fn();
    return {
      firstAction,
      ...mountFab({
        ariaLabel: "dial",
        actions: [
          { key: "a", label: "Alpha", icon: "Zap", onClick: firstAction },
          { key: "b", label: "Beta" },
        ],
      }),
    };
  }

  it("expands on first press, runs the action, then collapses", async () => {
    const d = mountDial();

    let minis = d.root.querySelectorAll<HTMLButtonElement>(".hk-fab-mini");
    expect(minis.length).toBe(2);
    expect(minis[0].getAttribute("aria-hidden")).toBe("true");

    d.button.click();
    await nextTick();
    expect(d.toggles).toEqual([true]);
    expect(d.root.getAttribute("data-expanded")).toBe("true");

    minis = d.root.querySelectorAll<HTMLButtonElement>(".hk-fab-mini");
    expect(minis[0].getAttribute("aria-hidden")).toBe("false");

    minis[0].click();
    expect(d.firstAction).toHaveBeenCalledTimes(1);
    await nextTick();
    expect(d.root.getAttribute("data-expanded")).toBeNull();
    expect(d.toggles).toEqual([true, false]);
  });

  it("collapses on an outside pointerdown", async () => {
    const d = mountDial();
    d.button.click();
    await nextTick();
    expect(d.root.getAttribute("data-expanded")).toBe("true");

    document.body.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true }),
    );
    await nextTick();
    expect(d.root.getAttribute("data-expanded")).toBeNull();
    expect(d.toggles).toEqual([true, false]);
  });

  it("collapses on Escape and swallows the key from ancestors", async () => {
    const d = mountDial();
    d.button.click();
    await nextTick();
    expect(d.root.getAttribute("data-expanded")).toBe("true");

    const bubbled: string[] = [];
    const ancestor = (e: Event) => bubbled.push((e as KeyboardEvent).key);
    document.addEventListener("keydown", ancestor);
    try {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await nextTick();
      // Swallowed during capture: neither the probe nor HkModal saw it.
      expect(bubbled).toEqual([]);
      expect(d.root.getAttribute("data-expanded")).toBeNull();
      expect(d.toggles).toEqual([true, false]);
    } finally {
      document.removeEventListener("keydown", ancestor);
    }
  });

  it("exposes open/close/toggle control methods", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const instance = ref<{ open(): void; close(): void; toggle(): void } | null>(null);
    const toggles: boolean[] = [];
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkFab, {
            ref: instance as never,
            ariaLabel: "ctrl",
            "onToggle": (open: boolean) => toggles.push(open),
            actions: [{ key: "a" }],
          });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await nextTick();

    const ctrl = instance.value;
    ctrl!.open();
    expect(toggles).toEqual([true]);
    ctrl!.open(); // idempotent
    expect(toggles).toEqual([true]);
    ctrl!.close();
    expect(toggles).toEqual([true, false]);
    ctrl!.toggle();
    expect(toggles).toEqual([true, false, true]);
    ctrl!.toggle();
    expect(toggles).toEqual([true, false, true, false]);
  });
});
