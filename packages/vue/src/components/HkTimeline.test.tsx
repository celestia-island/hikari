import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkTimeline, { computeTimelineWindow } from "./HkTimeline";
import type { TimelineStep } from "./HkTimeline";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

interface TimelineHarness {
  container: HTMLElement;
  setCurrent: (key: string) => void;
}

function mountTimeline(
  props: Record<string, unknown> = {},
  steps: TimelineStep[] = [
    { key: "a", label: "Alpha" },
    { key: "b", label: "Beta" },
    { key: "c", label: "Gamma" },
    { key: "d", label: "Delta" },
    { key: "e", label: "Epsilon" },
  ],
): TimelineHarness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const current = ref((props.currentKey as string) ?? "a");
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkTimeline, {
          ...props,
          currentKey: current.value,
          steps,
        });
    },
  });

  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return { container, setCurrent: (key) => { current.value = key; } };
}

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
});

describe("computeTimelineWindow", () => {
  const steps = [
    { key: "a", label: "1" },
    { key: "b", label: "2" },
    { key: "c", label: "3" },
    { key: "d", label: "4" },
    { key: "e", label: "5" },
  ];

  it("shows both neighbours in the middle of the row", () => {
    expect(computeTimelineWindow(steps, "c")).toEqual({
      beforeIndex: 1,
      afterIndex: 3,
      fadeBefore: true,
      fadeAfter: true,
    });
  });

  it("leaves the left cell empty and unfaded on the first step", () => {
    expect(computeTimelineWindow(steps, "a")).toEqual({
      beforeIndex: -1,
      afterIndex: 1,
      fadeBefore: false,
      fadeAfter: true,
    });
  });

  it("leaves the right cell empty and unfaded on the last step", () => {
    expect(computeTimelineWindow(steps, "e")).toEqual({
      beforeIndex: 3,
      afterIndex: -1,
      fadeBefore: true,
      fadeAfter: false,
    });
  });

  it("does not fade a side when the neighbour is the true edge step", () => {
    // Four steps parked on the second: window is 1|2|3 — step 1 is the real
    // start (left unfaded), step 4 hides beyond step 3 (right fades).
    const four = steps.slice(0, 4);
    expect(computeTimelineWindow(four, "b")).toEqual({
      beforeIndex: 0,
      afterIndex: 2,
      fadeBefore: false,
      fadeAfter: true,
    });
  });
});

describe("HkTimeline full mode", () => {
  it("renders every step with statuses in a full row by default", () => {
    const t = mountTimeline({ currentKey: "c" });
    const root = t.container.querySelector(".hk-timeline");
    expect(root?.getAttribute("data-mode")).toBe("full");
    const els = t.container.querySelectorAll(".hk-timeline-step");
    expect(els.length).toBe(5);
    expect(els[0].getAttribute("data-status")).toBe("completed");
    expect(els[2].getAttribute("data-status")).toBe("active");
    expect(els[4].getAttribute("data-status")).toBe("pending");
    expect(els[4].hasAttribute("data-last")).toBe(true);
    expect(els[2].querySelector('[data-el="connector"]')).not.toBeNull();
  });

  it("stays full when collapse is never, even with many steps", () => {
    const t = mountTimeline({ currentKey: "c", collapse: "never" });
    expect(t.container.querySelector(".hk-timeline")?.getAttribute("data-mode")).toBe("full");
    expect(t.container.querySelectorAll(".hk-timeline-step").length).toBe(5);
  });

  it("never windows a three-step row", () => {
    const t = mountTimeline(
      { currentKey: "b", collapse: "always" },
      [
        { key: "a", label: "Alpha" },
        { key: "b", label: "Beta" },
        { key: "c", label: "Gamma" },
      ],
    );
    expect(t.container.querySelector(".hk-timeline")?.getAttribute("data-mode")).toBe("full");
  });

  it("marks exactly the active step with aria-current=step", () => {
    const t = mountTimeline({ currentKey: "c" });
    const els = t.container.querySelectorAll(".hk-timeline-step");
    expect(els[2].getAttribute("aria-current")).toBe("step");
    expect(els[1].getAttribute("aria-current")).toBeNull();
    expect(els[3].getAttribute("aria-current")).toBeNull();
  });

  it("keeps vertical orientation in full mode", () => {
    const t = mountTimeline({ currentKey: "b", orientation: "vertical", collapse: "always" });
    expect(t.container.querySelector(".hk-timeline")?.getAttribute("data-mode")).toBe("full");
  });
});

describe("HkTimeline window mode", () => {
  it("shows only the previous, current and next steps around the middle", () => {
    const t = mountTimeline({ currentKey: "c", collapse: "always" });
    const root = t.container.querySelector(".hk-timeline");
    expect(root?.getAttribute("data-mode")).toBe("window");

    const before = t.container.querySelector('.hk-timeline-window[data-side="before"]');
    const current = t.container.querySelector('.hk-timeline-window[data-side="current"]');
    const after = t.container.querySelector('.hk-timeline-window[data-side="after"]');

    // Stacked layout: the label lives UNDER the node in every cell, so each
    // cell still exposes exactly one step with indicator + label.
    expect(before?.querySelector('[data-el="label"]')?.textContent).toBe("Beta");
    expect(current?.querySelector('[data-el="label"]')?.textContent).toBe("Gamma");
    expect(after?.querySelector('[data-el="label"]')?.textContent).toBe("Delta");
    for (const cell of [before, current, after]) {
      expect(cell?.querySelectorAll(".hk-timeline-step").length).toBe(1);
      expect(cell?.querySelector('[data-el="indicator"]')).not.toBeNull();
    }

    // Steps 1 and 5 are hidden entirely.
    expect(t.container.textContent).not.toContain("Alpha");
    expect(t.container.textContent).not.toContain("Epsilon");

    // Both sides continue past the window, so continuation hints fill both
    // edges on the overlay.
    const fadeLinks = t.container.querySelectorAll(
      '.hk-timeline-links [data-segment^="edge-"]',
    );
    expect(fadeLinks.length).toBe(2);

    // Real ordinal numbers survive the collapse.
    expect(current?.querySelector('[data-el="num"]')?.textContent).toBe("3");
  });

  it("draws link segments joining neighbour nodes on an overlay, never inline", () => {
    const t = mountTimeline({ currentKey: "c", collapse: "always" });
    const links = t.container.querySelector(".hk-timeline-links");
    expect(links?.getAttribute("aria-hidden")).toBe("true");

    // prev→current bond takes the previous (completed) status colors; the
    // current→next bond keeps the pending look.
    expect(links?.querySelector('[data-segment="before-current"]')?.getAttribute("data-status")).toBe("completed");
    expect(links?.querySelector('[data-segment="current-after"]')?.getAttribute("data-status")).toBe("pending");

    // Continuation hints fill both fading edges with matching status.
    expect(links?.querySelector('[data-segment="edge-before"]')?.getAttribute("data-fade-dir")).toBe("left");
    expect(links?.querySelector('[data-segment="edge-after"]')?.getAttribute("data-fade-dir")).toBe("right");

    // No connector is rendered inline inside any stacked window step.
    expect(
      t.container.querySelectorAll('.hk-timeline-window [data-el="connector"]').length,
    ).toBe(0);
  });

  it("dims neighbour cells but never the current one", () => {
    const t = mountTimeline({ currentKey: "c", collapse: "always" });
    expect(
      t.container.querySelector('.hk-timeline-window[data-side="before"]')
        ?.hasAttribute("data-dimmed"),
    ).toBe(true);
    expect(
      t.container.querySelector('.hk-timeline-window[data-side="after"]')
        ?.hasAttribute("data-dimmed"),
    ).toBe(true);
    expect(
      t.container.querySelector('.hk-timeline-window[data-side="current"]')
        ?.hasAttribute("data-dimmed"),
    ).toBe(false);
  });

  it("omits continuation hints where no hidden steps continue past a side", async () => {
    // Parked on the second step: left edge is the real start (no hint), the
    // right side hides steps 4..5 (hint present).
    const t = mountTimeline({ currentKey: "b", collapse: "always" });
    const links = t.container.querySelector(".hk-timeline-links");
    expect(links?.querySelector('[data-segment="edge-before"]')).toBeNull();
    expect(links?.querySelector('[data-segment="edge-after"]')).not.toBeNull();
    // The before bond itself still exists — only its outer hint is absent.
    expect(links?.querySelector('[data-segment="before-current"]')).not.toBeNull();

    // On the first step the left edge draws neither a bond nor a hint.
    t.setCurrent("a");
    await nextTick();
    const linksAfter = t.container.querySelector(".hk-timeline-links");
    expect(linksAfter?.querySelector('[data-segment="before-current"]')).toBeNull();
    expect(linksAfter?.querySelector('[data-segment="edge-before"]')).toBeNull();
    // ...while the right side keeps its live segments toward Beta.
    expect(linksAfter?.querySelector('[data-segment="current-after"]')).not.toBeNull();
    expect(linksAfter?.querySelector('[data-segment="edge-after"]')).not.toBeNull();
  });

  it("marks the active window step with aria-current=step", () => {
    const t = mountTimeline({ currentKey: "c", collapse: "always" });
    const current = t.container.querySelector(
      '.hk-timeline-window[data-side="current"] .hk-timeline-step',
    );
    expect(current?.getAttribute("aria-current")).toBe("step");
    const neighbours = t.container.querySelectorAll(
      '.hk-timeline-window[data-dimmed] .hk-timeline-step',
    );
    expect(neighbours.length).toBe(2);
    for (const n of neighbours) expect(n.getAttribute("aria-current")).toBeNull();
  });

  it("empties the left cell on the first step and the right cell on the last", async () => {
    const t = mountTimeline({ currentKey: "a", collapse: "always" });
    const before = t.container.querySelector('.hk-timeline-window[data-side="before"]');
    expect(before?.querySelector(".hk-timeline-step")).toBeNull();
    // The empty edge draws neither a dimmed placeholder nor stray lines.
    expect(before?.hasAttribute("data-dimmed")).toBe(false);
    expect(
      t.container.querySelector('.hk-timeline-links [data-segment="before-current"]'),
    ).toBeNull();
    expect(
      t.container.querySelector('.hk-timeline-links [data-segment="edge-before"]'),
    ).toBeNull();
    expect(
      t.container.querySelector('.hk-timeline-window[data-side="after"] [data-el="label"]')
        ?.textContent,
    ).toBe("Beta");

    t.setCurrent("e");
    await nextTick();
    const after = t.container.querySelector('.hk-timeline-window[data-side="after"]');
    expect(after?.querySelector(".hk-timeline-step")).toBeNull();
    expect(after?.hasAttribute("data-dimmed")).toBe(false);
    expect(
      t.container.querySelector('.hk-timeline-links [data-segment="current-after"]'),
    ).toBeNull();
    expect(
      t.container.querySelector('.hk-timeline-links [data-segment="edge-after"]'),
    ).toBeNull();
    expect(
      t.container.querySelector('.hk-timeline-window[data-side="before"] [data-el="label"]')
        ?.textContent,
    ).toBe("Delta");
  });

  it("still emits select for a clickable completed neighbour in the window", () => {
    const selected: string[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const app = createApp({
      setup() {
        return () =>
          h(HkTimeline, {
            steps: [
              { key: "a", label: "Alpha" },
              { key: "b", label: "Beta" },
              { key: "c", label: "Gamma" },
              { key: "d", label: "Delta" },
            ],
            currentKey: "c",
            clickable: true,
            collapse: "always",
            onSelect: (key: string) => selected.push(key),
          });
      },
    });
    mounts.push(app);
    app.mount(container);

    const before = container.querySelector(
      '.hk-timeline-window[data-side="before"] .hk-timeline-step',
    ) as HTMLElement;
    expect(before?.getAttribute("data-status")).toBe("completed");
    before.dispatchEvent(new MouseEvent("click"));
    expect(selected).toEqual(["b"]);
  });
});
