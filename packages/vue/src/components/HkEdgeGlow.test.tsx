// HkEdgeGlow — render contract + compiled-sheet contract.
//
// The component is the library's single edge-glow painter: HkScrollContainer
// mounts it for the selection hint and for the overflow glow, and a host may
// mount it directly (a clipped chart, a carousel, a fixed header edge). Both
// halves are pinned here because vitest stubs CSS: the runtime suite can only
// see the root/band DOM and the inline knobs, while a retuned band (thickness,
// gradient direction, feather mask, breathe timing) is invisible to it. The
// sheet is compiled exactly the way a consumer compiles it, so no declaration
// can hide behind nesting or a comment.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, reactive } from "vue";

import HkEdgeGlow from "./HkEdgeGlow";

const here = dirname(fileURLToPath(import.meta.url));

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

/** Mount a render function (not a fixed vnode) so reactive prop changes
 *  re-render — the edge list is dynamic in HkScrollContainer. */
function mount(render: () => ReturnType<typeof h>): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

const bands = (root: HTMLElement): string[] =>
  Array.from(root.querySelectorAll<HTMLElement>(".hk-edge-glow-band"), (b) =>
    b.getAttribute("data-edge") ?? "",
  );

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkEdgeGlow render contract", () => {
  it("mounts the inert clipping root with one band per default edge", () => {
    const c = mount(() => h(HkEdgeGlow));
    const root = c.querySelector<HTMLElement>(".hk-edge-glow");
    expect(root).not.toBeNull();
    // Decoration only: never announced, never a pointer target.
    expect(root!.getAttribute("aria-hidden")).toBe("true");
    expect(bands(root!)).toEqual(["top", "bottom"]);
    for (const band of root!.querySelectorAll(".hk-edge-glow-band")) {
      expect(band.tagName).toBe("SPAN");
    }
  });

  it("renders exactly the requested edges, in canonical order", () => {
    const c = mount(() => h(HkEdgeGlow, { edges: ["right", "top"] }));
    expect(bands(c.querySelector<HTMLElement>(".hk-edge-glow")!)).toEqual(["top", "right"]);
    // An empty list keeps the root (inert) and drops every band — a feature
    // that toggles a band keeps the same subtree instead of remounting.
    expect(bands(mount(() => h(HkEdgeGlow, { edges: [] })))).toEqual([]);
  });

  it("dedupes repeats and drops names outside the four physical edges", () => {
    // A JS consumer crosses the prop boundary unchecked; an unknown edge must
    // not render a band no sheet rule can style, and a repeat must not be a
    // duplicate key.
    const c = mount(() =>
      h(HkEdgeGlow, { edges: ["left", "left", "diagonal"] as never }),
    );
    expect(bands(c.querySelector<HTMLElement>(".hk-edge-glow")!)).toEqual(["left"]);
  });

  it("writes the size/feather/colour knobs onto the root as custom properties", () => {
    const plain = mount(() => h(HkEdgeGlow)).querySelector<HTMLElement>(".hk-edge-glow")!;
    expect(plain.style.getPropertyValue("--hk-edge-glow-size")).toBe("var(--space-24)");
    expect(plain.style.getPropertyValue("--hk-edge-glow-feather")).toBe("var(--space-24)");
    expect(plain.style.getPropertyValue("--hk-edge-glow-color")).toBe(
      "rgb(var(--color-primary) / 32%)",
    );

    const tuned = mount(() =>
      h(HkEdgeGlow, { size: "40px", feather: "12px", color: "rgb(1 2 3 / 50%)" }),
    ).querySelector<HTMLElement>(".hk-edge-glow")!;
    expect(tuned.style.getPropertyValue("--hk-edge-glow-size")).toBe("40px");
    expect(tuned.style.getPropertyValue("--hk-edge-glow-feather")).toBe("12px");
    expect(tuned.style.getPropertyValue("--hk-edge-glow-color")).toBe("rgb(1 2 3 / 50%)");
  });

  it("breathes only when animate is on (static is the selection hint's shape)", () => {
    const still = mount(() => h(HkEdgeGlow)).querySelector<HTMLElement>(".hk-edge-glow")!;
    expect(still.hasAttribute("data-animate")).toBe(false);
    const breathing = mount(() => h(HkEdgeGlow, { animate: true })).querySelector<HTMLElement>(
      ".hk-edge-glow",
    )!;
    expect(breathing.getAttribute("data-animate")).toBe("true");
  });

  it("re-renders the bands when the edge list changes at runtime", async () => {
    const props = reactive<{ edges: Array<"top" | "bottom" | "left" | "right"> }>({
      edges: ["top"],
    });
    const c = mount(() => h(HkEdgeGlow, { edges: props.edges }));
    const root = c.querySelector<HTMLElement>(".hk-edge-glow")!;
    expect(bands(root)).toEqual(["top"]);

    props.edges = ["bottom", "left", "right"];
    await nextTick();
    expect(bands(root)).toEqual(["bottom", "left", "right"]);
  });
});

// ── Compiled-sheet contract ─────────────────────────────────────────────
// Notes for the pins below: sass emits UNQUOTED attribute values
// ([data-edge=top]) and keeps the authored spacing inside functions, so the
// regexes allow either spelling.
const source = readFileSync(join(here, "HkEdgeGlow.scss"), "utf-8");
const css = compile(join(here, "HkEdgeGlow.scss"), { style: "expanded" }).css.replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

function ruleBody(selector: string): string | null {
  // sass emits UNQUOTED attribute values ([data-edge=top]); strip quotes on
  // both sides so a pin reads the way the sheet was authored.
  const unquoted = css.replace(/"/g, "");
  const escaped = selector.replace(/"/g, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = unquoted.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return match ? match[1]! : null;
}

/** The one feather-mask shape every band carries, on its perpendicular
 *  axis: transparent at both inline ends, opaque from the feather inset
 *  inward. */
function featherMask(axis: "to right" | "to bottom"): RegExp {
  return new RegExp(
    `mask-image:\\s*linear-gradient\\(\\s*${axis},\\s*transparent 0,\\s*#000 var\\(--hk-edge-glow-feather\\),\\s*#000 calc\\(100% - var\\(--hk-edge-glow-feather\\)\\),\\s*transparent 100%\\)`,
  );
}

/** Exactly one -webkit- and one standard feather mask per band (the
 *  polyfill's pair); any extra/ad-hoc mask declaration is drift. */
function expectFeatherMaskPair(body: string, axis: "to right" | "to bottom"): void {
  const webkit = body.match(/-webkit-mask-image:[^;]+/g) ?? [];
  expect(webkit, "exactly one -webkit-mask-image").toHaveLength(1);
  expect(webkit[0]).toMatch(featherMask(axis));
  // (?<!-) keeps -webkit-mask-image: from also counting here.
  const standard = body.match(/(?<!-)mask-image:[^;]+/g) ?? [];
  expect(standard, "exactly one mask-image").toHaveLength(1);
  expect(standard[0]).toMatch(featherMask(axis));
}

describe("HkEdgeGlow stylesheet contract", () => {
  it("roots the painter as an inert, clipped, absolutely-positioned layer", () => {
    const root = ruleBody(".hk-edge-glow");
    expect(root, "the root rule exists").not.toBeNull();
    expect(root).toContain("position: absolute");
    expect(root).toContain("inset: 0");
    expect(root).toContain("z-index: 2");
    expect(root).toContain("overflow: hidden");
    expect(root).toContain("pointer-events: none");
  });

  it("lays the top and bottom bands on the block edges with a horizontal feather", () => {
    const top = ruleBody('.hk-edge-glow-band[data-edge="top"]');
    expect(top, "top band rule exists").not.toBeNull();
    expect(top).toContain("inset-inline: 0");
    expect(top).toContain("top: 0");
    expect(top).toContain("height: var(--hk-edge-glow-size)");
    expect(top).toMatch(
      /background: linear-gradient\(to bottom, var\(--hk-edge-glow-color\), transparent\)/,
    );
    expectFeatherMaskPair(top!, "to right");

    const bottom = ruleBody('.hk-edge-glow-band[data-edge="bottom"]');
    expect(bottom, "bottom band rule exists").not.toBeNull();
    expect(bottom).toContain("bottom: 0");
    expect(bottom).toMatch(
      /background: linear-gradient\(to top, var\(--hk-edge-glow-color\), transparent\)/,
    );
    expectFeatherMaskPair(bottom!, "to right");
  });

  it("mirrors the left and right bands onto the inline edges with a vertical feather", () => {
    const left = ruleBody('.hk-edge-glow-band[data-edge="left"]');
    expect(left, "left band rule exists").not.toBeNull();
    expect(left).toContain("inset-block: 0");
    expect(left).toContain("left: 0");
    expect(left).toContain("width: var(--hk-edge-glow-size)");
    expect(left).toMatch(
      /background: linear-gradient\(to right, var\(--hk-edge-glow-color\), transparent\)/,
    );
    expectFeatherMaskPair(left!, "to bottom");

    const right = ruleBody('.hk-edge-glow-band[data-edge="right"]');
    expect(right, "right band rule exists").not.toBeNull();
    expect(right).toContain("right: 0");
    expect(right).toMatch(
      /background: linear-gradient\(to left, var\(--hk-edge-glow-color\), transparent\)/,
    );
    expectFeatherMaskPair(right!, "to bottom");
  });

  it("keeps the bands direction-neutral (physical edges, no RTL slot swap)", () => {
    // The component's contract is PHYSICAL edges: direction is resolved by
    // the consumer (HkScrollContainer maps its sensed inline sides from the
    // computed direction). A [dir]-keyed band rule here would double-apply a
    // swap on top of that mapping.
    expect(source).not.toContain("[dir=");
    expect(source).not.toMatch(/:dir\(/);
    expect(source).toContain("inset-inline: 0");
    expect(source).toContain("inset-block: 0");
  });

  it("breathes opacity on data-animate and drops the loop under reduced motion", () => {
    expect(css).toContain("@keyframes hk-edge-glow-breathe");
    // Opacity-only: a transform/scale breathe would move the band's masked
    // geometry; the keyframes must stay on the opacity channel.
    const keyframes = css.slice(css.indexOf("@keyframes hk-edge-glow-breathe"));
    const bodyStart = keyframes.indexOf("{");
    const firstClose = keyframes.indexOf("50%");
    const keyframeBody = keyframes.slice(bodyStart, firstClose);
    expect(keyframeBody).toContain("opacity: 0.62");
    expect(keyframes.slice(firstClose, keyframes.indexOf("}", firstClose))).toContain("opacity: 1");

    expect(ruleBody('.hk-edge-glow[data-animate="true"] .hk-edge-glow-band')).toMatch(
      /animation: hk-edge-glow-breathe 2\.6s ease-in-out infinite/,
    );
    // The reduced-motion override exists and kills the loop.
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(css);
    expect(reduced, "the reduced-motion guard exists").not.toBeNull();
    expect(reduced![1]).toContain("animation: none");
  });

  it("routes every mask through the shared polyfill mixin, never a raw pair", () => {
    expect(source.match(/@include mask-image\(/g) ?? []).toHaveLength(4);
    expect(source).not.toMatch(/^\s*-webkit-mask-image:/m);
  });
});
