import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, ref, type App } from "vue";

import { HkInfiniteTail } from "./HkInfiniteTail";

type IOMock = {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  callback: IntersectionObserverCallback;
};

const apps: App[] = [];
const containers: HTMLElement[] = [];
let originalIO: (typeof globalThis)["IntersectionObserver"];
let originalRect: typeof HTMLElement.prototype.getBoundingClientRect;
let ioInstances: IOMock[] = [];

/** A capturing IntersectionObserver stub: records every instance so a
 * test can synthesize intersections against the real sentinel. */
class IntersectionObserverStub {
  constructor(callback: IntersectionObserverCallback) {
    const mock: IOMock = {
      observe: vi.fn(),
      disconnect: vi.fn(),
      callback,
    };
    ioInstances.push(mock);
    return (mock as unknown) as IntersectionObserverStub;
  }
  observe(): void {}
  disconnect(): void {}
}

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
  app.mount(container);
  apps.push(app);
  containers.push(container);
  return container;
}

function rect(top: number, height: number): DOMRect {
  return {
    x: 0, y: top, top, left: 0, right: 100, bottom: top + height,
    width: 100, height, toJSON: () => ({}),
  } as DOMRect;
}

beforeEach(() => {
  originalIO = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver as never;
  ioInstances = [];
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = IntersectionObserverStub;
  originalRect = HTMLElement.prototype.getBoundingClientRect;
});

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = originalIO;
  HTMLElement.prototype.getBoundingClientRect = originalRect;
});

describe("HkInfiniteTail", () => {
  it("loading renders the animated skeleton placeholders", () => {
    const c = mount(h(HkInfiniteTail, { state: "loading", skeletonCount: 4 }));
    const skeletons = c.querySelectorAll(".hk-skeleton");
    expect(skeletons.length).toBe(4);
    expect(c.querySelector('[role="status"]')).not.toBeNull();
  });

  it("end renders the reached-the-end note with the progress counter", () => {
    const c = mount(h(HkInfiniteTail, { state: "end", shown: 19, total: 19 }));
    expect(c.querySelector(".hk-load-more")!.getAttribute("data-state")).toBe("end");
    expect(c.querySelector(".hk-load-more-count")!.textContent).toBe("19 / 19");
    expect(c.textContent).toContain("You've reached the end");
  });

  it("idle + auto renders the invisible sentinel and observes it", async () => {
    const c = mount(h(HkInfiniteTail, { state: "idle" }));
    const sentinel = c.querySelector(".hk-infinite-tail-sentinel") as HTMLElement;
    expect(sentinel).not.toBeNull();
    // The ref watcher attaches the observer on the post-flush pass.
    await new Promise((r) => setTimeout(r, 10));
    expect(ioInstances.length).toBe(1);
    expect(ioInstances[0].observe).toHaveBeenCalledTimes(1);
  });

  it("every intersecting observer callback emits (pacing is the machine's)", async () => {
    const fired: number[] = [];
    mount(h(HkInfiniteTail, { state: "idle", onLoadMore: () => fired.push(1) }));
    await new Promise((r) => setTimeout(r, 10));
    const { callback } = ioInstances[0];
    const entry = { isIntersecting: true, target: {} } as unknown as IntersectionObserverEntry;
    callback([entry], (null as unknown) as IntersectionObserver);
    expect(fired.length).toBe(1);
    // A second intersection (geometry changed) emits again — the tail
    // never throttles; the state machine's busy guard paces the loop.
    callback([entry], (null as unknown) as IntersectionObserver);
    expect(fired.length).toBe(2);
  });

  it("loading does not emit and neither does end", () => {
    const fired: number[] = [];
    mount(h(HkInfiniteTail, { state: "loading", onLoadMore: () => fired.push(1) }));
    mount(h(HkInfiniteTail, { state: "end", onLoadMore: () => fired.push(1) }));
    expect(ioInstances.length).toBe(0); // neither state renders a sentinel
    expect(fired.length).toBe(0);
  });

  it("re-entering idle re-checks the rect and keeps filling (auto-fill)", async () => {
    const fired: number[] = [];
    // Sentinel sits inside the viewport → the rect check must fire.
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      if (this.classList.contains("hk-infinite-tail-sentinel")) return rect(200, 1);
      return originalRect.call(this);
    };
    // The transition the machine produces when a page lands while the
    // tail is still on screen: loading → idle on the SAME component
    // instance, with no observer event to carry it — the rect re-check
    // is what keeps the fill going.
    const state = ref<"loading" | "idle">("loading");
    const Host = defineComponent({
      setup() {
        return () => h(HkInfiniteTail, { state: state.value, onLoadMore: () => fired.push(1) });
      },
    });
    mount(h(Host));
    expect(fired.length).toBe(0);
    state.value = "idle";
    await new Promise((r) => setTimeout(r, 30));
    expect(fired.length).toBeGreaterThanOrEqual(1);
  });

  it("manual mode loading morphs the button instead of skeleton rows", () => {
    const c = mount(h(HkInfiniteTail, { state: "loading", auto: false }));
    // No skeleton placeholders in manual mode — the button morphs.
    expect(c.querySelectorAll(".hk-skeleton").length).toBe(0);
    const note = c.querySelector(".hk-load-more")!;
    expect(note.getAttribute("data-state")).toBe("loading");
    expect(c.querySelector("button.hk-btn")!.textContent).toContain("Loading");
  });

  it("manual mode renders the load-more button instead of the sentinel", () => {
    const fired: number[] = [];
    const c = mount(h(HkInfiniteTail, { state: "idle", auto: false, onLoadMore: () => fired.push(1) }));
    expect(c.querySelector(".hk-infinite-tail-sentinel")).toBeNull();
    const button = c.querySelector("button.hk-btn") as HTMLButtonElement;
    expect(button).not.toBeNull();
    button.click();
    expect(fired.length).toBe(1);
    expect(ioInstances.length).toBe(0);
  });
});
