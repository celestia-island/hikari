import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

// HDrawer teleports and animates; replace it with an inline passthrough
// exposing the body/footer split so the drawer contract is testable.
vi.mock("@celestia-island/hikari", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@celestia-island/hikari")>();
  const { defineComponent, h } = await import("vue");
  const HDrawerStub = defineComponent({
    name: "HDrawer",
    props: {
      modelValue: { type: Boolean, default: false },
      side: { type: String, default: "left" },
      size: { type: String, default: "280px" },
      title: { type: String, default: undefined },
      panelClass: { type: String, default: undefined },
    },
    setup(props, { slots }) {
      return () =>
        props.modelValue
          ? h("div", { class: ["drawer-stub", props.panelClass] }, [
              h("div", { class: "drawer-stub-body" }, slots.default?.()),
              slots.footer
                ? h("div", { class: "drawer-stub-footer" }, slots.footer())
                : null,
            ])
          : null;
    },
  });
  return { ...actual, HDrawer: HDrawerStub };
});

import { HkAdminShell } from "./HkAdminShell";

/**
 * HkAdminShell contract tests for the generalized slot surface ported
 * from the chest plana-legacy fork:
 * 1. Scoped slots are functions: rendering `slots.overlays` without
 *    calling it stringifies the compiled slot source into a text node.
 * 2. The mobile drawer footer carries the `userPanel` slot so the
 *    account block (identity + actions) rides the drawer bottom.
 * 3. The header slot receives `onOpenDrawer` so a header trigger (the
 *    avatar in drawer action mode) can open the nav drawer.
 * 4. Content padding rides an inner wrapper inside the scroll viewport
 *    (card box-shadows are never clipped at the viewport edges), and the
 *    mobile side-gutter drop happens ONLY for a page that declares
 *    `contentBleedOnMobile` — an ordinary page keeps its phone gutters.
 *
 * (Repo test convention: raw createApp + container queries, no
 * @vue/test-utils dependency.)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
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
  setWidth(1024);
});

const setWidth = (w: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: w,
  });
  window.dispatchEvent(new Event("resize"));
};

function paddingInner(container: HTMLElement): HTMLElement | null | undefined {
  const viewport = container.querySelector(".hk-scroll-container-viewport")
    ?? container.querySelector(".hk-scroll-container");
  return viewport?.firstElementChild as HTMLElement | null | undefined;
}

function mobileInnerPadding(container: HTMLElement): string {
  return paddingInner(container)?.style.padding ?? "";
}


function shellNode(
  props: Record<string, unknown>,
  slots: Record<string, unknown>,
) {
  return h(HkAdminShell, props as never, slots as never);
}

const NAV = () => h("nav", { class: "nav-mock" }, "NAV");
const CONTENT = () => h("main", null, "CONTENT");

describe("HkAdminShell", () => {
  it("renders the overlays slot content, never its source text", () => {
    setWidth(1024);
    const c = mount(shellNode(
      { navTitle: "Navigation" },
      {
        header: () => null,
        sidebar: NAV,
        content: CONTENT,
        overlays: () => h("div", { class: "overlay-mock" }, "OVERLAY-MARK"),
      },
    ));
    const html = c.innerHTML;
    expect(html).toContain("OVERLAY-MARK");
    // The regression: a slot function rendered un-invoked stringifies to
    // its minified source (arrow params, r._d, etc.).
    expect(html).not.toContain("=>");
    expect(c.querySelector(".overlay-mock")).toBeTruthy();
  });

  it("renders the desktop sidebar inline and skips the drawer", () => {
    setWidth(1024);
    const c = mount(shellNode(
      { navTitle: "Navigation" },
      { header: () => null, sidebar: NAV, content: CONTENT },
    ));
    expect(c.querySelector("aside .nav-mock")).toBeTruthy();
    // No drawer (mocked HDrawer) in the tree at desktop width.
    expect(c.querySelector(".drawer-stub")).toBeNull();
  });

  it("opens the mobile drawer with nav body and userPanel footer", async () => {
    setWidth(500);
    let openDrawer: (() => void) | null = null;
    const c = mount(shellNode(
      { navTitle: "Navigation", drawerPanelClass: "my-drawer" },
      {
        header: (ctx: { onOpenDrawer: () => void }) => {
          openDrawer = ctx.onOpenDrawer;
          return null;
        },
        sidebar: NAV,
        userPanel: () => h("div", { class: "s-drawer-user-panel" }, "USER-PANEL"),
        content: CONTENT,
      },
    ));
    expect(openDrawer).toBeTruthy();
    openDrawer!();
    await nextTick();
    await nextTick();
    // Drawer carries the nav in its body…
    expect(c.querySelector(".drawer-stub-body .nav-mock")).toBeTruthy();
    // …and the user panel in its footer, unwrapped (the slot's own root
    // carries the styling hooks).
    const panel = c.querySelector(".drawer-stub-footer .s-drawer-user-panel");
    expect(panel).toBeTruthy();
    expect(panel?.textContent).toContain("USER-PANEL");
    // The drawer panel class passes through for consumer-side nesting
    // adjustments.
    expect(c.querySelector(".drawer-stub.my-drawer")).toBeTruthy();
  });

  it("hands the userPanel slot an onNavigate that closes the drawer", async () => {
    setWidth(500);
    let openDrawer: (() => void) | null = null;
    let userPanelNavigate: (() => void) | null = null;
    const c = mount(shellNode(
      { navTitle: "Navigation" },
      {
        header: (ctx: { onOpenDrawer: () => void }) => {
          openDrawer = ctx.onOpenDrawer;
          return null;
        },
        sidebar: NAV,
        userPanel: (ctx: { onNavigate: () => void }) => {
          userPanelNavigate = ctx.onNavigate;
          return h("div", { class: "s-drawer-user-panel" }, "USER-PANEL");
        },
        content: CONTENT,
      },
    ));
    openDrawer!();
    await nextTick();
    await nextTick();
    expect(c.querySelector(".drawer-stub")).toBeTruthy();
    // The slot scope carries the drawer-close callback (mirrors the
    // sidebar slot's onNavigate contract)…
    expect(userPanelNavigate).toBeTruthy();
    // …and invoking it dismisses the drawer (a "go to frontend" row
    // must not leave the drawer hovering over the swapped layout).
    userPanelNavigate!();
    await nextTick();
    await nextTick();
    expect(c.querySelector(".drawer-stub")).toBeNull();
  });

  it("omits the drawer footer wrapper when no userPanel slot is given", async () => {
    setWidth(500);
    let openDrawer: (() => void) | null = null;
    const c = mount(shellNode(
      { navTitle: "Navigation" },
      {
        header: (ctx: { onOpenDrawer: () => void }) => {
          openDrawer = ctx.onOpenDrawer;
          return null;
        },
        sidebar: NAV,
        content: CONTENT,
      },
    ));
    openDrawer!();
    await nextTick();
    await nextTick();
    expect(c.querySelector(".drawer-stub-footer")).toBeNull();
    expect(c.querySelector(".s-drawer-user-panel")).toBeNull();
  });

  it("honors a custom mobileBreakpoint for the desktop takeover", async () => {
    // Default 1024: 900px reads as mobile (drawer path).
    setWidth(900);
    const narrow = mount(shellNode(
      { navTitle: "Navigation" },
      { header: () => null, sidebar: NAV, content: CONTENT },
    ));
    expect(narrow.querySelector("aside .nav-mock")).toBeNull();

    // Custom 768: the same 900px reads as desktop (inline sidebar).
    const wide = mount(shellNode(
      { navTitle: "Navigation", mobileBreakpoint: 768 },
      { header: () => null, sidebar: NAV, content: CONTENT },
    ));
    expect(wide.querySelector("aside .nav-mock")).toBeTruthy();
  });

  it("applies the content padding inside the scroll viewport so shadows are not clipped", () => {
    setWidth(1024);
    const c = mount(shellNode(
      { navTitle: "Navigation", contentPadding: "2rem" },
      { header: () => null, sidebar: NAV, content: CONTENT },
    ));
    // The padded inner wrapper exists INSIDE the scroll viewport (not as
    // padding on the container itself).
    const viewport = c.querySelector(".hk-scroll-container-viewport")
      ?? c.querySelector(".hk-scroll-container");
    const inner = viewport?.firstElementChild as HTMLElement | null | undefined;
    expect(inner).toBeTruthy();
    expect(inner?.style.padding).toBe("2rem");
  });

  it("keeps the content padding on phones unless the page declares a bleed", async () => {
    // 2026-10-04 regression: the shell used to drop the side gutters on
    // EVERY page below the breakpoint, so an ordinary roster / overview
    // page rendered flush against the phone edges. The drop is opt-in.
    // Asserted via longhands: happy-dom's shorthand parser collapses
    // 3-value paddings, so style.padding cannot distinguish them here.
    setWidth(390);
    const plain = mount(shellNode(
      { navTitle: "Navigation", contentPadding: "2rem" },
      { header: () => null, sidebar: NAV, content: CONTENT },
    ));
    const plainInner = paddingInner(plain);
    expect(plainInner?.style.paddingTop).toBe("2rem");
    expect(plainInner?.style.paddingBottom).toBe("2rem");
    expect(plainInner?.style.paddingLeft).toBe("2rem");
    expect(plainInner?.style.paddingRight).toBe("2rem");

    // A multi-value value stays verbatim too — no per-side rewriting of
    // a page that never asked for the bleed.
    const plainMulti = mount(shellNode(
      { navTitle: "Navigation", contentPadding: "1rem 2rem" },
      { header: () => null, sidebar: NAV, content: CONTENT },
    ));
    const plainMultiInner = paddingInner(plainMulti);
    expect(plainMultiInner?.style.paddingTop).toBe("1rem");
    expect(plainMultiInner?.style.paddingLeft).toBe("2rem");
    expect(plainMultiInner?.style.paddingRight).toBe("2rem");

    // Resizing within the sub-breakpoint range never changes it either —
    // asserted across the WHOLE range, not at hand-picked widths. The
    // regression is "an ordinary page loses its gutters on phones", and
    // rounds 2 and 3 both escaped guards that sampled a few widths by
    // moving the leak into a band those widths miss (a mutant confined to
    // [400, 499] would strip the gutters of a Pixel 412 / iPhone 430
    // while the suite stayed green).
    for (const width of [320, 360, 390, 412, 430, 500, 640, 700, 768, 900, 1023]) {
      setWidth(width);
      await nextTick();
      expect(plainInner?.style.paddingLeft, `at ${width}px`).toBe("2rem");
      expect(plainInner?.style.paddingRight, `at ${width}px`).toBe("2rem");
      // …VERTICAL included: the regression is not only "the sides moved".
      expect(plainInner?.style.paddingTop, `at ${width}px`).toBe("2rem");
      expect(plainInner?.style.paddingBottom, `at ${width}px`).toBe("2rem");
      expect(plainMultiInner?.style.paddingLeft, `at ${width}px (multi)`).toBe("2rem");
    }

    // A custom breakpoint on an UNDECLARED page must not move its gutters
    // either (round 4 mutated the guard to depend on the 1024 default and
    // every custom-breakpoint mount in this file declared a bleed).
    const plainNarrow = mount(shellNode(
      { navTitle: "Navigation", contentPadding: "2rem", mobileBreakpoint: 768 },
      { header: () => null, sidebar: NAV, content: CONTENT },
    ));
    setWidth(500);
    await nextTick();
    expect(paddingInner(plainNarrow)?.style.paddingLeft).toBe("2rem");
    expect(paddingInner(plainNarrow)?.style.paddingRight).toBe("2rem");

    // An explicit `false` reads exactly like an absent prop.
    const declaredOff = mount(shellNode(
      { navTitle: "Navigation", contentPadding: "1rem 2rem", contentBleedOnMobile: false },
      { header: () => null, sidebar: NAV, content: CONTENT },
    ));
    expect(paddingInner(declaredOff)?.style.paddingLeft).toBe("2rem");

    // Above the breakpoint it is verbatim for the declared page too.
    setWidth(1280);
    await nextTick();
    expect(mobileInnerPadding(plain)).toBe("2rem");
  });

  it("drops the horizontal half of the content padding below the mobile breakpoint when the page declares a bleed", async () => {
    // A page that declares `contentBleedOnMobile` (a 2D board or the 3D
    // scene) loses the side gutters on phones; vertical clearance
    // survives. Asserted via longhands — see the note above.
    setWidth(390);
    const mobileShell = mount(shellNode(
      { navTitle: "Navigation", contentPadding: "2rem", contentBleedOnMobile: true },
      { header: () => null, sidebar: NAV, content: CONTENT },
    ));
    const inner = paddingInner(mobileShell);
    expect(inner?.style.paddingTop).toBe("2rem");
    expect(inner?.style.paddingBottom).toBe("2rem");
    expect(inner?.style.paddingLeft).toBe("0px");
    expect(inner?.style.paddingRight).toBe("0px");

    // Multi-value shorthand keeps per-side meaning: vertical survives,
    // horizontal is zeroed (never the inverted "1rem 2rem 0").
    const multi = mount(shellNode(
      { navTitle: "Navigation", contentPadding: "1rem 2rem", contentBleedOnMobile: true },
      { header: () => null, sidebar: NAV, content: CONTENT },
    ));
    const multiInner = paddingInner(multi);
    expect(multiInner?.style.paddingTop).toBe("1rem");
    expect(multiInner?.style.paddingBottom).toBe("1rem");
    expect(multiInner?.style.paddingLeft).toBe("0px");
    expect(multiInner?.style.paddingRight).toBe("0px");

    // Three-value shorthand: the vertical tracks are the FIRST and the
    // THIRD, so the parser has to keep top and bottom in order. The
    // 1- and 2-value cases above cannot see a swapped pair — with ≤2
    // values the bottom track defaults to the top one, which makes the
    // correct and the transposed string identical (round-1 verification
    // mutation (e) survived on exactly that hole).
    const triple = mount(shellNode(
      { navTitle: "Navigation", contentPadding: "1rem 2rem 3rem", contentBleedOnMobile: true },
      { header: () => null, sidebar: NAV, content: CONTENT },
    ));
    const tripleInner = paddingInner(triple);
    expect(tripleInner?.style.paddingTop).toBe("1rem");
    expect(tripleInner?.style.paddingBottom).toBe("3rem");
    expect(tripleInner?.style.paddingLeft).toBe("0px");
    expect(tripleInner?.style.paddingRight).toBe("0px");

    // Four-value shorthand: right and left are DIFFERENT tracks, and the
    // rebuilt declaration has no horizontal track at all — both sides
    // must read zero. A parser that lands a horizontal value in the wrong
    // slot is invisible to the shorter cases (round-2 verification
    // mutated "1rem 2rem 3rem 4rem" into "1rem 0 3rem 2rem" and the suite
    // stayed green).
    const quad = mount(shellNode(
      { navTitle: "Navigation", contentPadding: "1rem 2rem 3rem 4rem", contentBleedOnMobile: true },
      { header: () => null, sidebar: NAV, content: CONTENT },
    ));
    const quadInner = paddingInner(quad);
    expect(quadInner?.style.paddingTop).toBe("1rem");
    expect(quadInner?.style.paddingBottom).toBe("3rem");
    expect(quadInner?.style.paddingLeft).toBe("0px");
    expect(quadInner?.style.paddingRight).toBe("0px");

    // A function value is ONE track: whitespace inside `calc(...)` belongs
    // to the value, not to the shorthand. Splitting on plain whitespace
    // shreds it into three tracks and rebuilds an invalid declaration,
    // which a real browser drops WHOLE — taking the vertical clearance
    // this prop promises to keep with it (rounds 2 and 3 both hit this on
    // the shell as it shipped). happy-dom stores calc() values, so the
    // longhands are readable here; it cannot round-trip var()/min(), which
    // is why calc() is the probe.
    const fn = mount(shellNode(
      { navTitle: "Navigation", contentPadding: "calc(1rem + 2px) 1rem", contentBleedOnMobile: true },
      { header: () => null, sidebar: NAV, content: CONTENT },
    ));
    const fnInner = paddingInner(fn);
    expect(fnInner?.style.paddingTop).toBe("calc(1rem + 2px)");
    expect(fnInner?.style.paddingBottom).toBe("calc(1rem + 2px)");
    expect(fnInner?.style.paddingLeft).toBe("0px");
    expect(fnInner?.style.paddingRight).toBe("0px");

    // NESTED functions are one track as well (the depth counter, not a
    // single-level check): a bare `clamp()` cannot be the probe because
    // happy-dom rejects it outright, so the function rides in the second
    // track of a plain length.
    const nested = mount(shellNode(
      { navTitle: "Navigation", contentPadding: "5rem clamp(1rem, min(2vw, 3px), 4rem)", contentBleedOnMobile: true },
      { header: () => null, sidebar: NAV, content: CONTENT },
    ));
    const nestedInner = paddingInner(nested);
    expect(nestedInner?.style.paddingTop).toBe("5rem");
    expect(nestedInner?.style.paddingBottom).toBe("5rem");
    expect(nestedInner?.style.paddingLeft).toBe("0px");
    expect(nestedInner?.style.paddingRight).toBe("0px");

    // …and so is a space directly after the opening parenthesis.
    const spacedFn = mount(shellNode(
      { navTitle: "Navigation", contentPadding: "calc( 1rem + 2px ) 1rem", contentBleedOnMobile: true },
      { header: () => null, sidebar: NAV, content: CONTENT },
    ));
    const spacedFnInner = paddingInner(spacedFn);
    expect(spacedFnInner?.style.paddingTop).toBe("calc( 1rem + 2px )");
    expect(spacedFnInner?.style.paddingBottom).toBe("calc( 1rem + 2px )");
    expect(spacedFnInner?.style.paddingLeft).toBe("0px");

    // A lone CSS-wide keyword cannot be rewritten per side (`inherit 0
    // inherit` is not a padding — every engine rejects it), so the value
    // passes through VERBATIM: the page keeps its padding instead of
    // losing all four sides to a dropped declaration. (The comment case
    // behaves the same way; it is pinned in HkAdminShell.padding.test.ts
    // because happy-dom refuses to store a comment-bearing value at all.)
    for (const keyword of ["inherit", "unset"]) {
      const wide = mount(shellNode(
        { navTitle: "Navigation", contentPadding: keyword, contentBleedOnMobile: true },
        { header: () => null, sidebar: NAV, content: CONTENT },
      ));
      expect(paddingInner(wide)?.style.padding, keyword).toBe(keyword);
    }

    // Tabs and newlines are valid CSS separators, and the whitespace
    // around a shorthand is not a track of its own ("\t1rem 2rem" must
    // read exactly like "1rem 2rem", never like a three-track value).
    for (const padded of ["1rem\t2rem", "1rem\n2rem", " 1rem 2rem ", "\t1rem 2rem"]) {
      const ws = mount(shellNode(
        { navTitle: "Navigation", contentPadding: padded, contentBleedOnMobile: true },
        { header: () => null, sidebar: NAV, content: CONTENT },
      ));
      const wsInner = paddingInner(ws);
      expect(wsInner?.style.paddingTop, JSON.stringify(padded)).toBe("1rem");
      expect(wsInner?.style.paddingBottom, JSON.stringify(padded)).toBe("1rem");
      expect(wsInner?.style.paddingLeft, JSON.stringify(padded)).toBe("0px");
      expect(wsInner?.style.paddingRight, JSON.stringify(padded)).toBe("0px");
    }

    // Nothing to strip: an empty value passes through untouched, it does
    // NOT become a zero padding of its own.
    const blank = mount(shellNode(
      { navTitle: "Navigation", contentPadding: "", contentBleedOnMobile: true },
      { header: () => null, sidebar: NAV, content: CONTENT },
    ));
    expect(paddingInner(blank)?.style.padding).toBe("");

    // The declared page bleeds across the WHOLE sub-breakpoint range, not
    // just at the hand-picked widths above: round 4 mutated the bleed to
    // stop inside [400, 499) and nothing in this file sampled a declared
    // page in that band (412 / 430 px phones included).
    for (const width of [320, 360, 390, 412, 430, 500, 640, 700, 768, 900, 1023]) {
      setWidth(width);
      await nextTick();
      expect(paddingInner(mobileShell)?.style.paddingLeft, `declared at ${width}px`).toBe("0px");
      expect(paddingInner(mobileShell)?.style.paddingRight, `declared at ${width}px`).toBe("0px");
      expect(paddingInner(mobileShell)?.style.paddingTop, `declared at ${width}px`).toBe("2rem");
    }

    // The shell's own default padding (1.5rem) is what every consumer
    // actually gets — pinned here because every other mount in this file
    // passes `contentPadding` explicitly.
    const defaulted = mount(shellNode(
      { navTitle: "Navigation", contentBleedOnMobile: true },
      { header: () => null, sidebar: NAV, content: CONTENT },
    ));
    setWidth(390);
    await nextTick();
    expect(paddingInner(defaulted)?.style.paddingTop).toBe("1.5rem");
    expect(paddingInner(defaulted)?.style.paddingBottom).toBe("1.5rem");
    expect(paddingInner(defaulted)?.style.paddingLeft).toBe("0px");
    expect(paddingInner(defaulted)?.style.paddingRight).toBe("0px");

    // The gate follows THIS shell's breakpoint, and the boundary is the
    // breakpoint itself: 1023 is still mobile (bleed), 1024 is desktop
    // (verbatim) — the same `>=` the sidebar takes over on.
    setWidth(1023);
    await nextTick();
    expect(paddingInner(mobileShell)?.style.paddingLeft).toBe("0px");
    setWidth(1024);
    await nextTick();
    expect(paddingInner(mobileShell)?.style.paddingLeft).toBe("2rem");

    // …and a custom breakpoint moves it: the padding gate must read the
    // same `isDesktop` the layout does, not the 1024 default (round 3
    // mutated it to a hardcoded 1024 and the suite stayed green).
    const narrow = mount(shellNode(
      { navTitle: "Navigation", contentPadding: "2rem", contentBleedOnMobile: true, mobileBreakpoint: 768 },
      { header: () => null, sidebar: NAV, content: CONTENT },
    ));
    setWidth(767);
    await nextTick();
    expect(paddingInner(narrow)?.style.paddingLeft).toBe("0px");
    setWidth(768);
    await nextTick();
    expect(paddingInner(narrow)?.style.paddingLeft).toBe("2rem");
    setWidth(800);
    await nextTick();
    expect(paddingInner(narrow)?.style.paddingLeft).toBe("2rem");

    // …in BOTH directions: a breakpoint raised above the 1024 default must
    // move the padding gate too. Round 3 mutated the gate to saturate at
    // 1024 and only a downward custom breakpoint was covered, so the
    // mirror image survived.
    const tablet = mount(shellNode(
      { navTitle: "Navigation", contentPadding: "2rem", contentBleedOnMobile: true, mobileBreakpoint: 1440 },
      { header: () => null, sidebar: NAV, content: CONTENT },
    ));
    setWidth(1200);
    await nextTick();
    expect(paddingInner(tablet)?.style.paddingLeft).toBe("0px");
    setWidth(1440);
    await nextTick();
    expect(paddingInner(tablet)?.style.paddingLeft).toBe("2rem");

    // The declaration never reaches desktop: crossing back above the
    // breakpoint restores the verbatim padding.
    setWidth(1280);
    await nextTick();
    expect(mobileInnerPadding(mobileShell)).toBe("2rem");
    expect(mobileInnerPadding(multi)).toBe("1rem 2rem");
    // …per side, too: the restored shorthand must not be a collapsed
    // approximation of the three tracks it came from.
    expect(tripleInner?.style.paddingTop).toBe("1rem");
    expect(tripleInner?.style.paddingBottom).toBe("3rem");
    expect(tripleInner?.style.paddingLeft).toBe("2rem");
    expect(tripleInner?.style.paddingRight).toBe("2rem");
  });
});
