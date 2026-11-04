import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import HkScreenIdentifyCard, {
  type ScreenIdentifyPlacement,
} from "./HkScreenIdentifyCard";

type CardProps = {
  number: number | string;
  name?: string;
  secondsLeft?: number;
  placement?: ScreenIdentifyPlacement;
  label?: string;
};

/**
 * HkScreenIdentifyCard contract (ported from the chest card precedent,
 * user direction 2026-10-12):
 * - the number is the loud element; the name and countdown are corner
 *   badges;
 * - role="status" + an accessible label composed from the number and the
 *   optional name (the layer must announce, not just paint);
 * - the corner is a data attribute (CSS owns the geometry, including the
 *   RTL mirror);
 * - a countdown appears only while there are seconds left.
 */
const mounts: Array<() => void> = [];

function mountCard(props: CardProps) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(
    defineComponent({
      setup() {
        return () => h(HkScreenIdentifyCard, props);
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

afterEach(() => {
  while (mounts.length) mounts.pop()?.();
});

describe("HkScreenIdentifyCard", () => {
  it("renders the number, the optional name and the countdown", async () => {
    const container = mountCard({ number: 7, name: "Kiosk AB12", secondsLeft: 3 });
    await nextTick();
    const card = container.querySelector(".hk-screen-identify")!;
    expect(card.querySelector(".hk-screen-identify-num")?.textContent).toBe("7");
    expect(card.querySelector(".hk-screen-identify-name")?.textContent).toBe("Kiosk AB12");
    const count = card.querySelector(".hk-screen-identify-count");
    expect(count).not.toBeNull();
    // The rolling digit is hikari's own component, not a hand-rolled
    // odometer.
    expect(count!.querySelector(".hk-countdown-digit")).not.toBeNull();
  });

  it("omits the name badge when no name is given", async () => {
    const container = mountCard({ number: 2 });
    await nextTick();
    expect(container.querySelector(".hk-screen-identify-name")).toBeNull();
  });

  it("omits the countdown when there are no seconds left", async () => {
    const container = mountCard({ number: 2, secondsLeft: 0 });
    await nextTick();
    expect(container.querySelector(".hk-screen-identify-count")).toBeNull();
  });

  it("accepts a string number", async () => {
    const container = mountCard({ number: "A1" });
    await nextTick();
    expect(container.querySelector(".hk-screen-identify-num")?.textContent).toBe("A1");
  });

  it("announces itself with the composed label", async () => {
    const container = mountCard({ number: 3 });
    await nextTick();
    const card = container.querySelector<HTMLElement>(".hk-screen-identify")!;
    expect(card.getAttribute("role")).toBe("status");
    expect(card.getAttribute("aria-label")).toBe("Screen 3");
  });

  it("includes the screen name in the announcement", async () => {
    const container = mountCard({ number: 3, name: "AB12" });
    await nextTick();
    const card = container.querySelector<HTMLElement>(".hk-screen-identify")!;
    expect(card.getAttribute("aria-label")).toBe("Screen 3, AB12");
  });

  it("lets the caller override the announcement", async () => {
    const container = mountCard({ number: 3, label: "Third display" });
    await nextTick();
    const card = container.querySelector<HTMLElement>(".hk-screen-identify")!;
    expect(card.getAttribute("aria-label")).toBe("Third display");
  });

  it("carries the placement as a data attribute for every corner", async () => {
    for (const placement of ["bottom-left", "bottom-right", "top-left", "top-right"] as const) {
      const container = mountCard({ number: 1, placement });
      await nextTick();
      const card = container.querySelector<HTMLElement>(".hk-screen-identify")!;
      expect(card.getAttribute("data-placement")).toBe(placement);
    }
  });
});
