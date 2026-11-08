// Selection edge hint contract for HkScrollContainer (selectionHint).
//
// A list taller than its viewport hides its SELECTED row as soon as it
// scrolls out of the visible band; while the prop is on, the container
// senses whether any "selected" descendant (selectionSelector — by
// default the library's selection grammar: non-false aria-current,
// aria-selected="true", .is-active) lies fully outside the viewport's
// visible vertical band, and mirrors the verdict on the root as
// data-selection-beyond="top" | "bottom" | "both" | "none". The gradient
// itself is the shared <HkEdgeGlow> painter (2026-11-08): the container
// mounts it on the offending edge(s), and the pair of ::before/::after
// painters this sheet used to carry is retired — the same painter now
// serves the overflow glow too. The data-selection-beyond attribute
// remains the documented consumer contract. Sensing rides the container's
// own rAF-coalesced update pass
// (scroll / resize / refresh()), plus a viewport MutationObserver for
// the mutations that move a selection without scrolling anything (the
// .is-active class hopping between rows).
//
// happy-dom performs no layout (every rect is zeros), so the band
// geometry is stubbed per element — getClientRects alongside
// getBoundingClientRect, because the rendered-check (`length === 0`)
// must be controllable independently of the band test: happy-dom
// reports one rect even for display:none elements, so the hidden-row
// case stubs an empty list explicitly.
//
// House style: raw createApp mounts on shared containers (no
// @vue/test-utils); the SCSS half is pinned on the COMPILED sheet so a
// declaration cannot hide behind nesting or a comment.
//
// AI-generated: developed with the ZCode agent (model GLM-5.3); human-directed.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, reactive, ref } from "vue";

import HkScrollContainer from "./HkScrollContainer";
import { fakeAs } from "../test-utils/fakes";

const here = dirname(fileURLToPath(import.meta.url));

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

interface Mounted {
  container: HTMLElement;
  root: HTMLElement;
  viewport: HTMLElement;
  instance: { refresh: () => void } | null;
}

/** Mount a HkScrollContainer with `children` as its default slot and
 *  capture the exposed handle (refresh) through a wrapper ref. */
function mountHint(props: Record<string, unknown>, children: unknown = null): Mounted {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const instance = ref<Mounted["instance"] | null>(null);
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkScrollContainer, { ref: instance as never, ...props }, {
          default: () => children,
        });
    },
  });

  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);

  const root = container.querySelector<HTMLElement>(".hk-scroll-container")!;
  const viewport = root.querySelector<HTMLElement>(".hk-scroll-container-viewport")!;
  if (!root || !viewport) throw new Error("HkScrollContainer did not render its shell");
  return { container, root, viewport, instance: instance.value };
}

/** Stub an element's drawn vertical band (happy-dom has no layout) plus
 *  its rendered-ness: `rendered: false` reports the empty client-rect
 *  list a display:none element produces in a real engine. */
function stubBand(el: HTMLElement, top: number, bottom: number, rendered = true) {
  const rect = {
    x: 0, y: top, top, bottom, left: 0, right: 100, width: 100, height: bottom - top,
  } as DOMRect;
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue(rect);
  const band = rendered ? [rect] : [];
  vi.spyOn(el, "getClientRects").mockReturnValue(
    fakeAs<DOMRectList>(Object.assign(band, { item: (i: number) => band[i] ?? null })),
  );
}

/** The viewport's visible band for these tests: drawn pixels 0..400. */
function stubViewportBand(m: Mounted) {
  stubBand(m.viewport, 0, 400);
}

/** Flush the mutation-delivery microtask plus the rAF-scheduled
 *  sensing pass (scheduleFrame runs one rAF; two awaited frames match
 *  the sibling suites' helper). */
async function flushSensing(): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 0));
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
}

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
});

describe("HkScrollContainer selection edge hint", () => {
  it("reports top when the only selection is fully above the band", () => {
    const m = mountHint({ selectionHint: true }, h("div", { class: "is-active" }, "row"));
    stubViewportBand(m);
    stubBand(m.viewport.querySelector(".is-active")!, -120, -60);
    m.instance?.refresh();
    expect(m.root.getAttribute("data-selection-beyond")).toBe("top");
  });

  it("reports bottom when the only selection is fully below the band", () => {
    const m = mountHint(
      { selectionHint: true },
      h("button", { "aria-current": "true" }, "row"),
    );
    stubViewportBand(m);
    stubBand(m.viewport.querySelector('[aria-current="true"]')!, 500, 560);
    m.instance?.refresh();
    expect(m.root.getAttribute("data-selection-beyond")).toBe("bottom");
  });

  it("reports both when selections sit on both sides of the band", () => {
    const m = mountHint({ selectionHint: true }, [
      h("div", { class: "is-active", key: "a" }, "above"),
      h("div", { class: "is-active", key: "b" }, "below"),
    ]);
    stubViewportBand(m);
    const rows = m.viewport.querySelectorAll<HTMLElement>(".is-active");
    stubBand(rows[0]!, -100, -40);
    stubBand(rows[1]!, 480, 520);
    m.instance?.refresh();
    expect(m.root.getAttribute("data-selection-beyond")).toBe("both");
  });

  it("reports none while the selection is inside the band", () => {
    const m = mountHint({ selectionHint: true }, h("div", { class: "is-active" }, "row"));
    stubViewportBand(m);
    stubBand(m.viewport.querySelector(".is-active")!, 120, 160);
    m.instance?.refresh();
    expect(m.root.getAttribute("data-selection-beyond")).toBe("none");
  });

  it("reports none when nothing matches — and aria-current=\"false\" never counts", () => {
    // aria-current="false" is the explicit "not current" spelling; the
    // default selector's :not() half must keep it out of the match set.
    const m = mountHint(
      { selectionHint: true },
      h("button", { "aria-current": "false" }, "row"),
    );
    stubViewportBand(m);
    stubBand(m.viewport.querySelector("button")!, 500, 560);
    m.instance?.refresh();
    expect(m.root.getAttribute("data-selection-beyond")).toBe("none");
  });

  it("skips a display:none selected row (unrendered matches cannot light the hint)", () => {
    const m = mountHint({ selectionHint: true }, h("div", { class: "is-active" }, "hidden"));
    stubViewportBand(m);
    // Drawn below the band BUT not rendered: the rendered-check wins.
    stubBand(m.viewport.querySelector(".is-active")!, 500, 560, false);
    m.instance?.refresh();
    expect(m.root.getAttribute("data-selection-beyond")).toBe("none");
  });

  it("re-senses when the .is-active class hops onto a below-band row (MutationObserver)", async () => {
    const row = h("div", { class: "plain" }, "row");
    const m = mountHint({ selectionHint: true }, row);
    stubViewportBand(m);
    const el = m.viewport.querySelector<HTMLElement>(".plain")!;
    stubBand(el, 500, 560);
    m.instance?.refresh();
    expect(m.root.getAttribute("data-selection-beyond")).toBe("none");

    el.classList.add("is-active");
    await flushSensing();
    expect(m.root.getAttribute("data-selection-beyond")).toBe("bottom");
  });

  it("honors a custom selectionSelector", () => {
    const m = mountHint(
      { selectionHint: true, selectionSelector: ".my-pick" },
      [
        h("div", { class: "is-active", key: "a" }, "inside-band"),
        h("div", { class: "my-pick", key: "b" }, "below-band"),
      ],
    );
    stubViewportBand(m);
    const rows = m.viewport.querySelectorAll<HTMLElement>("div");
    stubBand(rows[0]!, 120, 160); // .is-active inside the band
    stubBand(rows[1]!, 500, 560); // .my-pick below it
    m.instance?.refresh();
    // The custom grammar replaced the default: only .my-pick counted —
    // with the default selector this pass would read "none".
    expect(m.root.getAttribute("data-selection-beyond")).toBe("bottom");
  });

  it("never mirrors the attribute while the prop is off", () => {
    const m = mountHint({}, h("div", { class: "is-active" }, "row"));
    stubViewportBand(m);
    stubBand(m.viewport.querySelector(".is-active")!, 500, 560);
    m.instance?.refresh();
    expect(m.root.hasAttribute("data-selection-beyond")).toBe(false);
  });

  it("attaches, re-senses, and detaches at runtime with the prop", async () => {
    const props = reactive<Record<string, unknown>>({ selectionHint: false });
    const m = mountHint(props, h("div", { class: "is-active" }, "row"));
    stubViewportBand(m);
    stubBand(m.viewport.querySelector(".is-active")!, 500, 560);
    m.instance?.refresh();
    expect(m.root.hasAttribute("data-selection-beyond")).toBe(false);

    props.selectionHint = true;
    await nextTick();
    await flushSensing();
    // Turning the hint on with a selection already beyond the band
    // must not wait for a scroll — the prop watcher re-senses.
    expect(m.root.getAttribute("data-selection-beyond")).toBe("bottom");

    props.selectionHint = false;
    await nextTick();
    // Turning it off also clears the mirrored state AND unmounts the
    // painter — a stale hint must not outlive the feature that wrote it.
    expect(m.root.hasAttribute("data-selection-beyond")).toBe(false);
    expect(m.root.querySelector(".hk-edge-glow")).toBeNull();
  });
});

describe("HkScrollContainer selection edge hint style contract", () => {
  // Since 2026-11-08 the band is painted by the shared <HkEdgeGlow>
  // component, not by pseudo-elements in this sheet (the same painter the
  // overflow glow mounts). The sheet half therefore pins the HANDOFF: the
  // root still declares the two consumer override knobs, and no pseudo
  // painter may come back (a stale pseudo would double-paint over the
  // mounted band). The runtime half below pins that the container actually
  // mounts the painter with the right edge and static mode.
  //
  // Note sass emits UNQUOTED attribute values
  // ([data-selection-beyond=top]); the rule lookup strips quotes on both
  // sides so a pin reads the way the sheet was authored.
  const css = compile(join(here, "HkScrollContainer.scss"), { style: "expanded" }).css.replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

  function ruleBody(selector: string): string | null {
    const unquoted = css.replace(/"/g, "");
    const escaped = selector.replace(/"/g, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = unquoted.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
    return m ? m[1]! : null;
  }

  it("keeps the size and feather knobs declared on the root state rule", () => {
    // Declared on the root rule so a consumer override ON the container
    // wins — a directly declared custom property beats any inherited
    // value, so an ancestor's cannot reach the painter. The component
    // passes these two inherited knobs through as the shared painter's
    // size/feather (HkEdgeGlow's inline vars resolve against them), which
    // keeps the override shape the settings rail documented.
    const root = ruleBody(".hk-scroll-container[data-selection-beyond]");
    expect(root, "root size rule exists").not.toBeNull();
    expect(root).toContain("--hk-scroll-selection-hint-size: var(--space-24)");
    expect(root).toContain("--hk-scroll-selection-hint-feather: var(--space-24)");
  });

  it("retires the pseudo-element painters (the band is the shared component)", () => {
    // A stale ::before/::after painter would double-paint the band now that
    // the container mounts <HkEdgeGlow> on the same edge. The compiled
    // sheet must match no pseudo painter at all, and the raw source must
    // not regain one.
    expect(css).not.toMatch(/\[data-selection-beyond[^{]*::(?:before|after)/);
    const source = readFileSync(join(here, "HkScrollContainer.scss"), "utf8");
    // Scoped to the state attribute: the sheet legitimately owns OTHER
    // pseudo-elements (the dock-tail spacer is a viewport ::after).
    expect(source).not.toMatch(/\[data-selection-beyond[^\n]*::(?:before|after)/);
  });

  it("matches no band for the none state", () => {
    // "none" is the hint's quiet state: no painter rule may key on it (and
    // the component passes an empty edge list).
    expect(css).not.toContain("data-selection-beyond=none");
    expect(css).not.toContain('data-selection-beyond="none"');
  });

  it("mounts the shared painter on the offending edge", async () => {
    const m = mountHint({ selectionHint: true }, h("div", { class: "is-active" }, "row"));
    stubViewportBand(m);
    stubBand(m.viewport.querySelector(".is-active")!, 500, 560);
    m.instance?.refresh();
    expect(m.root.getAttribute("data-selection-beyond")).toBe("bottom");
    // The attribute is written imperatively; the PAINTER is JSX, so its
    // bands land with the scheduled component re-render.
    await nextTick();
    const glow = m.root.querySelector<HTMLElement>(".hk-edge-glow");
    expect(glow, "the shared painter is mounted").not.toBeNull();
    expect(glow!.getAttribute("aria-hidden")).toBe("true");
    expect(
      Array.from(m.root.querySelectorAll<HTMLElement>(".hk-edge-glow-band"), (b) =>
        b.getAttribute("data-edge"),
      ),
    ).toEqual(["bottom"]);
  });

  it("feeds the painter the documented knobs and keeps it static", async () => {
    // Knobs: the container passes the two override vars through, so a
    // consumer's tuned size/feather reaches the painter. Static: a state
    // hint must not breathe — the overflow glow is the animated consumer.
    const m = mountHint({ selectionHint: true }, h("div", { class: "is-active" }, "row"));
    stubViewportBand(m);
    stubBand(m.viewport.querySelector(".is-active")!, -120, -60);
    m.instance?.refresh();
    await nextTick();
    const glow = m.root.querySelector<HTMLElement>(".hk-edge-glow")!;
    expect(glow.style.getPropertyValue("--hk-edge-glow-size")).toBe(
      "var(--hk-scroll-selection-hint-size)",
    );
    expect(glow.style.getPropertyValue("--hk-edge-glow-feather")).toBe(
      "var(--hk-scroll-selection-hint-feather)",
    );
    expect(glow.hasAttribute("data-animate")).toBe(false);
    expect(
      Array.from(m.root.querySelectorAll<HTMLElement>(".hk-edge-glow-band"), (b) =>
        b.getAttribute("data-edge"),
      ),
    ).toEqual(["top"]);
  });

  it("drops the band when the verdict returns to none, keeping the inert root", async () => {
    const m = mountHint({ selectionHint: true }, h("div", { class: "is-active" }, "row"));
    stubViewportBand(m);
    const row = m.viewport.querySelector<HTMLElement>(".is-active")!;
    stubBand(row, 500, 560);
    m.instance?.refresh();
    await nextTick();
    expect(m.root.querySelectorAll(".hk-edge-glow-band")).toHaveLength(1);

    // Selection comes back into the band: the band list empties while the
    // painter's inert root stays mounted (the feature is still on).
    stubBand(row, 120, 160);
    m.instance?.refresh();
    await nextTick();
    expect(m.root.querySelectorAll(".hk-edge-glow-band")).toHaveLength(0);
    expect(m.root.querySelector(".hk-edge-glow")).not.toBeNull();
  });

  it("self-check: the extractor sees a rule that exists (raw source)", () => {
    // Compiled-sheet pins above inspect specific rules; this anchor fails
    // if the file is renamed or the sheet stops compiling.
    expect(ruleBody(".hk-scroll-container[data-selection-beyond]")).not.toBeNull();
  });
});
