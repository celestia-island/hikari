import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";

import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import { HkMasterDetail } from "./HkMasterDetail";
import * as barrel from "../index";
import { asIndexable } from "../utils/typing";

/**
 * HkMasterDetail — the standard two-pane roster+detail surface.
 *
 * Repo convention: raw createApp + container queries, no @vue/test-utils
 * (HkAdminShell.test.tsx / HkEmptyState.test.tsx). The width comes from the
 * SHARED `useBreakpoint` ref, so every mount seeds `window.innerWidth`
 * first — the component reads it at setup, exactly like the shells do.
 *
 * What is pinned here, and why each one would otherwise rot silently:
 * - both panes and the empty state (the whole point of the component);
 * - the split contract: `data-split`, the drawer/scrim pair, the custom
 *   `splitAt` and its boundary (>= is two-pane) — a hand-picked width in
 *   one test cannot see an off-by-one or a hardcoded 1100;
 * - the dismissal contract: the close affordance appears ONLY with a bound
 *   `onClose` (a declared emit is stripped from $attrs, so the detection is
 *   the component's own vnode props), and Escape answers on the drawer face
 *   only — plus the precedence rule (a nested control that consumed the key
 *   owns it);
 * - the scss contract (sticky gated on the two-pane mode, the head band,
 *   the fixed drawer + veil) — a class-name-only test cannot see the layout
 *   rules that make the pane usable.
 *
 * Each behaviour claim above is anchored to the mutation that proved it (the
 * PR body carries the full table with the red counts):
 * - the split is width-driven — forcing `narrow` false reds the whole
 *   single-column / drawer / resize group [MUT:split-always-wide];
 * - Escape answers the drawer face only — ungating that watcher reds
 *   "keeps Escape away from the two-pane layout" [MUT:escape-ungated];
 * - the close affordance keys off the BOUND listener — rendering it
 *   unconditionally reds the "only when a close listener is bound" case
 *   [MUT:close-always];
 * - a closed pane shows the empty state — dropping that branch reds both
 *   boxed-empty-state tests [MUT:empty-state-dropped];
 * - the barrel re-export is load-bearing — deleting the line reds the
 *   barrel pin [MUT:barrel-line-deleted];
 * - the compiled sheet carries the drawer edge — flipping `right: 0` to
 *   `left: 0` reds the stylesheet contract [MUT:drawer-edge-flipped].
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function setWidth(w: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: w,
  });
  window.dispatchEvent(new Event("resize"));
}

function mount(node: ReturnType<typeof h>): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  // Every test also states its own width at the top; this reset keeps the
  // value from leaking into the next FILE.
  setWidth(1280);
});

/** Functional icon stub — lucide icons are plain functions too. */
const StubIcon = defineComponent({
  name: "StubIcon",
  setup: () => () => h("i", { class: "stub-empty-icon" }),
});

const ROSTER = () => h("div", { class: "roster" }, "ROSTER");
const DETAIL = () => h("div", { class: "detail-payload" }, "DETAIL");

function pane(container: HTMLElement): HTMLElement {
  return container.querySelector(".hk-master-detail") as HTMLElement;
}

function detailPane(container: HTMLElement): HTMLElement | null {
  return container.querySelector(".hk-master-detail-detail");
}

function escapeOn(target: EventTarget = document) {
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", cancelable: true, bubbles: true }),
  );
}

describe("HkMasterDetail — two-pane layout", () => {
  it("renders the roster and the selected detail in the wide layout", () => {
    setWidth(1280);
    const c = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message" }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    const root = pane(c);
    expect(root.getAttribute("data-split")).toBe("two");
    expect(root.hasAttribute("data-open")).toBe(true);
    expect(c.querySelector(".hk-master-detail-list .roster")?.textContent).toBe("ROSTER");
    expect(
      c.querySelector(".hk-master-detail-detail .detail-payload")?.textContent,
    ).toBe("DETAIL");
    // Wide layout: no overlay layer of any kind.
    expect(c.querySelector(".hk-master-detail-drawer")).toBeNull();
    expect(c.querySelector(".hk-master-detail-scrim")).toBeNull();
    // …and no empty state beside a live selection.
    expect(c.querySelector(".hk-empty-state")).toBeNull();
  });

  it("renders the boxed empty state inside the detail card when nothing is selected", () => {
    setWidth(1280);
    const c = mount(
      h(HkMasterDetail, {
        detailOpen: false,
        detailTitle: "Message",
        emptyTitle: "Pick a message",
        emptyDescription: "Choose a row from the roster.",
        emptyIcon: StubIcon,
      }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    expect(pane(c).hasAttribute("data-open")).toBe(false);
    // Closed: the detail slot is not rendered at all — the empty state
    // stands in its place (not beside it).
    expect(c.querySelector(".detail-payload")).toBeNull();
    const empty = c.querySelector(".hk-master-detail-detail .hk-empty-state");
    expect(empty, "the empty state lives INSIDE the detail card").toBeTruthy();
    expect(empty!.className).toContain("hk-empty-state--boxed");
    expect(c.querySelector(".hk-empty-title")?.textContent).toBe("Pick a message");
    expect(c.querySelector(".hk-empty-desc")?.textContent).toBe("Choose a row from the roster.");
    expect(c.querySelector(".stub-empty-icon")).toBeTruthy();
    // The roster stays readable next to it.
    expect(c.querySelector(".hk-master-detail-list .roster")).toBeTruthy();
  });

  it("falls back to the localized empty title when none is given", () => {
    setWidth(1280);
    const c = mount(
      h(HkMasterDetail, { detailTitle: "Message" }, { list: ROSTER, detail: DETAIL }),
    );
    expect(c.querySelector(".hk-empty-title")?.textContent).toBe("Nothing selected");
  });

  it("writes the column tracks from the props (and the defaults)", () => {
    setWidth(1280);
    const defaults = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message" }, { list: ROSTER, detail: DETAIL }),
    );
    expect(pane(defaults).getAttribute("style")).toContain(
      "--hk-master-detail-list-w: minmax(360px, 1fr)",
    );
    expect(pane(defaults).getAttribute("style")).toContain(
      "--hk-master-detail-detail-w: minmax(0, 1.15fr)",
    );

    const custom = mount(
      h(
        HkMasterDetail,
        {
          detailOpen: true,
          detailTitle: "Message",
          listWidth: "20rem",
          detailWidth: "minmax(0, 2fr)",
        },
        { list: ROSTER, detail: DETAIL },
      ),
    );
    expect(pane(custom).getAttribute("style")).toContain("--hk-master-detail-list-w: 20rem");
    expect(pane(custom).getAttribute("style")).toContain(
      "--hk-master-detail-detail-w: minmax(0, 2fr)",
    );
  });

  it("marks the pane sticky by default and drops the marker on request", () => {
    setWidth(1280);
    const sticky = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message" }, { list: ROSTER, detail: DETAIL }),
    );
    expect(detailPane(sticky)?.hasAttribute("data-sticky")).toBe(true);

    const flowing = mount(
      h(
        HkMasterDetail,
        { detailOpen: true, detailTitle: "Message", sticky: false },
        { list: ROSTER, detail: DETAIL },
      ),
    );
    expect(detailPane(flowing)?.hasAttribute("data-sticky")).toBe(false);
  });

  it("names the detail region with detailTitle and shows no bare head band", () => {
    setWidth(1280);
    const c = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message" }, { list: ROSTER, detail: DETAIL }),
    );
    const detail = detailPane(c)!;
    expect(detail.getAttribute("role")).toBe("region");
    expect(detail.getAttribute("aria-label")).toBe("Message");
    // Wide layout with no actions and no close channel: no empty band,
    // because the region's NAME already carries the title (the drawer form
    // is the one that must SHOW it).
    expect(c.querySelector(".hk-master-detail-detail-head")).toBeNull();
  });

  it("renders the actions slot ahead of the close affordance", async () => {
    setWidth(1280);
    const c = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message", onClose: () => {} }, {
        list: ROSTER,
        detail: DETAIL,
        actions: () => h("button", { class: "detail-action" }, "Copy"),
      }),
    );
    const head = c.querySelector(".hk-master-detail-detail-head") as HTMLElement;
    expect(head).toBeTruthy();
    await nextTick();
    const children = Array.from(head.children) as HTMLElement[];
    const actionIndex = children.findIndex((el) =>
      el.classList.contains("hk-master-detail-detail-actions"),
    );
    const closeIndex = children.findIndex((el) =>
      el.classList.contains("hk-master-detail-close"),
    );
    expect(children[actionIndex].querySelector(".detail-action")?.textContent).toBe("Copy");
    expect(actionIndex, "actions sit before the close affordance").toBeLessThan(closeIndex);
  });
});

describe("HkMasterDetail — the split", () => {
  it("collapses to one column below splitAt with the detail as an overlay drawer", () => {
    setWidth(900);
    const c = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message" }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    const root = pane(c);
    expect(root.getAttribute("data-split")).toBe("single");
    expect(root.hasAttribute("data-open")).toBe(true);
    // The SAME detail element takes the drawer dress and the veil appears.
    const detail = detailPane(c)!;
    expect(detail.classList.contains("hk-master-detail-drawer")).toBe(true);
    expect(detail.getAttribute("aria-label")).toBe("Message");
    expect(c.querySelector(".hk-master-detail-scrim")).toBeTruthy();
    expect(c.querySelector(".hk-master-detail-drawer .detail-payload")).toBeTruthy();
    // Single column: the roster keeps the full width, nothing beside it.
    const list = c.querySelector(".hk-master-detail-list") as HTMLElement;
    expect(list).toBeTruthy();
  });

  it("renders no drawer and no veil while the narrow detail is closed", () => {
    setWidth(900);
    const c = mount(
      h(HkMasterDetail, { detailOpen: false, detailTitle: "Message" }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    expect(pane(c).getAttribute("data-split")).toBe("single");
    // An overlay holding an empty state would be a dead layer over the
    // roster — the narrow form simply shows the roster.
    expect(detailPane(c)).toBeNull();
    expect(c.querySelector(".hk-master-detail-scrim")).toBeNull();
    expect(c.querySelector(".hk-empty-state")).toBeNull();
    expect(c.querySelector(".hk-master-detail-list .roster")).toBeTruthy();
  });

  it("treats splitAt itself as the wide layout and splitAt-1 as the narrow one", () => {
    setWidth(800);
    const atSplit = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message", splitAt: 800 }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    expect(pane(atSplit).getAttribute("data-split")).toBe("two");

    setWidth(799);
    const below = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message", splitAt: 800 }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    expect(pane(below).getAttribute("data-split")).toBe("single");
  });

  it("honors a custom splitAt (the default would have split the same width)", () => {
    // Default 1100: 1000px is narrow. A host that sets 700 keeps the
    // two-pane layout there — a hardcoded 1100 fails this one.
    setWidth(1000);
    const custom = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message", splitAt: 700 }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    expect(pane(custom).getAttribute("data-split")).toBe("two");
  });

  it("follows a live resize in both directions", async () => {
    setWidth(1280);
    const c = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message" }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    expect(pane(c).getAttribute("data-split")).toBe("two");

    setWidth(600);
    await nextTick();
    expect(pane(c).getAttribute("data-split")).toBe("single");
    expect(c.querySelector(".hk-master-detail-drawer")).toBeTruthy();

    setWidth(1400);
    await nextTick();
    expect(pane(c).getAttribute("data-split")).toBe("two");
    expect(c.querySelector(".hk-master-detail-drawer")).toBeNull();
    expect(c.querySelector(".hk-master-detail-scrim")).toBeNull();
  });

  it("shows the drawer header title on the narrow face", () => {
    setWidth(600);
    const c = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message" }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    const head = c.querySelector(".hk-master-detail-detail-head") as HTMLElement;
    expect(head).toBeTruthy();
    expect(c.querySelector(".hk-master-detail-detail-title")?.textContent).toBe("Message");
  });
});

describe("HkMasterDetail — dismissal", () => {
  it("renders the close affordance only when a close listener is bound", () => {
    setWidth(600);
    const silent = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message" }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    // A declared emit is stripped from $attrs; an unbound host gets no
    // button it could not act on.
    expect(silent.querySelector(".hk-master-detail-close")).toBeNull();

    const bound = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message", onClose: () => {} }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    const close = bound.querySelector(".hk-master-detail-close") as HTMLElement;
    expect(close).toBeTruthy();
    expect(close.tagName).toBe("BUTTON");
    expect(close.getAttribute("aria-label")).toBe("Close");
    // One glyph, from the shared icon-button family.
    expect(close.querySelectorAll(".hk-icon-button-icon svg").length).toBe(1);
  });

  it("takes the close label from closeLabel", () => {
    setWidth(600);
    const c = mount(
      h(
        HkMasterDetail,
        {
          detailOpen: true,
          detailTitle: "Message",
          closeLabel: "Dismiss message",
          onClose: () => {},
        },
        { list: ROSTER, detail: DETAIL },
      ),
    );
    expect(
      c.querySelector(".hk-master-detail-close")?.getAttribute("aria-label"),
    ).toBe("Dismiss message");
  });

  it("emits close from the affordance, the veil and Escape (drawer face)", () => {
    setWidth(600);
    const onClose = vi.fn();
    const c = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message", onClose }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    (c.querySelector(".hk-master-detail-close") as HTMLElement).click();
    expect(onClose).toHaveBeenCalledTimes(1);

    (c.querySelector(".hk-master-detail-scrim") as HTMLElement).click();
    expect(onClose).toHaveBeenCalledTimes(2);

    escapeOn(document);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("keeps Escape away from the two-pane layout and from a closed drawer", async () => {
    setWidth(1280);
    const wideClose = vi.fn();
    mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message", onClose: wideClose }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    escapeOn(document);
    expect(wideClose, "the wide layout never swallows Escape").not.toHaveBeenCalled();

    setWidth(600);
    const narrowClose = vi.fn();
    mount(
      h(
        HkMasterDetail,
        { detailOpen: false, detailTitle: "Message", onClose: narrowClose },
        { list: ROSTER, detail: DETAIL },
      ),
    );
    escapeOn(document);
    expect(narrowClose, "nothing is open — no dismissal to answer").not.toHaveBeenCalled();
  });

  it("lets a nested control that consumed Escape own the key", () => {
    setWidth(600);
    const onClose = vi.fn();
    const c = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message", onClose }, {
        list: ROSTER,
        detail: () => h("input", { class: "detail-input" }),
      }),
    );
    const input = c.querySelector(".detail-input") as HTMLElement;
    // The nested control (an inline editor, a popup) already handled the
    // key: our listener must not close the pane underneath it.
    input.addEventListener("keydown", (e) => e.preventDefault());
    escapeOn(input);
    expect(onClose).not.toHaveBeenCalled();

    // …and a plain Escape still closes.
    escapeOn(document);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("detaches its Escape listener on unmount", () => {
    setWidth(600);
    const onClose = vi.fn();
    const c = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message", onClose }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    escapeOn(document);
    expect(onClose).toHaveBeenCalledTimes(1);
    const entry = mounts.shift()!;
    entry.app.unmount();
    entry.container.remove();
    escapeOn(document);
    expect(onClose, "an unmounted pane holds no document listener").toHaveBeenCalledTimes(1);
  });
});

describe("HkMasterDetail — stylesheet contract", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  // COMPILED, not authored: the pins below must see what the consumer's
  // bundler gets — through `@use "polyfill"`, the nesting, the `@supports`
  // wrap and sass's own selector normalisation (HkPaneHolder.test.tsx's
  // sass-compile precedent).
  const css = compile(join(here, "HkMasterDetail.scss")).css.replace(/\r\n/g, "\n");

  /** One flat rule body by selector — the compiler flattens nesting, so a
   *  `&::-webkit-scrollbar` child arrives as its own rule. */
  function ruleBody(source: string, selector: string): string {
    // Anchored to a line start, which keeps the root selector distinct from
    // the `-detail` family while the file's FIRST rule still resolves.
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const start = source.search(new RegExp(`(?:^|\\n)${escaped} \\{`));
    expect(start, `${selector} present`).toBeGreaterThanOrEqual(0);
    const open = source.indexOf("{", start);
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) return source.slice(open + 1, i);
      }
    }
    throw new Error(`unbalanced block for ${selector}`);
  }

  it("keeps the grid and its family gutter on the root", () => {
    const root = ruleBody(css, ".hk-master-detail");
    expect(root).toContain("display: grid");
    expect(root).toContain("gap: var(--space-12");
    expect(root).toContain("grid-template-columns:");
    // The single-column mode overrides the tracks.
    expect(ruleBody(css, ".hk-master-detail[data-split=single]")).toContain(
      "grid-template-columns: minmax(0, 1fr)",
    );
  });

  it("gives the detail pane HkCard's chrome without painting the native bar", () => {
    const detail = ruleBody(css, ".hk-master-detail-detail");
    for (const declaration of [
      "border: 1px solid var(--border-subtle)",
      "border-radius: var(--radius-lg",
      "box-shadow: var(--shadow-elevated)",
      // The rail host: the overlay tracks are absolute children of the
      // pane, so the pane itself has to stay a non-scroller.
      "position: relative",
    ]) {
      expect(detail).toContain(declaration);
    }
    // No hardcoded colour: every surface layer reads a channel triplet.
    expect(detail).toContain("rgb(var(--color-surface)");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);

    // The scroll REGION keeps native mechanics and hides the native bar
    // (the shared overlay rail is the only chrome that may paint). The
    // suppression pair is asserted FLAT — that is how it ships.
    const scroll = ruleBody(css, ".hk-master-detail-detail-scroll");
    expect(scroll).toContain("overflow: auto");
    expect(scroll).toContain("scrollbar-width: none");
    expect(ruleBody(css, ".hk-master-detail-detail-scroll::-webkit-scrollbar")).toContain(
      "display: none",
    );
  });

  it("applies sticky ONLY in the two-pane mode, and keeps the head band pinned", () => {
    const sticky = ruleBody(
      css,
      ".hk-master-detail[data-split=two] .hk-master-detail-detail[data-sticky]",
    );
    expect(sticky).toContain("position: sticky");
    expect(sticky).toContain("top: var(--hk-master-detail-sticky-top, 0px)");
    expect(sticky).toContain("max-height:");
    const head = ruleBody(css, ".hk-master-detail-detail-head");
    expect(head).toContain("position: sticky");
    expect(head).toContain("top: 0");
  });

  it("lifts the drawer to the right edge above the roster, under a veil", () => {
    const drawer = ruleBody(css, ".hk-master-detail-drawer");
    expect(drawer).toContain("position: fixed");
    expect(drawer).toContain("right: 0");
    expect(drawer).toContain("bottom: 0");
    expect(drawer).toContain("z-index: var(--hk-z-sidebar");
    // The enter motion is a physical slide from the right edge — the
    // keyframe is the only place that direction is written down.
    expect(drawer).toContain("animation: hk-master-detail-drawer-in");
    expect(css).toContain("transform: translateX(100%)");
    // The rounded side is the one it slides against: the physical-right
    // edge square, the left corners rounded. Both halves are pinned — a
    // flip of either one alone must red this case.
    expect(drawer).toContain(
      "border-radius: var(--radius-lg, 12px) 0 0 var(--radius-lg, 12px)",
    );
    const scrim = ruleBody(css, ".hk-master-detail-scrim");
    expect(scrim).toContain("position: fixed");
    expect(scrim).toContain("z-index: var(--hk-z-sidebar");
    // The veil rides the drawer family's token instead of a new colour.
    expect(scrim).toContain("var(--hk-drawer-overlay-bg");
    // Reduced motion + the host's animation switch both clamp the slide.
    expect(css).toContain('html[data-css-animations="0"] .hk-master-detail-drawer');
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});

describe("the public barrel", () => {
  it("exports HkMasterDetail (deleting the export line keeps every other test green)", () => {
    const component = asIndexable(barrel.HkMasterDetail);
    expect(component, "HkMasterDetail must be re-exported").toBeTruthy();
    expect(component.name).toBe("HkMasterDetail");
  });
});