import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkSidebarRailToggle from "./HkSidebarRailToggle";

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
