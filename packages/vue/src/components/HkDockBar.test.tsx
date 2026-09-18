import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, defineComponent, h, nextTick } from "vue";

import HkDockBar from "./HkDockBar";

const apps: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  document.body.innerHTML = "";
});

async function flush() {
  await nextTick();
  await nextTick();
}

/** Mount a dock with the given props and return its root section. */
async function mountDock(props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const Host = defineComponent({
    setup() {
      return () =>
        h(HkDockBar, props, { default: () => h("button", { class: "probe" }, "go") });
    },
  });
  const app = createApp(Host);
  apps.push(app);
  app.mount(container);
  await flush();
  return container.querySelector<HTMLElement>(".hk-dock-bar")!;
}

describe("HkDockBar", () => {
  it("renders slot content inside the surface", async () => {
    const root = await mountDock();
    const probe = root.querySelector<HTMLElement>(".probe");
    expect(probe?.textContent).toBe("go");
    expect(root.querySelector(".hk-dock-bar-surface")).toBeTruthy();
  });

  it("defaults to the page anchor with a glass surface", async () => {
    const root = await mountDock();
    expect(root.dataset.anchor).toBe("page");
    expect(root.dataset.surface).toBe("glass");
  });

  it.each(
    [
      "plane",
      "top",
      "bottom",
      "left",
      "right",
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
    ] as const,
  )("accepts the %s anchor", async (anchor) => {
    const root = await mountDock({ anchor });
    expect(root.dataset.anchor).toBe(anchor);
  });

  it("exposes style hooks for width, max-width, max-height and padding", async () => {
    const root = await mountDock({
      width: "22rem",
      maxWidth: "30rem",
      maxHeight: "60vh",
      padding: "4px 6px",
    });
    const style = root.style;
    expect(style.getPropertyValue("--dock-width")).toBe("22rem");
    expect(style.getPropertyValue("--dock-max-width")).toBe("30rem");
    expect(style.getPropertyValue("--dock-max-height")).toBe("60vh");
    expect(style.getPropertyValue("--dock-padding")).toBe("4px 6px");
  });

  it("drops the blur on the solid surface", async () => {
    const root = await mountDock({ surface: "solid" });
    expect(root.dataset.surface).toBe("solid");
  });
});

// ── Anchor geometry contract ──────────────────────────────────────────────
// SCSS source contract (house pattern, cf. HkButton icon-only contract):
// happy-dom does not lay out, so each compass direction's geometry is
// pinned textually against HkDockBar.scss. Dropping any one direction's
// rule — or regressing its mapping (inset side / centering transform) —
// turns the matching assertion red.

const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkDockBar.scss"), "utf8");

/** Every SCSS rule body whose selector list mentions the anchor. */
function rulesFor(anchor: string): string {
  const re = new RegExp(`&\\[data-anchor="${anchor}"\\][^{]*\\{[^}]*\\}`, "g");
  return scss.match(re)?.join("\n") ?? "";
}

describe("HkDockBar anchor geometry contract", () => {
  const INSET = "var(--hk-dock-inset, 12px)";

  it.each(["page", "bottom"] as const)(
    "%s docks to the south edge, centered (the two spellings share geometry)",
    (anchor) => {
      const rules = rulesFor(anchor);
      expect(rules, `${anchor} rules must exist`).toBeTruthy();
      expect(rules).toContain("position: absolute");
      expect(rules).toContain("left: 50%");
      expect(rules).toContain(`bottom: ${INSET}`);
      expect(rules).toContain("transform: translateX(-50%)");
    },
  );

  it("top docks to the north edge, centered", () => {
    const rules = rulesFor("top");
    expect(rules, "top rules must exist").toBeTruthy();
    expect(rules).toContain("position: absolute");
    expect(rules).toContain("top: " + INSET);
    expect(rules).toContain("left: 50%");
    expect(rules).toContain("transform: translateX(-50%)");
    expect(rules).not.toContain(`bottom: ${INSET}`);
  });

  it.each(["left", "right"] as const)(
    "%s docks to the vertical edge midpoint, centered by translateY",
    (anchor) => {
      const rules = rulesFor(anchor);
      expect(rules, `${anchor} rules must exist`).toBeTruthy();
      expect(rules).toContain("position: absolute");
      expect(rules).toContain("top: 50%");
      expect(rules).toContain(`${anchor}: ${INSET}`);
      expect(rules).toContain("transform: translateY(-50%)");
      // A side dock must not pick up the horizontal-edge centering.
      expect(rules).not.toContain("transform: translateX(-50%)");
    },
  );

  it.each(
    [
      ["top-left", "top", "left", "flex-start"],
      ["top-right", "top", "right", "flex-end"],
      ["bottom-left", "bottom", "left", "flex-start"],
      ["bottom-right", "bottom", "right", "flex-end"],
    ] as const,
  )("%s docks into its corner with both insets", (anchor, side1, side2, align) => {
    const rules = rulesFor(anchor);
    expect(rules, `${anchor} rules must exist`).toBeTruthy();
    expect(rules).toContain("position: absolute");
    expect(rules).toContain(`${side1}: ${INSET}`);
    expect(rules).toContain(`${side2}: ${INSET}`);
    expect(rules).toContain(`align-items: ${align}`);
  });

  it("page and plane stay semantically distinct: page floats, plane flows", () => {
    const page = rulesFor("page");
    const plane = rulesFor("plane");
    expect(page).toContain("position: absolute");
    expect(plane, "plane rule must exist").toBeTruthy();
    expect(plane).toContain("margin: 0 auto");
    expect(plane).not.toContain("position: absolute");
  });

  it("consumes the size custom properties on every anchor via the base surface rule", () => {
    // The anchor-agnostic base surface rule is the ONLY SCSS consumer of
    // the size props for page/top/bottom/plane/corner docks — only the
    // vertical side anchors get the viewport-aware cap override below.
    // The style-hook tests above pin that the custom properties are set;
    // this pins that the base rule still consumes them, so maxWidth /
    // maxHeight cannot silently stop working off-side.
    const base = scss.match(/\.hk-dock-bar-surface\s*\{[^}]*\}/)?.[0];
    expect(base, "base surface rule must exist").toBeTruthy();
    expect(base).toContain("width: var(--dock-width, auto)");
    expect(base).toContain("max-width: var(--dock-max-width");
    expect(base).toContain("max-height: var(--dock-max-height, none)");
    expect(base).toContain("padding: var(--dock-padding");
  });

  it("caps vertical side docks viewport-aware by default", () => {
    const sideCap = scss.match(
      /\.hk-dock-bar\[data-anchor="left"\] \.hk-dock-bar-surface[^{]*\{[^}]*\}/,
    )?.[0];
    expect(sideCap, "side-anchor surface cap rule must exist").toBeTruthy();
    expect(sideCap).toContain("max-height: var(--dock-max-height");
    expect(sideCap).toContain("100dvh");
  });

  it("solid surface drops the backdrop blur in CSS, not just in data", () => {
    const solid = scss.match(
      /\.hk-dock-bar\[data-surface="solid"\] \.hk-dock-bar-surface\s*\{[^}]*\}/,
    )?.[0];
    expect(solid, "solid surface rule must exist").toBeTruthy();
    expect(solid).toContain("backdrop-filter: none");
  });
});
