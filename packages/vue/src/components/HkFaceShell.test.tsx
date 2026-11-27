import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, defineComponent, h, inject, nextTick, type VNode } from "vue";

// HDrawer teleports and animates; replace it with an inline passthrough
// (same stub shape as HkAdminShell.test.tsx) so the shell contract is
// testable without the overlay runtime.
/** Records what the shell hands its mobile drawer. `padding` is the
 *  contract this file pins: a nav PANEL brings its own paddings, so the
 *  drawer body must add none (a 1rem body padding insets the panel and the
 *  overlay scroll rail that rides its edge — the 2026-11-27 field report). */
const drawerState = vi.hoisted(() => ({ padding: "unset" as string | undefined }));

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
      padding: { type: String, default: undefined },
    },
    setup(props, { slots }) {
      return () =>
        props.modelValue
          ? ((drawerState.padding = props.padding),
            h("div", { class: ["drawer-stub", props.panelClass] }, [
              h("div", { class: "drawer-stub-body" }, slots.default?.()),
              slots.footer
                ? h("div", { class: "drawer-stub-footer" }, slots.footer())
                : null,
            ]))
          : null;
    },
  });
  return { ...actual, HDrawer: HDrawerStub };
});

import { HkFaceShell } from "./HkFaceShell";
import { HkAdminShell } from "./HkAdminShell";
import { HK_SCROLL_PROGRESS_ALLOWED } from "./HkScrollProgressDock";
import { provideActionBar } from "../composables/useActionBar";

/**
 * HkFaceShell — the generalized face shell extracted from HkAdminShell
 * (2026-10-29). What this file pins:
 *
 * 1. The STAGE content mode: no scroll viewport, no padding wrapper, the
 *    content bare under the main region — a canvas face must never be
 *    wrapped in the document viewport (that is the mode's reason for
 *    existing). `contentPadding` is ignored there.
 * 2. The DOCUMENT mode (default) keeps the admin shell's exact host:
 *    scroll viewport + inner padding wrapper + `data-content-mode`.
 * 3. `contentKey` crossfade stays available in BOTH modes.
 * 4. The footer band + its injection-driven height reservation behave
 *    identically in both modes.
 * 5. The extraction boundary: HkFaceShell's header slot carries NO
 *    `actions` param (the shell provides no action bar); HkAdminShell —
 *    the admin wrapper — still injects it (the legacy channel that
 *    wrapper exists to keep).
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
});

const CONTENT = () => h("main", null, "CONTENT");
const FOOTER = () => h("div", { class: "footer-mock" }, "FOOTER");

describe("HkFaceShell stage mode", () => {
  it("renders the content bare — no scroll viewport, no padding wrapper", () => {
    const c = mount(h(HkFaceShell, {
      contentMode: "stage",
      contentPadding: "3rem",
      navTitle: "Navigation",
    }, {
      header: () => null,
      content: CONTENT,
    }));
    const main = c.querySelector(".s-admin-shell-main");
    expect(main, "the main region exists").toBeTruthy();
    expect(main!.getAttribute("data-content-mode")).toBe("stage");
    // The document host is GONE — that is the stage contract.
    expect(c.querySelector(".hk-scroll-container")).toBeNull();
    expect(c.querySelector(".hk-scroll-container-viewport")).toBeNull();
    // …and so is the fallback scroll-progress dock (document-mode only —
    // a stage face owns its own geometry, so the shell mounts no dock
    // scope and provides no pill chrome at all).
    expect(c.querySelector(".hk-scroll-progress-dock-scope")).toBeNull();
    expect(c.querySelector(".hk-scroll-progress-dock")).toBeNull();
    // No padding wrapper anywhere: the content slot's first element IS
    // the main region's child (contentPadding is a document-mode prop).
    expect(main!.firstElementChild?.textContent).toBe("CONTENT");
    expect([...main!.querySelectorAll("*")].every((el) => (el as HTMLElement).style.padding === "")).toBe(true);
  });

  it("still honors the contentKey crossfade in stage mode", () => {
    const c = mount(h(HkFaceShell, {
      contentMode: "stage",
      contentKey: "scene-a",
      navTitle: "Navigation",
    }, {
      header: () => null,
      content: CONTENT,
    }));
    const swap = c.querySelector(".s-admin-shell-swap");
    expect(swap, "the library crossfade wraps the stage content").toBeTruthy();
    expect(swap!.className).toContain("hk-crossfade");
    // …and the crossfade is the main region's DIRECT child (no host
    // wrapper between them).
    expect(swap!.parentElement!.classList.contains("s-admin-shell-main")).toBe(true);
  });

  it("keeps the footer band and its reservation in stage mode", () => {
    const withFooter = mount(h(HkFaceShell, {
      contentMode: "stage",
      navTitle: "Navigation",
    }, {
      header: () => null,
      content: CONTENT,
      footer: FOOTER,
    }));
    expect(withFooter.querySelector("footer.s-status-bar .footer-mock")).toBeTruthy();
    expect((withFooter.querySelector(".s-admin-shell-body") as HTMLElement)!.style.paddingBottom)
      .toBe("var(--s-footer-height)");

    const withoutFooter = mount(h(HkFaceShell, {
      contentMode: "stage",
      navTitle: "Navigation",
    }, {
      header: () => null,
      content: CONTENT,
    }));
    expect(withoutFooter.querySelector("footer.s-status-bar")).toBeNull();
    expect((withoutFooter.querySelector(".s-admin-shell-body") as HTMLElement)!.style.paddingBottom).toBe("0px");
  });
});

describe("HkFaceShell document mode (the default)", () => {
  it("keeps the admin shell's exact content host", () => {
    const c = mount(h(HkFaceShell, {
      contentPadding: "2rem",
      navTitle: "Navigation",
    }, {
      header: () => null,
      content: CONTENT,
    }));
    const main = c.querySelector(".s-admin-shell-main");
    expect(main!.getAttribute("data-content-mode")).toBe("document");
    expect(c.querySelector(".hk-scroll-container")).toBeTruthy();
    const viewport = c.querySelector(".hk-scroll-container-viewport")
      ?? c.querySelector(".hk-scroll-container");
    // The shell's fallback scroll-progress dock wraps the content
    // (2026-11-09): its scope is display: contents, so the padding
    // wrapper below it is STILL the viewport's only layout box.
    const scope = viewport!.firstElementChild as HTMLElement;
    expect(scope.classList.contains("hk-scroll-progress-dock-scope")).toBe(true);
    const inner = scope.firstElementChild as HTMLElement;
    expect(inner.style.padding).toBe("2rem");
    expect(inner.textContent).toContain("CONTENT");
  });
});

describe("HkFaceShell scroll-progress dock master switch", () => {
  const makeProbe = (box: { seen: unknown }) =>
    defineComponent({
      setup() {
        box.seen = inject(HK_SCROLL_PROGRESS_ALLOWED, null);
        return () => h("main", null, "CONTENT");
      },
    });

  it("provides ALLOWED=true by default and mounts the fallback dock", () => {
    const box: { seen: unknown } = { seen: "unset" };
    const c = mount(h(HkFaceShell, {
      navTitle: "Navigation",
    }, {
      header: () => null,
      content: () => h(makeProbe(box)),
    }));
    // The `scrollProgress` prop (default true) is the face-level lever
    // over every dock in the subtree.
    expect(box.seen).toBe(true);
    expect(c.querySelector(".hk-scroll-progress-dock-scope")).not.toBeNull();
  });

  it("scrollProgress:false closes the switch and stands the fallback dock down", () => {
    const box: { seen: unknown } = { seen: "unset" };
    const c = mount(h(HkFaceShell, {
      navTitle: "Navigation",
      scrollProgress: false,
    }, {
      header: () => null,
      content: () => h(makeProbe(box)),
    }));
    expect(box.seen).toBe(false);
    // Fully lazy: no scope, no pill anywhere in the shell.
    expect(c.querySelector(".hk-scroll-progress-dock-scope")).toBeNull();
    expect(c.querySelector(".hk-scroll-progress-dock")).toBeNull();
    expect(c.querySelector(".hk-scroll-container-viewport")!.textContent).toContain("CONTENT");
  });
});

describe("the extraction boundary: the action-bar channel", () => {
  it("HkFaceShell's header slot carries no actions param (no bar provided)", () => {
    const seen: Array<Record<string, unknown>> = [];
    mount(h(HkFaceShell, { navTitle: "Navigation" }, {
      header: (params: Record<string, unknown>) => {
        seen.push(params);
        return null;
      },
      content: CONTENT,
    }));
    expect(seen.length).toBeGreaterThan(0);
    for (const params of seen) {
      expect("actions" in params).toBe(false);
    }
    // The shell-scoped params the face header relies on are all there.
    expect(seen[0]).toMatchObject({
      isDesktop: true,
      showHamburger: false,
      compact: false,
    });
    expect(typeof seen[0].onOpenDrawer).toBe("function");
  });

  it("HkAdminShell still injects actions into its header slot (the legacy channel)", () => {
    const seen: Array<Record<string, unknown>> = [];
    mount(h(HkAdminShell, { navTitle: "Navigation" }, {
      header: (params: Record<string, unknown>) => {
        seen.push(params);
        return null;
      },
      content: CONTENT,
    }));
    expect(seen.length).toBeGreaterThan(0);
    for (const params of seen) {
      expect("actions" in params).toBe(true);
      expect(Array.isArray(params.actions)).toBe(true);
    }
  });
});

/**
 * The header CENTRE channel (2026-11-23) — the other half of the bar
 * contract. `actions` belongs to the shell that PROVIDES the bar; `center`
 * belongs to whichever shell sits UNDER one (HkFaceShell provides none, so
 * it injects the nearest). The delivery is the field's ABSENCE, not an
 * empty renderer: a face whose host owns its chrome must not be handed a
 * centre group no page registered.
 */
describe("the header centre channel", () => {
  it("HkFaceShell carries NO center param when no bar is provided above", () => {
    const seen: Array<Record<string, unknown>> = [];
    mount(h(HkFaceShell, { navTitle: "Navigation" }, {
      header: (params: Record<string, unknown>) => {
        seen.push(params);
        return null;
      },
      content: CONTENT,
    }));
    expect(seen.length).toBeGreaterThan(0);
    for (const params of seen) {
      expect("center" in params).toBe(false);
    }
  });

  it("HkFaceShell relays the centre group of a bar provided ABOVE it", async () => {
    // A bespoke face that owns its bar provides it over the shell — the
    // same shape HkAdminShell has, without its `actions` injection.
    const Host = defineComponent({
      name: "CentreHost",
      setup() {
        const bar = provideActionBar();
        bar.center.value = () => [h("span", { class: "host-centre" }, "host-mid")];
        return () =>
          h(HkFaceShell, { navTitle: "Navigation" }, {
            header: (params: { center?: () => VNode[] }) =>
              h("div", { class: "header-centre" }, params.center?.() ?? []),
            content: CONTENT,
          });
      },
    });
    const c = mount(h(Host));
    await nextTick();
    expect(c.querySelector(".header-centre .host-centre")?.textContent).toBe("host-mid");
  });
});

describe("the contentMode attrs leak (R2 S2)", () => {
  it("HkAdminShell declares and forwards contentMode — a passed stage value reaches the host honestly", () => {
    const staged = mount(h(HkAdminShell, {
      contentMode: "stage",
      navTitle: "Navigation",
    }, {
      header: () => null,
      content: CONTENT,
    }));
    expect(staged.querySelector(".s-admin-shell-main")!.getAttribute("data-content-mode"))
      .toBe("stage");
    expect(staged.querySelector(".hk-scroll-container")).toBeNull();

    const defaulted = mount(h(HkAdminShell, { navTitle: "Navigation" }, {
      header: () => null,
      content: CONTENT,
    }));
    expect(defaulted.querySelector(".s-admin-shell-main")!.getAttribute("data-content-mode"))
      .toBe("document");
    expect(defaulted.querySelector(".hk-scroll-container")).toBeTruthy();
  });

  it("the wrapper keeps the DECLARATION (the half the behavior test cannot see)", () => {
    // Without the declared prop, a stray `content-mode` from a template
    // or a v-bind="$attrs" relay falls through to the inner shell, where
    // fallthrough attrs OVERRIDE explicit props — the leak R2 proved
    // with a repro. The behavior test above cannot distinguish honest
    // forwarding from the leak (both render stage for a passed value),
    // so the declaration itself is pinned at source.
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "HkAdminShell.tsx"), "utf-8");
    expect(src, "the prop must be declared on the wrapper").toContain(
      'contentMode: { type: String as PropType<"document" | "stage">, default: "document" }',
    );
    expect(src, "and forwarded honestly").toContain("contentMode: props.contentMode,");
  });
});

/**
 * The MOBILE DRAWER host contract (2026-11-27 field report, phone
 * screenshot: "侧边栏的滚动条没贴边" — the nav panel's scroll rail floated
 * ~20px inside the drawer instead of hugging its edge).
 *
 * Root cause, measured on the docs hub: HkFaceShell handed HDrawer no
 * `padding`, so the drawer body carried its 1rem default; the nav panel
 * (which every consumer fills with `inDrawer ? "100%" : …`) was inset to
 * the content box, and the shared overlay rail — attached to the panel's
 * body band — rode the PANEL's edge, not the drawer's. Zeroing the drawer
 * body's padding makes the panel fill it: rail right edge moved 260 → 276
 * against a 280px panel (the engine's own 4px inset).
 *
 * MUT: dropping `padding="none"` from the shell's HDrawer turns this RED.
 */
describe("mobile drawer: the nav panel fills it", () => {
  it("passes padding=none so the panel (and its scroll rail) reaches the drawer edge", async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 400 });
    try {
      let openDrawer: (() => void) | null = null;
      let drawerSidebarParams: Record<string, unknown> | null = null;
      drawerState.padding = "unset";
      const c = mount(
        h(
          HkFaceShell,
          { navTitle: "Navigation" },
          {
            header: (params: Record<string, unknown>) => {
              openDrawer = params.onOpenDrawer as () => void;
              return null;
            },
            content: CONTENT,
            sidebar: (params: Record<string, unknown>) => {
              drawerSidebarParams = params;
              return h("div", { class: "nav-panel" }, "NAV");
            },
          },
        ),
      );
      // Below the desktop breakpoint the shell renders the drawer host; it
      // mounts closed, so open it the way the hamburger does.
      expect(typeof openDrawer, "the shell must hand the header a drawer opener").toBe("function");
      (openDrawer as unknown as () => void)();
      await nextTick();
      await nextTick();

      const stub = c.ownerDocument.querySelector(".drawer-stub");
      expect(stub, "the drawer opens below the breakpoint").not.toBeNull();
      // THE contract: no body padding, so the panel fills the drawer.
      expect(drawerState.padding).toBe("none");
      // …and the panel is told it is in the drawer, which is what makes the
      // consumers render `width: 100%`. Both halves must hold: padding alone
      // would shrink a panel that still sizes itself to a fixed width.
      expect(drawerSidebarParams).not.toBeNull();
      expect(drawerSidebarParams!.inDrawer).toBe(true);
      expect(drawerSidebarParams!.collapsed).toBe(false);
      expect(stub!.querySelector(".nav-panel")).not.toBeNull();
      // SECOND, INDEPENDENT guard (R3 review): the runtime assertion above
      // is the pin's only bite — a future "this looks flaky, loosen it to
      // toBeDefined()" edit would leave the sentinel satisfying it and
      // silently disable the whole fix. This source-level read fails for a
      // DIFFERENT reason: the shell stops passing the prop at all.
      const shellSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "HkFaceShell.tsx"), "utf8");
      // A window slice, not a tag regex: the drawer's props contain `=>`
      // arrow callbacks, so `/<HDrawer[^>]*>/` stops inside the first one.
      const drawerAt = shellSrc.indexOf("<HDrawer");
      expect(drawerAt, "the shell must still render an HDrawer").toBeGreaterThan(-1);
      const drawerCall = shellSrc.slice(drawerAt, drawerAt + 1600);
      expect(drawerCall).toMatch(/padding="none"/);
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: originalWidth });
    }
  });
});
