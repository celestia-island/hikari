import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h } from "vue";

import { HkAuthCard } from "./HkAuthCard";

/** Injectable ResizeObserver: captures the callback so tests can fire
 *  content changes deterministically (happy-dom's own RO never fires —
 *  there is no layout engine). Same harness as useSizeMorph.test.ts. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  callback: () => void;
  observed: Element[] = [];
  disconnected = false;

  constructor(callback: () => void) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  disconnect(): void {
    this.disconnected = true;
  }
}

const originalRO = globalThis.ResizeObserver;

/** The prototype that actually defines `offsetHeight` in this DOM
 *  implementation, so the stub below is portable across environments. */
function offsetHeightOwner(): object {
  let proto = Object.getPrototypeOf(document.createElement("div")) as object | null;
  while (proto) {
    if (Object.getOwnPropertyDescriptor(proto, "offsetHeight")) return proto;
    proto = Object.getPrototypeOf(proto);
  }
  return HTMLElement.prototype;
}

const originalOffsetHeight = Object.getOwnPropertyDescriptor(
  offsetHeightOwner(),
  "offsetHeight",
);

/** Natural height every element reports for `offsetHeight` in tests. */
let naturalHeight = 0;

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

function cardOf(c: HTMLElement) {
  return c.querySelector<HTMLElement>(".s-auth-card")!;
}

function wrapperOf(c: HTMLElement) {
  return c.querySelector<HTMLElement>(".s-auth-card-height")!;
}

function fireTransitionEnd(el: HTMLElement, propertyName: string) {
  const event = new Event("transitionend", { bubbles: true });
  Object.defineProperty(event, "propertyName", { value: propertyName });
  el.dispatchEvent(event);
}

beforeEach(() => {
  FakeResizeObserver.instances = [];
  naturalHeight = 140;
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  Object.defineProperty(offsetHeightOwner(), "offsetHeight", {
    configurable: true,
    get: () => naturalHeight,
  });
});

afterEach(() => {
  globalThis.ResizeObserver = originalRO;
  if (originalOffsetHeight) {
    Object.defineProperty(offsetHeightOwner(), "offsetHeight", originalOffsetHeight);
  } else {
    delete (offsetHeightOwner() as { offsetHeight?: number }).offsetHeight;
  }
  vi.useRealTimers();
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkAuthCard", () => {
  it("renders title, subtitle and every slot inside the unchanged card shell", () => {
    const c = mount(
      h(HkAuthCard, { title: "Sign in", subtitle: "Welcome back" }, {
        default: () => h("input", { name: "probe-field" }),
        methods: () => h("div", { class: "probe-methods" }, "methods"),
        footer: () => h("div", { class: "probe-footer" }, "footer"),
      }),
    );
    // The measuring wrapper is present and the card is still `.s-auth-card`.
    const wrapper = wrapperOf(c);
    const card = cardOf(c);
    expect(wrapper).toBeTruthy();
    expect(card).toBeTruthy();
    expect(c.querySelector(".s-auth-title")?.textContent).toBe("Sign in");
    expect(c.querySelector(".s-auth-subtitle")?.textContent).toBe("Welcome back");
    expect(card.querySelector(".s-auth-form input[name='probe-field']")).toBeTruthy();
    expect(card.querySelector(".s-auth-methods .probe-methods")).toBeTruthy();
    expect(card.querySelector(".s-auth-footer .probe-footer")).toBeTruthy();
    // The wrapper is transparent to descendant styling: the header, form,
    // methods and footer blocks all remain children of `.s-auth-card`.
    expect(wrapper.querySelector(".s-auth-card")).toBe(card);
  });

  it("seeds the wrapper height from the card on mount without animating", () => {
    naturalHeight = 140;
    const c = mount(h(HkAuthCard, { title: "T" }));
    const wrapper = wrapperOf(c);
    expect(wrapper.style.height).toBe("140px");
    // Seeding must not animate: the measuring class is absent on first paint.
    expect(wrapper.classList.contains("s-auth-card--measuring")).toBe(false);
    // The observer watches the card element itself, not the wrapper.
    expect(FakeResizeObserver.instances).toHaveLength(1);
    expect(FakeResizeObserver.instances[0]!.observed).toEqual([cardOf(c)]);
  });

  it("animates growth through the measuring class and releases it on the backstop timer", () => {
    vi.useFakeTimers();
    naturalHeight = 140;
    const c = mount(h(HkAuthCard, { title: "T" }));
    const wrapper = wrapperOf(c);
    expect(wrapper.style.height).toBe("140px");

    naturalHeight = 240;
    FakeResizeObserver.instances[0]!.callback();
    expect(wrapper.style.height).toBe("240px");
    expect(wrapper.classList.contains("s-auth-card--measuring")).toBe(true);

    vi.advanceTimersByTime(449);
    expect(wrapper.classList.contains("s-auth-card--measuring")).toBe(true);
    vi.advanceTimersByTime(1);
    expect(wrapper.classList.contains("s-auth-card--measuring")).toBe(false);
  });

  it("releases the measuring class when the height transition finishes", () => {
    naturalHeight = 100;
    const c = mount(h(HkAuthCard, { title: "T" }));
    const wrapper = wrapperOf(c);

    naturalHeight = 180;
    FakeResizeObserver.instances[0]!.callback();
    expect(wrapper.classList.contains("s-auth-card--measuring")).toBe(true);

    // An unrelated property finishing its transition must not release.
    fireTransitionEnd(wrapper, "color");
    expect(wrapper.classList.contains("s-auth-card--measuring")).toBe(true);

    fireTransitionEnd(wrapper, "height");
    expect(wrapper.classList.contains("s-auth-card--measuring")).toBe(false);
  });

  it("ignores observer firings that move the height by less than a pixel", () => {
    naturalHeight = 140;
    const c = mount(h(HkAuthCard, { title: "T" }));
    const wrapper = wrapperOf(c);

    naturalHeight = 140.6;
    FakeResizeObserver.instances[0]!.callback();
    expect(wrapper.style.height).toBe("140px");
    expect(wrapper.classList.contains("s-auth-card--measuring")).toBe(false);
  });

  it("with smoothHeight=false renders the wrapper but installs no measuring", () => {
    naturalHeight = 140;
    const c = mount(h(HkAuthCard, { title: "T", smoothHeight: false }));
    const wrapper = wrapperOf(c);
    // The wrapper still exists (stable DOM shape for consumers) but is
    // completely unmanaged: no explicit height and no observer.
    expect(wrapper).toBeTruthy();
    expect(wrapper.style.height).toBe("");
    expect(FakeResizeObserver.instances).toHaveLength(0);
  });

  it("degrades to an unmanaged wrapper when ResizeObserver is unavailable", () => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = undefined;
    naturalHeight = 140;
    const c = mount(h(HkAuthCard, { title: "T" }));
    const wrapper = wrapperOf(c);
    expect(wrapper).toBeTruthy();
    expect(wrapper.style.height).toBe("");
    expect(wrapper.classList.contains("s-auth-card--measuring")).toBe(false);
  });

  it("disconnects the observer and clears the backstop on unmount", () => {
    vi.useFakeTimers();
    naturalHeight = 140;
    const c = mount(h(HkAuthCard, { title: "T" }));
    const ro = FakeResizeObserver.instances[0]!;

    naturalHeight = 200;
    ro.callback();
    expect(wrapperOf(c).classList.contains("s-auth-card--measuring")).toBe(true);

    // Pop the entry so the shared afterEach does not unmount it twice.
    const entry = mounts.pop()!;
    entry.app.unmount();
    expect(ro.disconnected).toBe(true);
    // Advancing past the backstop after unmount must be a silent no-op.
    expect(() => vi.advanceTimersByTime(500)).not.toThrow();
  });
});
