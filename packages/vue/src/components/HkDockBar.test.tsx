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

  it("writes the gap prop to the shared --hk-dock-gap token", async () => {
    // One CSS length in, the foundation token out: every edge of this dock
    // (resting inset, content band, surface cap) then resolves the override
    // through the sheet's own chain, so a host never re-declares per-edge.
    const root = await mountDock({ gap: "1.5rem" });
    expect(root.style.getPropertyValue("--hk-dock-gap")).toBe("1.5rem");
    // An unset prop must not emit an empty declaration.
    const bare = await mountDock();
    expect(bare.getAttribute("style") ?? "").not.toContain("--hk-dock-gap");
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
// rule — or regressing its mapping (inset side / centering transform /
// content band) — turns the matching assertion red. The COMPILED
// declarations are pinned separately in HkDockBar.styles.test.ts.

const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkDockBar.scss"), "utf8");

/** Every SCSS rule body whose selector list mentions the anchor. */
function rulesFor(anchor: string): string {
  const re = new RegExp(`&\\[data-anchor="${anchor}"\\][^{]*\\{[^}]*\\}`, "g");
  return scss.match(re)?.join("\n") ?? "";
}

/** The private resolved gap one edge reads (declared once on the base). */
function gap(edge: string): string {
  return `var(--_hk-dock-gap-${edge})`;
}

/** The resting inset of an anchored edge: the gap plus its safe-area. */
function inset(edge: string): string {
  return `calc(${gap(edge)} + env(safe-area-inset-${edge}, 0px))`;
}

describe("HkDockBar anchor geometry contract", () => {
  it("declares the four resolved edge gaps on the base class", () => {
    const base = scss.match(/\.hk-dock-bar\s*\{[^}]*\}/)?.[0];
    expect(base, "base dock rule must exist").toBeTruthy();
    for (const edge of ["top", "right", "bottom", "left"]) {
      // One chain per edge, written ONCE: per-edge public names are read-time
      // fallbacks (a `:root` pre-declaration would freeze them against any
      // descendant override).
      expect(base).toContain(
        `--_hk-dock-gap-${edge}: var(--hk-dock-gap-${edge}, var(--hk-dock-inset, var(--hk-dock-gap, var(--space-16, 1rem))))`,
      );
    }
  });

  it.each(["page", "bottom"] as const)(
    "%s docks to the south edge, centered (the two spellings share geometry)",
    (anchor) => {
      const rules = rulesFor(anchor);
      expect(rules, `${anchor} rules must exist`).toBeTruthy();
      expect(rules).toContain("position: absolute");
      expect(rules).toContain("left: 50%");
      expect(rules).toContain(`bottom: ${inset("bottom")}`);
      expect(rules).toContain("transform: translateX(-50%)");
      expect(rules).toContain(`padding-block-start: ${gap("bottom")}`);
    },
  );

  it("top docks to the north edge, centered", () => {
    const rules = rulesFor("top");
    expect(rules, "top rules must exist").toBeTruthy();
    expect(rules).toContain("position: absolute");
    expect(rules).toContain("top: " + inset("top"));
    expect(rules).toContain("left: 50%");
    expect(rules).toContain("transform: translateX(-50%)");
    expect(rules).toContain(`padding-block-end: ${gap("top")}`);
    expect(rules).not.toContain(`bottom: ${inset("bottom")}`);
  });

  it.each(["left", "right"] as const)(
    "%s docks to the vertical edge midpoint, centered by translateY",
    (anchor) => {
      const rules = rulesFor(anchor);
      expect(rules, `${anchor} rules must exist`).toBeTruthy();
      expect(rules).toContain("position: absolute");
      expect(rules).toContain("top: 50%");
      expect(rules).toContain(`${anchor}: ${inset(anchor)}`);
      expect(rules).toContain(
        `padding-inline-${anchor === "left" ? "end" : "start"}: ${gap(anchor)}`,
      );
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
  )("%s docks into its corner with both insets and both bands", (anchor, side1, side2, align) => {
    const rules = rulesFor(anchor);
    expect(rules, `${anchor} rules must exist`).toBeTruthy();
    expect(rules).toContain("position: absolute");
    expect(rules).toContain(`${side1}: ${inset(side1)}`);
    expect(rules).toContain(`${side2}: ${inset(side2)}`);
    expect(rules).toContain(
      `padding-block-${side1 === "top" ? "end" : "start"}: ${gap(side1)}`,
    );
    expect(rules).toContain(
      `padding-inline-${side2 === "left" ? "end" : "start"}: ${gap(side2)}`,
    );
    expect(rules).toContain(`align-items: ${align}`);
  });

  it("page and plane stay semantically distinct: page floats, plane flows", () => {
    const page = rulesFor("page");
    const plane = rulesFor("plane");
    expect(page).toContain("position: absolute");
    expect(plane, "plane rule must exist").toBeTruthy();
    expect(plane).toContain("margin: 0 auto");
    expect(plane).toContain(`margin: 0 auto ${inset("bottom")}`);
    expect(plane).toContain(`padding-block-start: ${gap("bottom")}`);
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
    // The viewport cap reads the SAME edge gaps the anchoring rules read.
    expect(base).toContain(
      `max-width: var(--dock-max-width, calc(100vw - ${gap("left")} - ${gap("right")}))`,
    );
    expect(base).toContain("max-height: var(--dock-max-height, none)");
    expect(base).toContain("padding: var(--dock-padding");
  });

  it("caps vertical side docks viewport-aware by default", () => {
    const sideCap = scss.match(
      /\.hk-dock-bar\[data-anchor="left"\] \.hk-dock-bar-surface[^{]*\{[^}]*\}/,
    )?.[0];
    expect(sideCap, "side-anchor surface cap rule must exist").toBeTruthy();
    expect(sideCap).toContain(
      `max-height: var(--dock-max-height, calc(100dvh - ${gap("top")} - ${gap("bottom")}))`,
    );
    expect(sideCap).toContain("100dvh");
  });

  it("solid surface drops the backdrop blur in CSS, not just in data", () => {
    const solid = scss.match(
      /\.hk-dock-bar\[data-surface="solid"\] \.hk-dock-bar-surface\s*\{[^}]*\}/,
    )?.[0];
    expect(solid, "solid surface rule must exist").toBeTruthy();
    expect(solid).toContain("@include backdrop-filter(none)");
  });

  it("reads the legacy single inset only inside the edge chain", () => {
    // Wrapping-count guard: `--hk-dock-inset` may appear only as the second
    // link of the four edge chains. A rule reading it directly would bypass
    // the per-edge override and re-split the family into two mechanisms. The
    // header comment quotes the chain, so only declarations are counted.
    const code = scss.replace(/\/\*[\s\S]*?\*\//g, "");
    const direct = code.match(/var\(--hk-dock-inset(?!, var\(--hk-dock-gap)/g) ?? [];
    expect(direct).toHaveLength(0);
    const chains = code.match(/var\(--hk-dock-inset, var\(--hk-dock-gap, /g) ?? [];
    expect(chains).toHaveLength(4);
  });
});
