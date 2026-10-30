// Selection edge hint contract for HkScrollContainer (selectionHint).
//
// A list taller than its viewport hides its SELECTED row as soon as it
// scrolls out of the visible band; while the prop is on, the container
// senses whether any "selected" descendant (selectionSelector — by
// default the library's selection grammar: non-false aria-current,
// aria-selected="true", .is-active) lies fully outside the viewport's
// visible vertical band, and mirrors the verdict on the root as
// data-selection-beyond="top" | "bottom" | "both" | "none" so the
// shipped SCSS can paint a primary-color gradient at each offending
// edge. Sensing rides the container's own rAF-coalesced update pass
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
  vi.spyOn(el, "getClientRects").mockReturnValue((rendered ? [rect] : []) as unknown as DOMRectList);
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
    // Turning it off also clears the mirrored state — a stale hint
    // must not outlive the feature that wrote it.
    expect(m.root.hasAttribute("data-selection-beyond")).toBe(false);
  });
});

describe("HkScrollContainer selection edge hint style contract", () => {
  // The gradients live on the CONTAINER ROOT's pseudo-elements (the
  // root is the fixed non-scrolled box; viewport pseudos scroll away),
  // driven by data-selection-beyond. Pinned on the compiled sheet so a
  // silent deletion or retune of any half turns this red. Note sass
  // emits UNQUOTED attribute values ([data-selection-beyond=top]) and
  // selector groups as `a,\nb {` — the pins match the group-final
  // spelling, and the gradient assertions allow either slash spacing.
  const css = compile(join(here, "HkScrollContainer.scss"), { style: "expanded" }).css.replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

  function ruleBody(selector: string): string | null {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
    return m ? m[1]! : null;
  }

  /** Group-final selector for a painted edge: `[state]` pairs with
   *  "both" in one rule, and "both" is what precedes the brace. */
  function edgeRule(pseudo: "::before" | "::after"): string | null {
    return ruleBody(`.hk-scroll-container[data-selection-beyond=both]${pseudo}`);
  }

  const TOP_GRADIENT =
    /background:\s*linear-gradient\(to bottom, rgb\(var\(--color-primary\)\s*\/\s*32%\), transparent\)/;
  const BOTTOM_GRADIENT =
    /background:\s*linear-gradient\(to top, rgb\(var\(--color-primary\)\s*\/\s*32%\), transparent\)/;

  /** The symmetric inline feather stops: transparent at both ends of the
   *  band, opaque from each --hk-scroll-selection-hint-feather inset
   *  inward — the corners fall off naturally instead of cutting hard. */
  const FEATHER_MASK =
    /mask-image:\s*linear-gradient\(\s*to right,\s*transparent 0,\s*#000 var\(--hk-scroll-selection-hint-feather\),\s*#000 calc\(100% - var\(--hk-scroll-selection-hint-feather\)\),\s*transparent 100%\)/;

  /** Exactly one -webkit- and one standard feather mask per painter. */
  function expectFeatherMaskPair(body: string, label: string): void {
    const webkit = body.match(/-webkit-mask-image:[^;]+/g) ?? [];
    expect(webkit, `${label}: exactly one -webkit-mask-image`).toHaveLength(1);
    expect(webkit[0]).toMatch(FEATHER_MASK);
    // (?<!-) keeps -webkit-mask-image: from also counting here.
    const standard = body.match(/(?<!-)mask-image:[^;]+/g) ?? [];
    expect(standard, `${label}: exactly one mask-image`).toHaveLength(1);
    expect(standard[0]).toMatch(FEATHER_MASK);
  }

  it("declares the size and feather knobs on the root state rule, not the pseudos", () => {
    // Declared on the root rule so a consumer override ON the container
    // wins — a directly declared custom property beats any inherited
    // value, so an ancestor's cannot reach the painters, and a
    // declaration on the pseudo itself would kill the knob (the
    // --hk-scroll-fade-size contract shape).
    const root = ruleBody(".hk-scroll-container[data-selection-beyond]");
    expect(root, "root size rule exists").not.toBeNull();
    expect(root).toContain("--hk-scroll-selection-hint-size: var(--space-24)");
    expect(root).toContain("--hk-scroll-selection-hint-feather: var(--space-24)");
    for (const pseudo of ["::before", "::after"]) {
      const body = edgeRule(pseudo as "::before" | "::after");
      expect(body, `both${pseudo} exists`).not.toBeNull();
      expect(body).not.toContain("--hk-scroll-selection-hint-size:");
      expect(body).not.toContain("--hk-scroll-selection-hint-feather:");
    }
  });

  it("paints the top gradient for top and both, on ::before", () => {
    const body = edgeRule("::before");
    expect(body, "the top/both ::before rule exists").not.toBeNull();
    expect(body).toContain('content: ""');
    expect(body).toContain("position: absolute");
    expect(body).toContain("top: 0");
    expect(body).toContain("height: var(--hk-scroll-selection-hint-size)");
    expect(body).toContain("pointer-events: none");
    expect(body).toMatch(TOP_GRADIENT);
    // The inline ends feather (2026-10-30: the band's ends cut as hard
    // vertical edges) — exactly one -webkit-/standard mask pair.
    expectFeatherMaskPair(body!, "top painter");
    // The group's first half is the bare "top" state — the share both
    // halves rule (one rule, two selectors) is the contract.
    expect(css).toContain(".hk-scroll-container[data-selection-beyond=top]::before");
  });

  it("paints the bottom gradient for bottom and both, on ::after", () => {
    const body = edgeRule("::after");
    expect(body, "the bottom/both ::after rule exists").not.toBeNull();
    expect(body).toContain('content: ""');
    expect(body).toContain("bottom: 0");
    expect(body).toContain("height: var(--hk-scroll-selection-hint-size)");
    expect(body).toContain("pointer-events: none");
    expect(body).toMatch(BOTTOM_GRADIENT);
    expectFeatherMaskPair(body!, "bottom painter");
    expect(css).toContain(".hk-scroll-container[data-selection-beyond=bottom]::after");
  });

  it("paints nothing for the none state", () => {
    // Either spelling (quoted source, unquoted compiled) must be absent
    // — "none" is the hint's quiet state and must match no painter.
    expect(css).not.toContain("data-selection-beyond=none");
    expect(css).not.toContain('data-selection-beyond="none"');
  });

  it("self-check: the extractor sees a rule that exists (raw source)", () => {
    // Compiled-sheet pins above inspect specific rules; this anchor
    // fails if the file is renamed or the sheet stops compiling.
    const source = readFileSync(join(here, "HkScrollContainer.scss"), "utf8");
    expect(source).toContain('.hk-scroll-container[data-selection-beyond="top"]::before,');
    expect(source).toContain('.hk-scroll-container[data-selection-beyond="bottom"]::after,');
  });
});
