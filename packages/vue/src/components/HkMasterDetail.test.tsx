import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";

import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import { HkMasterDetail, resolveListWidth } from "./HkMasterDetail";
import * as barrel from "../index";
import { asIndexable } from "../utils/typing";

/**
 * HkMasterDetail — the standard two-pane roster+detail console.
 *
 * Repo convention: raw createApp + container queries, no @vue/test-utils
 * (HkAdminShell.test.tsx / HkEmptyState.test.tsx). The width comes from
 * the SHARED `useBreakpoint` ref, so every mount seeds `window.innerWidth`
 * first — the component reads it at setup, exactly like the shells do.
 * The narrow form renders through HkModal, which teleports — those
 * assertions query the DOCUMENT, not the mount container (HkModal's own
 * suite is the precedent).
 *
 * What is pinned here, and why each one would otherwise rot silently:
 * - both panes and the empty state (the whole point of the component);
 * - THE 2026-11-23 DIRECTION: the detail is a flush layout region — the
 *   stylesheet must NOT paint card chrome (border/radius/shadow) on it,
 *   and the root must be the full-height flex row (a reverted
 *   floating-card pane reds the stylesheet group);
 * - the split contract: `data-split`, the narrow HkModal form, the custom
 *   `splitAt` and its boundary (>= is two-pane) — a hand-picked width in
 *   one test cannot see an off-by-one or a hardcoded 768;
 * - the dismissal contract: the close affordance appears ONLY with a
 *   bound `onClose` (a declared emit is stripped from $attrs, so the
 *   detection is the component's own vnode props); the narrow form
 *   forwards the MODAL's close as the pane's `close` emit;
 * - the scss contract (the flush column, the separator hairline, the
 *   scroll region's native-bar suppression) — a class-name-only test
 *   cannot see the layout rules that make the pane usable.
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
  // Teleported modal layers do not live in the mount containers — sweep
  // the document so a later narrow test cannot match a stale sheet.
  for (const layer of Array.from(document.querySelectorAll(".hk-modal-root"))) {
    layer.remove();
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
    // Wide layout: no teleported window of any kind.
    expect(document.querySelector(".hk-modal-root")).toBeNull();
    // …and no empty state beside a live selection.
    expect(c.querySelector(".hk-empty-state")).toBeNull();
  });

  it("renders the boxed empty state inside the detail region when nothing is selected", () => {
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
    expect(empty, "the empty state lives INSIDE the detail region").toBeTruthy();
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

  it("writes the roster track from the prop (and the default)", () => {
    setWidth(1280);
    const defaults = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message" }, { list: ROSTER, detail: DETAIL }),
    );
    expect(pane(defaults).getAttribute("style")).toContain(
      "--hk-master-detail-list-w: 20rem",
    );

    const custom = mount(
      h(
        HkMasterDetail,
        {
          detailOpen: true,
          detailTitle: "Message",
          listWidth: "24rem",
        },
        { list: ROSTER, detail: DETAIL },
      ),
    );
    expect(pane(custom).getAttribute("style")).toContain("--hk-master-detail-list-w: 24rem");
  });

  it("rejects a grid-track listWidth and falls back to the documented width", () => {
    // The retired grammar was a grid track; it is INVALID as a CSS width,
    // so the browser drops it and the column collapses to content width.
    expect(resolveListWidth("20rem")).toBe("20rem");
    expect(resolveListWidth("minmax(360px, 1fr)")).toBe("20rem");
    expect(resolveListWidth("minmax(0, 2fr)")).toBe("20rem");
    expect(resolveListWidth("repeat(2, 1fr)")).toBe("20rem");
    expect(resolveListWidth("18em")).toBe("18em");
  });

  it("writes the resolved width to the column hook", () => {
    setWidth(1280);
    const c = mount(
      h(
        HkMasterDetail,
        { detailOpen: true, detailTitle: "Message", listWidth: "minmax(360px, 1fr)" },
        { list: ROSTER, detail: DETAIL },
      ),
    );
    expect(pane(c).getAttribute("style")).toContain("--hk-master-detail-list-w: 20rem");
  });

  it("names the detail region with detailTitle and shows no bare head band", () => {
    setWidth(1280);
    const c = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message" }, { list: ROSTER, detail: DETAIL }),
    );
    const detail = detailPane(c)!;
    expect(detail.getAttribute("role")).toBe("region");
    expect(detail.getAttribute("aria-label")).toBe("Message");
    // Wide layout with no actions and no close channel: no empty band —
    // the region's NAME already carries the title (the narrow modal is
    // the one that must SHOW it).
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
  it("collapses to one column below splitAt with the detail in the family modal", async () => {
    setWidth(600);
    const c = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message", onClose: () => {} }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    const root = pane(c);
    expect(root.getAttribute("data-split")).toBe("single");
    expect(root.hasAttribute("data-open")).toBe(true);
    // The in-flow detail region is GONE — the narrow face is the family
    // window (HkModal docks as the standard bottom sheet on phones and
    // owns scrim / Escape / back-gesture itself).
    expect(detailPane(c)).toBeNull();
    await nextTick();
    const frame = document.querySelector<HTMLElement>(".hk-modal-content");
    expect(frame, "the detail rides HkModal").toBeTruthy();
    expect(frame?.querySelector(".hk-master-detail-sheet-body .detail-payload")).toBeTruthy();
    expect(document.querySelector(".hk-modal-title")?.textContent).toBe("Message");
    // Single column: the roster keeps the full width, nothing beside it.
    const list = c.querySelector(".hk-master-detail-list") as HTMLElement;
    expect(list).toBeTruthy();
  });

  it("renders no window while the narrow detail is closed", async () => {
    setWidth(600);
    const c = mount(
      h(HkMasterDetail, { detailOpen: false, detailTitle: "Message", onClose: () => {} }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    expect(pane(c).getAttribute("data-split")).toBe("single");
    // A window holding an empty state would be a dead layer over the
    // roster — the narrow form simply shows the roster (HkModal is
    // mounted but renders nothing until detailOpen).
    expect(detailPane(c)).toBeNull();
    await nextTick();
    expect(document.querySelector(".hk-modal-root")).toBeNull();
    expect(c.querySelector(".hk-empty-state")).toBeNull();
    expect(c.querySelector(".hk-master-detail-list .roster")).toBeTruthy();
  });

  it("renders the detail as the whole column when the host binds no close channel", async () => {
    // A modal for a host that cannot deselect would trap the user behind
    // its scrim, focus trap and body-scroll lock. The narrow form is then
    // the detail AS the column — no overlay, no roster behind it.
    setWidth(600);
    const c = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message" }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    await nextTick();
    expect(document.querySelector(".hk-modal-root"), "no window is opened").toBeNull();
    expect(document.body.style.overflow, "and no scroll lock is taken").not.toBe("hidden");
    const column = c.querySelector(".hk-master-detail-detail--column");
    expect(column, "the detail is the column").toBeTruthy();
    expect(column!.querySelector(".detail-payload")).toBeTruthy();
    expect(c.querySelector(".hk-master-detail-list"), "no roster behind it").toBeNull();
  });

  it("keeps the modal mounted so its own close path runs (focus restored)", async () => {
    // Mount-driven modals never reach the leave finalizer: the exit motion
    // is skipped and keyboard focus is dropped on <body>. The pane must
    // keep HkModal mounted and drive modelValue instead.
    setWidth(600);
    const open = ref(true);
    const trigger = document.createElement("button");
    trigger.className = "roster-trigger";
    document.body.appendChild(trigger);
    trigger.focus();

    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(
            HkMasterDetail,
            {
              detailOpen: open.value,
              detailTitle: "Message",
              onClose: () => {
                open.value = false;
              },
            },
            { list: ROSTER, detail: DETAIL },
          );
      },
    });
    const c = mount(h(Wrapper));
    await nextTick();
    const inside = document.querySelector<HTMLElement>(".hk-master-detail-sheet-body");
    expect(inside, "the window opened").toBeTruthy();

    (document.querySelector(".hk-modal-close") as HTMLElement).click();
    // The window runs its leave (its surface transition is 320ms) and the
    // focus restore lands when the leave finalizes.
    const deadline = Date.now() + 2000;
    while (
      document.querySelector(".hk-modal-root") !== null &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await nextTick();
    expect(document.querySelector(".hk-modal-root"), "the window left").toBeNull();
    expect(open.value).toBe(false);
    expect(
      document.activeElement,
      "focus returns to where it came from, not to <body>",
    ).not.toBe(document.body);
    expect(c.querySelector(".hk-master-detail-list")).toBeTruthy();
    trigger.remove();
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

  it("keeps the two-pane layout at desktop widths the old card form split at", () => {
    // 900–1100px windows keep BOTH panes now (the flush columns shrink,
    // they do not fold) — the old 1100 threshold folded them into the
    // overlay, which read as a broken layout on small desktops.
    setWidth(1000);
    const c = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message" }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    expect(pane(c).getAttribute("data-split")).toBe("two");
    expect(detailPane(c)).toBeTruthy();
  });

  it("follows a live resize in both directions", async () => {
    setWidth(1280);
    const c = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message", onClose: () => {} }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    expect(pane(c).getAttribute("data-split")).toBe("two");
    expect(detailPane(c)).toBeTruthy();

    setWidth(600);
    await nextTick();
    expect(pane(c).getAttribute("data-split")).toBe("single");
    // The in-flow pane is gone; the window form carries the detail.
    expect(detailPane(c)).toBeNull();
    expect(document.querySelector(".hk-modal-root")).toBeTruthy();

    setWidth(1400);
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(pane(c).getAttribute("data-split")).toBe("two");
    expect(detailPane(c)).toBeTruthy();
  });
});

describe("HkMasterDetail — dismissal", () => {
  it("renders the close affordance only when a close listener is bound", () => {
    setWidth(1280);
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

  it("takes the close label from closeLabel in BOTH forms", async () => {
    setWidth(1280);
    const wide = mount(
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
      wide.querySelector(".hk-master-detail-close")?.getAttribute("aria-label"),
    ).toBe("Dismiss message");

    // The narrow window's own X must read the host's wording too — it
    // used to fall back to the generic modal label.
    setWidth(600);
    mount(
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
    await nextTick();
    expect(
      document.querySelector(".hk-modal-close")?.getAttribute("aria-label"),
    ).toBe("Dismiss message");
  });

  it("emits close from the wide affordance", () => {
    setWidth(1280);
    const onClose = vi.fn();
    const c = mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message", onClose }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    (c.querySelector(".hk-master-detail-close") as HTMLElement).click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("forwards the narrow window's close as the pane's close emit", async () => {
    setWidth(600);
    const onClose = vi.fn();
    mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message", onClose }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    await nextTick();
    // The modal's OWN close button (its header affordance) declines the
    // modelValue; the pane translates that into its close emit.
    const modalClose = document.querySelector<HTMLElement>(".hk-modal-close");
    expect(modalClose, "the modal header owns the affordance").toBeTruthy();
    modalClose!.click();
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps Escape away from the two-pane layout", () => {
    // The wide layout never registers a document Escape listener: every
    // selection is one click away, and HkModal (the narrow form) owns the
    // key while it is mounted.
    setWidth(1280);
    const wideClose = vi.fn();
    mount(
      h(HkMasterDetail, { detailOpen: true, detailTitle: "Message", onClose: wideClose }, {
        list: ROSTER,
        detail: DETAIL,
      }),
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", cancelable: true, bubbles: true }),
    );
    expect(wideClose, "the wide layout never swallows Escape").not.toHaveBeenCalled();
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

  it("makes the root the full-height flex row the host bounds", () => {
    const root = ruleBody(css, ".hk-master-detail");
    expect(root).toContain("display: flex");
    expect(root).toContain("height: 100%");
    expect(root).toContain("min-height: 0");
  });

  it("shields the roster column as a flush sidebar with the page tint", () => {
    const list = ruleBody(css, ".hk-master-detail-list");
    expect(list).toContain("width: var(--hk-master-detail-list-w, 20rem)");
    expect(list).toContain("flex: none");
    // sass normalises the slash spacing (`/ 20%` → `/20%`) — the pin is
    // the hairline declaration, tolerant of either spelling.
    expect(list).toMatch(/border-inline-end: 1px solid rgb\(var\(--color-border\) ?\/ ?20%\)/);
    expect(list).toContain("overflow: hidden");
    // No hardcoded colour: every surface layer reads a channel triplet.
    expect(list).toContain("rgb(var(--color-surface)");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // Narrow: the roster is the whole page — track and hairline drop.
    const narrowList = ruleBody(css, ".hk-master-detail[data-split=single] .hk-master-detail-list");
    expect(narrowList).toContain("flex: 1");
    expect(narrowList).toContain("border-inline-end: none");
  });

  it("keeps the detail region flush — NO card chrome (the 2026-11-23 direction)", () => {
    const detail = ruleBody(css, ".hk-master-detail-detail");
    expect(detail).toContain("flex: 1");
    expect(detail).toContain("min-width: 0");
    // The rail host: the overlay tracks are absolute children of the
    // pane, so the pane itself has to stay a non-scroller.
    expect(detail).toContain("position: relative");
    // THE DIRECTION: a layout region, not a floating card. Each absence
    // is pinned — reverting any one of these reds this block.
    expect(detail).not.toContain("border-radius");
    expect(detail).not.toContain("box-shadow");
    expect(detail).not.toContain("border: 1px solid");
    expect(ruleBody(css, ".hk-master-detail")).not.toContain("gap:");

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

  it("keeps the roster tint on a hook with no calc()/color-mix() fallback", () => {
    // A var() fallback holding calc()/color-mix() resolves to UNSET on an
    // engine without it (IACVT), and a percentage-valued retune of a
    // calc-based alpha is an invalid-at-computed-value-time type error with
    // the same outcome — the column would paint transparent. The sheet
    // therefore carries neither, and the dead @supports block that used to
    // re-declare the same hook is gone.
    expect(css).not.toContain("--ui-opacity");
    expect(css).not.toContain("color-mix");
    expect(css).not.toContain("@supports");
    expect(ruleBody(css, ".hk-master-detail-list")).toContain(
      "background: var(--hk-master-detail-list-bg, rgb(var(--color-surface)))",
    );
  });

  it("gives the narrow in-flow column the whole width", () => {
    expect(ruleBody(css, ".hk-master-detail-detail--column")).toContain("flex: 1");
  });

  it("keeps the head band pinned inside the pane's scroll", () => {
    const head = ruleBody(css, ".hk-master-detail-detail-head");
    expect(head).toContain("position: sticky");
    expect(head).toContain("top: 0");
    expect(head).toContain("border-bottom: 1px solid var(--border-faint)");
  });
});

describe("the bounded host — stage swap rule", () => {
  // The component's height:100% contract needs a DEFINITE height from
  // its host; in the admin shells' stage mode the keyed swap wrapper is
  // the only box between the flex-column main and the page. The rule is
  // pinned at the SOURCE level (chromeBand.contract.test.ts's
  // admin-tokens precedent): a DOM assertion cannot see a wrapper that
  // only takes its height from flex layout.
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, "..", "styles", "admin-tokens.scss"), "utf-8");

  it("gives the stage-mode swap wrapper the flex chain a full-height page needs", () => {
    const rule = source.match(
      /\.s-admin-shell-main\[data-content-mode="stage"\] \.s-admin-shell-swap \{([^}]*)\}/,
    )?.[1];
    expect(rule, "the stage swap rule exists").toBeTruthy();
    expect(rule!).toContain("flex: 1 1 0%");
    expect(rule!).toContain("min-height: 0");
    // …but it must NOT declare `display`: the element IS HkCrossfade's
    // one-cell grid host, and flex there lays the leaving and entering
    // pages side by side for the length of every stage swap.
    expect(rule!).not.toContain("display:");
  });
});

describe("the public barrel", () => {
  it("exports HkMasterDetail (deleting the export line keeps every other test green)", () => {
    const component = asIndexable(barrel.HkMasterDetail);
    expect(component, "HkMasterDetail must be re-exported").toBeTruthy();
    expect(component.name).toBe("HkMasterDetail");
  });
});
