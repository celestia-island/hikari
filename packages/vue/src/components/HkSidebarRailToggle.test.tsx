import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkSidebarRailToggle, {
  RAIL_TOGGLE_SUPPRESS_PAD,
  isPointerOverRailToggle,
} from "./HkSidebarRailToggle";

/**
 * The rail toggle's control contract: a real button, carrying
 * aria-expanded and a localized accessible name that flips with state,
 * emitting toggle on click, and swapping the SHAFT-LESS chevron pair's
 * direction between states (›‹ expanded / ‹› collapsed — the icon
 * decision is documented on the component).
 *
 * The reveal-on-hover/focus geometry is CSS (HkSidebarRail.scss) and is
 * pinned by HkSidebarRail.styles.test.ts, not here.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountToggle(props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkSidebarRailToggle, props) });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

function buttonOf(c: HTMLElement): HTMLButtonElement {
  const btn = c.querySelector(".hk-sidebar-rail-toggle button");
  expect(btn, "the toggle renders a real button").toBeTruthy();
  return btn as HTMLButtonElement;
}

describe("HkSidebarRailToggle", () => {
  it("renders inside the reveal wrapper, defaulting to expanded", () => {
    const c = mountToggle();
    const wrap = c.querySelector(".hk-sidebar-rail-toggle");
    expect(wrap, "the positioning/reveal wrapper exists").toBeTruthy();
    expect(wrap!.getAttribute("data-expanded")).toBe("true");
  });

  it("carries aria-expanded and a localized name for BOTH states", () => {
    const expanded = buttonOf(mountToggle({ expanded: true }));
    expect(expanded.getAttribute("aria-expanded")).toBe("true");
    // en bundle value — the label comes from hikari::sidebar.*.
    expect(expanded.getAttribute("aria-label")).toBe("Collapse sidebar");

    const collapsed = buttonOf(mountToggle({ expanded: false }));
    expect(collapsed.getAttribute("aria-expanded")).toBe("false");
    expect(collapsed.getAttribute("aria-label")).toBe("Expand sidebar");
  });

  it("emits toggle on click (keyboard operable — it is a real button)", async () => {
    const clicks: number[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(HkSidebarRailToggle, { expanded: false, onToggle: () => clicks.push(1) }),
    });
    app.mount(container);
    mounts.push({ app, container });

    buttonOf(container).click();
    expect(clicks, "a click emits toggle").toHaveLength(1);
  });

  it("swaps the chevron pair's direction with state (no shafts)", () => {
    const firstPath = (c: HTMLElement) =>
      (c.querySelector(".hk-sidebar-rail-toggle button svg path") as SVGPathElement | null)
        ?.getAttribute("d") ?? "";

    // Expanded: ChevronsRightLeft (›‹ — converge/squeeze in).
    expect(firstPath(mountToggle({ expanded: true })).startsWith("m20")).toBe(true);
    // Collapsed: ChevronsLeftRight (‹› — diverge/let back out).
    expect(firstPath(mountToggle({ expanded: false })).startsWith("m9")).toBe(true);

    // Shaft-less glyphs: neither lucide arrow icon ever carries a long
    // horizontal rail — pin that the pair is chevrons by length: each
    // chevron path is a 3-segment open angle, far shorter than the
    // arrow's M5 19l9-9-9-9-style long tail... assert instead on the
    // ICON QUANTITY: a chevron pair renders exactly two paths.
    const svg = mountToggle({ expanded: true }).querySelector(
      ".hk-sidebar-rail-toggle button svg",
    )!;
    expect(svg.querySelectorAll("path")).toHaveLength(2);
  });
});
describe("isPointerOverRailToggle — the suppression geometry", () => {
  function stub(container: HTMLElement) {
    const el = container.querySelector(".hk-sidebar-rail-toggle") as HTMLElement;
    el.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 200,
        right: 124,
        bottom: 224,
        width: 24,
        height: 24,
        x: 100,
        y: 200,
        toJSON: () => ({}),
      }) as DOMRect;
    return el;
  }

  it("uses the circle's BOX, not event.target (the pre-reveal pointer-events problem)", () => {
    const c = mountToggle();
    stub(c);
    expect(isPointerOverRailToggle(c, 112, 212), "dead center").toBe(true);
    expect(isPointerOverRailToggle(c, 101, 201), "just inside a corner").toBe(true);
    expect(isPointerOverRailToggle(c, 60, 212), "far to the inline-start side").toBe(false);
    expect(isPointerOverRailToggle(c, 112, 300), "far below").toBe(false);
  });

  it("keeps a small pad so a resting pointer does not fall off the box", () => {
    const c = mountToggle();
    stub(c);
    expect(RAIL_TOGGLE_SUPPRESS_PAD).toBe(2);
    // Within the pad: still suppressed (the panel's width transition nudges
    // the rect by a pixel or two under a resting pointer).
    expect(isPointerOverRailToggle(c, 100 - RAIL_TOGGLE_SUPPRESS_PAD, 212)).toBe(true);
    expect(isPointerOverRailToggle(c, 124 + RAIL_TOGGLE_SUPPRESS_PAD, 212)).toBe(true);
    // Beyond it: a real move off the control.
    expect(isPointerOverRailToggle(c, 100 - RAIL_TOGGLE_SUPPRESS_PAD - 1, 212)).toBe(false);
    expect(isPointerOverRailToggle(c, 124 + RAIL_TOGGLE_SUPPRESS_PAD + 1, 212)).toBe(false);
  });

  it("returns false when the host or the toggle is missing (the plain path)", () => {
    expect(isPointerOverRailToggle(null, 10, 10)).toBe(false);
    expect(isPointerOverRailToggle(undefined, 10, 10)).toBe(false);
    const empty = document.createElement("div");
    expect(isPointerOverRailToggle(empty, 10, 10)).toBe(false);
  });
});
