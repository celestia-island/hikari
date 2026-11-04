import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import HkScreenIdentifyHost from "./HkScreenIdentifyHost";
import type { ScreenIdentifyPlacement } from "./HkScreenIdentifyCard";

type HostProps = { placement?: ScreenIdentifyPlacement; label?: string };
import {
  dismissScreenIdentify,
  showScreenIdentify,
} from "../runtime/useScreenIdentify";

/**
 * HkScreenIdentifyHost is the glue the 2026-11-05 defect needed:
 * the card must live in the ambient HUD root (above every popup, the
 * modal backdrop included) and follow the shared context's dwell.
 *
 * The assertions deliberately include the STRUCTURAL half of the fix:
 * the card is a descendant of #hk-hud-root and NOT of #hk-overlay-root,
 * because that is what makes it out-paint a modal — a purely cosmetic
 * "it renders" check would have passed before the fix too.
 */
const mounts: Array<() => void> = [];

function mountHost(props: HostProps = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(
    defineComponent({
      setup() {
        return () => h(HkScreenIdentifyHost, props);
      },
    }),
  );
  app.mount(container);
  mounts.push(() => {
    app.unmount();
    container.remove();
  });
  return container;
}

beforeEach(() => {
  dismissScreenIdentify();
});

afterEach(() => {
  while (mounts.length) mounts.pop()?.();
  dismissScreenIdentify();
  vi.useRealTimers();
});

describe("HkScreenIdentifyHost", () => {
  it("renders nothing while the context is idle", async () => {
    mountHost();
    await nextTick();
    expect(document.querySelector(".hk-screen-identify")).toBeNull();
  });

  it("paints the card inside the ambient HUD root, not the popup root", async () => {
    mountHost();
    await nextTick();
    showScreenIdentify({ number: 4, name: "Kiosk", durationMs: 3000 });
    await nextTick();

    const card = document.querySelector<HTMLElement>(".hk-screen-identify");
    expect(card).not.toBeNull();
    // The structural fix: above the whole popup tree.
    expect(card!.closest("#hk-hud-root")).not.toBeNull();
    expect(card!.closest("#hk-overlay-root")).toBeNull();
    expect(document.querySelectorAll("#hk-hud-root .hk-screen-identify")).toHaveLength(1);
  });

  it("prints the context payload and the rolling countdown", async () => {
    vi.useFakeTimers();
    mountHost();
    await nextTick();
    showScreenIdentify({ number: 2, name: "AB12" });
    await nextTick();
    const card = document.querySelector<HTMLElement>(".hk-screen-identify")!;
    expect(card.querySelector(".hk-screen-identify-num")?.textContent).toBe("2");
    expect(card.querySelector(".hk-screen-identify-name")?.textContent).toBe("AB12");
    expect(card.querySelector(".hk-screen-identify-count")).not.toBeNull();

    vi.advanceTimersByTime(1000);
    await nextTick();
    // The countdown badge keeps rendering while the dwell ticks.
    expect(document.querySelector(".hk-screen-identify-count")).not.toBeNull();
  });

  it("removes the card when the context dismisses", async () => {
    mountHost();
    await nextTick();
    showScreenIdentify({ number: 1 });
    await nextTick();
    expect(document.querySelector(".hk-screen-identify")).not.toBeNull();
    dismissScreenIdentify();
    await nextTick();
    expect(document.querySelector(".hk-screen-identify")).toBeNull();
  });

  it("forwards the placement and the accessible label", async () => {
    mountHost({ placement: "top-right", label: "Third display" });
    await nextTick();
    showScreenIdentify({ number: 3, durationMs: 1000 });
    await nextTick();
    const card = document.querySelector<HTMLElement>(".hk-screen-identify")!;
    expect(card.getAttribute("data-placement")).toBe("top-right");
    expect(card.getAttribute("aria-label")).toBe("Third display");
  });
});
