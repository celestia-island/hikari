import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import HkPersistentToast from "./HkPersistentToast";
import { POPUP_Z_BANDS, usePopupManager } from "../runtime/usePopupManager";

/**
 * HkPersistentToast contract tests:
 * - inert default: a chip without a detail slot renders a plain span,
 *   engages no popup-manager entry and exposes no aria-expanded
 * - hover open/close: detail slot + chip mouseenter opens the rich card
 *   after the open delay (one tooltip-kind band entry, z stamped
 *   inline); chip mouseleave closes it after the grace; moving onto the
 *   card cancels the close (hover continuity is the whole point of the
 *   rich card — the host list must survive the trip across the gap)
 * - click pinning: a click pins the card against the grace timer until
 *   an outside pointerdown / Escape / another click closes it
 * - dismiss: the ✕ sibling button emits `dismiss` (never nested inside
 *   the chip button)
 * - the wrap carries the live-region semantics (role=status +
 *   aria-live=polite) so label changes announce
 *
 * House style: raw createApp mounts on a shared container list torn
 * down after each case; the popup-manager singleton is REAL state,
 * swept afterEach the way HkTooltip.test.tsx does.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

interface MountOptions {
  props?: Record<string, unknown>;
  detail?: string;
  onDismiss?: () => void;
}

function mount({ props = {}, detail, onDismiss }: MountOptions = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const host = defineComponent({
    setup() {
      return () =>
        h(
          HkPersistentToast,
          { ...props, onDismiss } as never,
          detail ? { detail: () => h("p", { class: "card-probe" }, detail) } : undefined,
        );
    },
  });
  const app = createApp(host);
  app.mount(container);
  mounts.push({ app, container });
  return { app, container };
}

const manager = usePopupManager();

function tooltipEntries() {
  return [...manager.registry.value.values()].filter((e) => e.kind === "tooltip");
}

function chip(c: HTMLElement): HTMLElement {
  return c.querySelector<HTMLElement>(".hk-persistent-toast")!;
}

function wrap(c: HTMLElement): HTMLElement {
  return c.querySelector<HTMLElement>(".hk-persistent-toast-wrap")!;
}

function card(): HTMLElement {
  return document.querySelector<HTMLElement>(".hk-persistent-toast-card")!;
}

/** real-timer settle: covers the open/close setTimeout + the rAF position pass */
async function settle() {
  await new Promise((r) => setTimeout(r, 20));
  await nextTick();
}

function fire(el: Element, type: string, Ctor: typeof MouseEvent = MouseEvent) {
  el.dispatchEvent(new Ctor(type, { bubbles: true }));
}

afterEach(() => {
  vi.useRealTimers();
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  for (const entry of [...manager.registry.value.values()]) {
    manager.unregister(entry.id);
  }
  document.querySelectorAll(".hk-persistent-toast-card").forEach((el) => el.remove());
});

describe("HkPersistentToast inert default", () => {
  it("renders label, tone class and live-region semantics as a plain span", () => {
    const { container } = mount({ props: { tone: "error", label: "Upstream fault" } });
    const c = chip(container);
    expect(c.tagName).toBe("SPAN");
    expect(c.classList.contains("hk-persistent-toast--error")).toBe(true);
    expect(c.textContent).toContain("Upstream fault");
    expect(wrap(container).getAttribute("role")).toBe("status");
    expect(wrap(container).getAttribute("aria-live")).toBe("polite");
    expect(c.getAttribute("aria-expanded")).toBeNull();
    expect(tooltipEntries().length).toBe(0);
    expect(document.querySelector(".hk-persistent-toast-card")).toBeNull();
  });

  it("renders the spinner for the loading tone", () => {
    const { container } = mount({ props: { tone: "loading", label: "Loading" } });
    expect(container.querySelector(".hk-persistent-toast__spinner")).not.toBeNull();
  });

  it("renders the ✕ sibling button only when dismissible", () => {
    const onDismiss = vi.fn();
    const { container } = mount({ props: { label: "x", dismissible: true }, onDismiss });
    const dismiss = container.querySelector<HTMLElement>(".hk-persistent-toast__dismiss")!;
    expect(dismiss).not.toBeNull();
    // The ✕ must never nest inside the chip (a button in a button is
    // invalid markup).
    expect(chip(container).contains(dismiss)).toBe(false);
    dismiss.click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders no ✕ when not dismissible", () => {
    const { container } = mount({ props: { label: "x" } });
    expect(container.querySelector(".hk-persistent-toast__dismiss")).toBeNull();
  });
});

describe("HkPersistentToast detail card", () => {
  it("opens on hover after the delay and closes after the grace", async () => {
    const { container } = mount({
      props: { label: "fault", openDelay: 0, closeGrace: 0, detailLabel: "Failing hosts" },
      detail: "vortex.wowsgame.cn",
    });
    fire(chip(container), "mouseenter");
    await settle();
    const c = card();
    expect(c).not.toBeNull();
    expect(c.textContent).toContain("vortex.wowsgame.cn");
    expect(chip(container).getAttribute("aria-expanded")).toBe("true");
    const entries = tooltipEntries();
    expect(entries.length).toBe(1);
    expect(entries[0]!.kind).toBe("tooltip");
    expect(c.style.zIndex).toBe(String(POPUP_Z_BANDS.tooltip));

    fire(chip(container), "mouseleave");
    await settle();
    expect(card()).toBeNull();
    expect(tooltipEntries().length).toBe(0);
  });

  it("delays the hover open by openDelay", async () => {
    const { container } = mount({
      props: { label: "fault", openDelay: 80, closeGrace: 0 },
      detail: "hosts",
    });
    fire(chip(container), "mouseenter");
    await nextTick();
    expect(card()).toBeNull();
    await new Promise((r) => setTimeout(r, 120));
    await nextTick();
    expect(card()).not.toBeNull();
  });

  it("keeps the card open while the pointer moves onto it", async () => {
    const { container } = mount({
      props: { label: "fault", openDelay: 0, closeGrace: 0 },
      detail: "hosts",
    });
    fire(chip(container), "mouseenter");
    await settle();
    // Chip → card crossing: the close grace must be cancelled by the
    // card's own mouseenter, or the host list dies mid-read.
    fire(chip(container), "mouseleave");
    fire(card(), "mouseenter");
    await settle();
    expect(card()).not.toBeNull();
    // Leaving the card closes (nothing pinned).
    fire(card(), "mouseleave");
    await settle();
    expect(card()).toBeNull();
  });

  it("pins on click: grace timer and chip leave cannot close it", async () => {
    const { container } = mount({
      props: { label: "fault", openDelay: 0, closeGrace: 0 },
      detail: "hosts",
    });
    fire(chip(container), "mouseenter");
    await settle();
    chip(container).click();
    fire(chip(container), "mouseleave");
    await settle();
    expect(card()).not.toBeNull();
    expect(chip(container).getAttribute("aria-expanded")).toBe("true");
  });

  it("an outside pointerdown closes a pinned card", async () => {
    const { container } = mount({
      props: { label: "fault", openDelay: 0, closeGrace: 0 },
      detail: "hosts",
    });
    chip(container).click();
    await settle();
    expect(card()).not.toBeNull();
    document.body.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true }),
    );
    await settle();
    expect(card()).toBeNull();
  });

  it("a click inside the card does not close a pinned card", async () => {
    const { container } = mount({
      props: { label: "fault", openDelay: 0, closeGrace: 0 },
      detail: "hosts",
    });
    chip(container).click();
    await settle();
    card().dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    await settle();
    expect(card()).not.toBeNull();
  });

  it("Escape closes a pinned card", async () => {
    const { container } = mount({
      props: { label: "fault", openDelay: 0, closeGrace: 0 },
      detail: "hosts",
    });
    chip(container).click();
    await settle();
    chip(container).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await settle();
    expect(card()).toBeNull();
  });

  it("a second click toggles a pinned card closed", async () => {
    const { container } = mount({
      props: { label: "fault", openDelay: 0, closeGrace: 0 },
      detail: "hosts",
    });
    chip(container).click();
    await settle();
    chip(container).click();
    await settle();
    expect(card()).toBeNull();
  });

  it("releases the band entry on unmount while open", async () => {
    const { app, container } = mount({
      props: { label: "fault", openDelay: 0, closeGrace: 0 },
      detail: "hosts",
    });
    fire(chip(container), "mouseenter");
    await settle();
    expect(tooltipEntries().length).toBe(1);
    app.unmount();
    expect(tooltipEntries().length).toBe(0);
  });
});
