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
 *    (card box-shadows are never clipped at the viewport edges).
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
});
