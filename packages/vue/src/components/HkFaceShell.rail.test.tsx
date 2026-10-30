import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, ref, type VNode } from "vue";

// Same stub shape as HkFaceShell.test.tsx: HDrawer teleports and
// animates; the desktop rail contract is testable without the overlay
// runtime.
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

import { HkFaceShell } from "./HkFaceShell";
import { HkAdminShell } from "./HkAdminShell";
import HkMenu, { type HkMenuItem } from "./HkMenu";

/**
 * HkFaceShell desktop rail + peek integration (2026-10-30). What this
 * file pins:
 *
 * 1. OPT-IN: without sidebarCollapsible the sidebar renders the legacy
 *    aside — no rail classes, no toggle, slot collapsed stays false and
 *    carries no peeking param.
 * 2. The rail channel: the toggle drives v-model:sidebar-rail-style, the
 *    host width collapses to sidebarCollapsedWidth, the slot receives
 *    collapsed: true.
 * 3. The PEEK overlay: after the dwell (pointerenter + 400ms) the panel
 *    grows to the full width while the HOST width — the only layout
 *    lever over the content — STAYS at the rail width (the "content
 *    never shifts" core contract), and the slot flips back to full rows
 *    (collapsed: false, peeking: true).
 * 4. Grace + flicker: leave closes only after the grace; re-entry inside
 *    the grace keeps the peek open.
 * 5. Escape closes; a nav click (the slot's onNavigate) closes.
 * 6. HkAdminShell forwards the whole prop family (source pin, the same
 *    honest-forwarding rule as contentMode) and mounts the rail.
 *
 * The harness closes the v-model loop with a stateful wrapper — exactly
 * what a real host's v-model:sidebar-rail-style does.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

interface SlotParams {
  collapsed: boolean;
  onNavigate: () => void;
  peeking?: boolean;
  [key: string]: unknown;
}

interface RailMount {
  container: HTMLElement;
  aside(): HTMLElement;
  panel(): HTMLElement;
  main(): HTMLElement;
  toggle(): HTMLButtonElement;
  slotParams: SlotParams[];
  headerParams: Array<Record<string, unknown>>;
  /** Open the mobile nav drawer through the header's onOpenDrawer (the
   *  sanctioned host channel — the hamburger lives in the header slot). */
  openDrawer(): void;
  emitted: string[];
}

function mountShell(
  props: Record<string, unknown> = {},
  sidebarSlot?: (params: SlotParams) => VNode,
): RailMount {
  const slotParams: SlotParams[] = [];
  const headerParams: Array<Record<string, unknown>> = [];
  const emitted: string[] = [];
  const container = document.createElement("div");
  document.body.appendChild(container);

  const Wrapper = defineComponent({
    name: "RailShellHarness",
    setup() {
      const railStyle = ref<"expanded" | "rail">(
        (props.sidebarRailStyle as "expanded" | "rail") ?? "expanded",
      );
      return () =>
        h(HkFaceShell, {
          navTitle: "Navigation",
          ...props,
          sidebarRailStyle: railStyle.value,
          "onUpdate:sidebarRailStyle": (v: string) => {
            emitted.push(v);
            railStyle.value = v as "expanded" | "rail";
          },
        }, {
          header: (params: Record<string, unknown>) => {
            headerParams.push(params);
            return null;
          },
          sidebar: (params: SlotParams) => {
            slotParams.push(params);
            return sidebarSlot?.(params) ?? h("div", { class: "sidebar-mock" }, "NAV");
          },
          content: () => h("div", { class: "content-mock" }, "CONTENT"),
        });
    },
  });

  const app = createApp(Wrapper);
  app.mount(container);
  mounts.push({ app, container });
  return {
    container,
    aside: () => container.querySelector(".hk-sidebar-rail-host") as HTMLElement,
    panel: () => container.querySelector(".hk-sidebar-rail-panel") as HTMLElement,
    main: () => container.querySelector(".s-admin-shell-main") as HTMLElement,
    toggle: () =>
      container.querySelector(".hk-sidebar-rail-toggle button") as HTMLButtonElement,
    slotParams,
    headerParams,
    openDrawer: () => (headerParams[headerParams.length - 1]!.onOpenDrawer as () => void)(),
    emitted,
  };
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  // HkMenu's rail rows ride HkTooltip (teleported to the overlay root).
  document.querySelectorAll("#hk-overlay-root, .hk-tooltip-popup").forEach((n) => n.remove());
  // The drawer-path tests below resize the window to the mobile side;
  // every other case here assumes the desktop width.
  window.innerWidth = 1024;
  vi.useRealTimers();
});

const POINTER_ENTER = () => new Event("pointerenter");
const POINTER_LEAVE = () => new Event("pointerleave");

describe("HkFaceShell desktop sidebar rail (opt-in)", () => {
  it("renders the LEGACY aside untouched when not collapsible", () => {
    const c = mountShell();
    expect(c.aside(), "no rail host class").toBeFalsy();
    expect(c.toggle(), "no toggle button").toBeFalsy();
    // The slot keeps its legacy param shape.
    const last = c.slotParams[c.slotParams.length - 1]!;
    expect(last.collapsed).toBe(false);
    expect(typeof last.onNavigate).toBe("function");
    expect("peeking" in last).toBe(false);
  });

  it("keeps removing the sidebar entirely under the legacy sidebarCollapsed prop", () => {
    const c = mountShell({ sidebarCollapsible: true, sidebarCollapsed: true });
    expect(c.container.querySelector("aside")).toBeFalsy();
    expect(c.container.querySelector(".content-mock")).toBeTruthy();
  });
});

describe("HkFaceShell rail mode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("collapses through the toggle and the v-model channel", async () => {
    const c = mountShell({ sidebarCollapsible: true });

    expect(c.aside().style.width).toBe("224px");
    expect(c.aside().getAttribute("data-rail")).toBeNull();
    expect(c.toggle().getAttribute("aria-expanded")).toBe("true");

    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);

    expect(c.emitted, "the model channel emits rail").toEqual(["rail"]);
    expect(c.aside().style.width).toBe("56px");
    expect(c.aside().hasAttribute("data-rail")).toBe(true);
    expect(c.toggle().getAttribute("aria-expanded")).toBe("false");
    expect(c.slotParams[c.slotParams.length - 1]!.collapsed).toBe(true);
  });

  it("collapses with NO channel bound — the session-only default (R1 defect pin)", async () => {
    // Semi-controlled state: a host that never binds
    // v-model:sidebar-rail-style still gets a working toggle; the emit
    // just lands unheard. (The pure-delegate version left the click
    // inert — found by the R1 verifier.)
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(HkFaceShell, { navTitle: "Navigation", sidebarCollapsible: true }, {
          header: () => null,
          sidebar: () => h("div", "NAV"),
          content: () => h("div", "CONTENT"),
        }),
    });
    app.mount(container);
    mounts.push({ app, container });

    const aside = container.querySelector(".hk-sidebar-rail-host") as HTMLElement;
    const toggle = container.querySelector(".hk-sidebar-rail-toggle button") as HTMLButtonElement;
    expect(aside.style.width).toBe("224px");

    toggle.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(aside.style.width, "the unbound toggle still collapses").toBe("56px");

    toggle.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(aside.style.width, "and expands again").toBe("224px");
  });

  it("the bound prop WINS on the way back in — external channel drives both directions", async () => {
    // The other half of the semi-controlled contract (R2 pin): a host
    // that treats sidebarRailStyle as ITS state (store-driven, no echo)
    // must see the sidebar follow. Deleting the prop-sync watch leaves
    // every other test green — this is the one that goes red.
    const railStyle = ref<"expanded" | "rail">("expanded");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      setup: () => () =>
        h(HkFaceShell, {
          navTitle: "Navigation",
          sidebarCollapsible: true,
          // Deliberately NO onUpdate:sidebarRailStyle echo — the prop is
          // the external authority here.
          sidebarRailStyle: railStyle.value,
        }, {
          header: () => null,
          sidebar: () => h("div", "NAV"),
          content: () => h("div", "CONTENT"),
        }),
    });
    app.mount(container);
    mounts.push({ app, container });
    const aside = () => container.querySelector(".hk-sidebar-rail-host") as HTMLElement;

    railStyle.value = "rail";
    await vi.advanceTimersByTimeAsync(0);
    expect(aside().style.width, "an external rail value collapses").toBe("56px");

    railStyle.value = "expanded";
    await vi.advanceTimersByTimeAsync(0);
    expect(aside().style.width, "and an external expanded value restores").toBe("224px");
  });

  it("honors a configured rail width", async () => {
    const c = mountShell({ sidebarCollapsible: true, sidebarCollapsedWidth: "72px" });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().style.width).toBe("72px");
  });

  it("peeks after the dwell as an OVERLAY — the host width never moves", async () => {
    const c = mountShell({ sidebarCollapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);

    c.aside().dispatchEvent(POINTER_ENTER());
    await vi.advanceTimersByTimeAsync(399);
    expect(c.aside().hasAttribute("data-peeking"), "one tick before the dwell").toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(c.aside().hasAttribute("data-peeking")).toBe(true);
    // THE core contract: the layout footprint (host width) stays at the
    // rail width while the panel overlays at the full width — the
    // content <main> cannot shift because nothing in flow changed.
    expect(c.aside().style.width).toBe("56px");
    expect(c.panel().style.width).toBe("224px");
    expect(c.main(), "the content host still renders").toBeTruthy();
    // The slot renders FULL rows again inside the peek.
    expect(c.slotParams[c.slotParams.length - 1]!.collapsed).toBe(false);
    expect(c.slotParams[c.slotParams.length - 1]!.peeking).toBe(true);
  });

  it("closes on leave only after the grace; re-entry cancels the close", async () => {
    const c = mountShell({ sidebarCollapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    c.aside().dispatchEvent(POINTER_ENTER());
    await vi.advanceTimersByTimeAsync(400);
    expect(c.aside().hasAttribute("data-peeking")).toBe(true);

    // Diagonal move: out, back inside the grace — no flicker.
    c.aside().dispatchEvent(POINTER_LEAVE());
    await vi.advanceTimersByTimeAsync(100);
    c.aside().dispatchEvent(POINTER_ENTER());
    await vi.advanceTimersByTimeAsync(1000);
    expect(c.aside().hasAttribute("data-peeking"), "re-entry keeps the peek open").toBe(true);

    // A full grace outside finally closes.
    c.aside().dispatchEvent(POINTER_LEAVE());
    await vi.advanceTimersByTimeAsync(149);
    expect(c.aside().hasAttribute("data-peeking"), "inside the grace it stays open").toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(c.aside().hasAttribute("data-peeking")).toBe(false);
    expect(c.panel().style.width).toBe("56px");
    expect(c.aside().style.width).toBe("56px");
  });

  it("Escape closes an open peek", async () => {
    const c = mountShell({ sidebarCollapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    c.aside().dispatchEvent(POINTER_ENTER());
    await vi.advanceTimersByTimeAsync(400);
    expect(c.aside().hasAttribute("data-peeking")).toBe(true);

    c.aside().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-peeking")).toBe(false);
  });

  it("a nav row click inside the peek closes it (onNavigate)", async () => {
    const c = mountShell({ sidebarCollapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    c.aside().dispatchEvent(POINTER_ENTER());
    await vi.advanceTimersByTimeAsync(400);
    expect(c.aside().hasAttribute("data-peeking")).toBe(true);

    const nav = c.slotParams[c.slotParams.length - 1]!.onNavigate;
    nav();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-peeking"), "navigate + close, like the drawer").toBe(false);
  });
});

describe("HkAdminShell forwarding (source pin)", () => {
  it("declares and forwards the rail prop family", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "HkAdminShell.tsx"),
      "utf8",
    ).replace(/\r\n/g, "\n");
    // Declared on the wrapper (the honest-forwarding rule)…
    for (const decl of [
      "sidebarCollapsible: { type: Boolean, default: false }",
      'sidebarCollapsedWidth: { type: String, default: "56px" }',
      "sidebarPeekDelay: { type: Number, default: 400 }",
      "sidebarPeekGrace: { type: Number, default: 150 }",
    ]) {
      expect(src, decl).toContain(decl);
    }
    // …and forwarded to the inner shell.
    expect(src).toContain("sidebarCollapsible: props.sidebarCollapsible,");
    expect(src).toContain("sidebarCollapsedWidth: props.sidebarCollapsedWidth,");
    expect(src).toContain("sidebarRailStyle: props.sidebarRailStyle,");
    expect(src).toContain("sidebarPeekDelay: props.sidebarPeekDelay,");
    expect(src).toContain("sidebarPeekGrace: props.sidebarPeekGrace,");
  });

  it("mounts the rail through the wrapper (behavior spot-check)", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(HkAdminShell, { sidebarCollapsible: true }, {
          header: () => null,
          sidebar: () => h("div", "NAV"),
          content: () => h("div", "CONTENT"),
        }),
    });
    app.mount(container);
    mounts.push({ app, container });
    expect(container.querySelector(".hk-sidebar-rail-host")).toBeTruthy();
    expect(container.querySelector(".hk-sidebar-rail-toggle button")).toBeTruthy();
  });
});
/** A pointermove with explicit viewport coordinates (the suppression
 *  wiring is purely geometric — see HkSidebarRailToggle's helper). */
function pointerMove(x: number, y: number): MouseEvent {
  const e = new MouseEvent("pointermove", { bubbles: true });
  Object.defineProperty(e, "clientX", { value: x });
  Object.defineProperty(e, "clientY", { value: y });
  return e;
}

/** A pointerenter carrying viewport coordinates — the host evaluates the
 *  toggle containment on ENTER, before it arms the dwell. */
function pointerEnterAt(x: number, y: number): MouseEvent {
  const e = new MouseEvent("pointerenter", { bubbles: true });
  Object.defineProperty(e, "clientX", { value: x });
  Object.defineProperty(e, "clientY", { value: y });
  return e;
}

/** A transitionend carrying the property name (happy-dom has no
 *  TransitionEvent; the host handler filters on `width`). */
function widthTransitionEnd(): Event {
  const e = new Event("transitionend");
  Object.defineProperty(e, "propertyName", { value: "width" });
  return e;
}

/** Pin the toggle wrapper's box — happy-dom lays nothing out. */
function stubToggleRect(container: HTMLElement, left: number, top: number, size = 24) {
  const el = container.querySelector(".hk-sidebar-rail-toggle") as HTMLElement;
  el.getBoundingClientRect = () =>
    ({
      left,
      top,
      right: left + size,
      bottom: top + size,
      width: size,
      height: size,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
}

describe("HkFaceShell rail chrome: toggle placement and the clip wrapper", () => {
  it("keeps the toggle a DIRECT child of the panel and the slot inside the clip", () => {
    const c = mountShell({ sidebarCollapsible: true });
    const panel = c.panel();
    const clip = panel.querySelector(":scope > .hk-sidebar-rail-clip") as HTMLElement | null;
    const toggle = panel.querySelector(":scope > .hk-sidebar-rail-toggle") as HTMLElement | null;

    expect(clip, "the slot's content clips inside the wrapper").toBeTruthy();
    expect(toggle, "the toggle is a direct child of the panel").toBeTruthy();
    expect(clip!.contains(toggle!), "the toggle is never inside the clip").toBe(false);
    expect(clip!.querySelector(".sidebar-mock"), "the sidebar slot renders in the clip").toBeTruthy();
  });

  it("hands the sidebar slot to the rail/full generations through the SWAP", async () => {
    // The density dress rides the swap's GENERATION, never the host root:
    // a root-level data-rail would restyle the frozen leaving generation
    // mid-dissolve and reintroduce the squeeze this wave fixes. The root
    // keeps data-rail as a STATE MARKER only (hosts/tests read it).
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", () => 0 as unknown as number);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const c = mountShell({ sidebarCollapsible: true });
    const clip = () =>
      c.panel().querySelector(":scope > .hk-sidebar-rail-clip") as HTMLElement;
    const gens = () =>
      Array.from(clip().querySelectorAll<HTMLElement>(".hk-sidebar-rail-generation"));

    expect(clip().querySelector(".hk-sidebar-rail-swap"), "the swap mounts inside the clip").toBeTruthy();
    expect(gens()).toHaveLength(1);
    expect(gens()[0]!.hasAttribute("data-rail"), "expanded carries no rail density").toBe(false);
    expect(gens()[0]!.style.width, "the generation pins the shell's sidebar width").toBe("224px");
    expect(c.aside().hasAttribute("data-rail")).toBe(false);

    c.toggle().click();
    await vi.advanceTimersByTimeAsync(100); // mid-dissolve
    const mid = gens();
    expect(mid.length, "both generations share the swap's cell").toBe(2);
    expect(mid[0]!.hasAttribute("data-rail"), "the leaving copy keeps the full dress").toBe(false);
    expect(mid[0]!.style.width).toBe("224px");
    expect(mid[1]!.hasAttribute("data-rail"), "the entering copy takes the rail dress").toBe(true);
    expect(mid[1]!.style.width, "the rail generation pins the collapsed width").toBe("56px");
    // The slot ran for the entering generation at its density; the root
    // marker reads rail while the DENSITY lives on the generation.
    expect(c.slotParams[c.slotParams.length - 1]!.collapsed).toBe(true);
    expect(c.aside().hasAttribute("data-rail"), "the root keeps the state marker").toBe(true);
    vi.unstubAllGlobals();
  });

  it("does not touch the legacy sidebar path (no clip wrapper, no rail classes)", () => {
    const c = mountShell();
    expect(c.container.querySelector(".hk-sidebar-rail-clip")).toBeFalsy();
    expect(c.container.querySelector(".hk-sidebar-rail-panel")).toBeFalsy();
    expect(c.container.querySelector(".sidebar-mock")).toBeTruthy();
  });
});

describe("HkFaceShell pin window: expand must not replay the slide", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("pins on a rail -> expanded flip and clears on the host width transition", async () => {
    const c = mountShell({ sidebarCollapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-pinning"), "collapsing never pins").toBe(false);

    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-pinning"), "the expand window is pinned").toBe(true);
    // The panel is already at its final width — only the host animates.
    expect(c.panel().style.width).toBe("224px");
    expect(c.aside().style.width).toBe("224px");

    c.aside().dispatchEvent(widthTransitionEnd());
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-pinning")).toBe(false);
  });

  it("clears the pin window by the fallback when no transition fires", async () => {
    const c = mountShell({ sidebarCollapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-pinning")).toBe(true);

    await vi.advanceTimersByTimeAsync(400);
    expect(c.aside().hasAttribute("data-pinning")).toBe(false);
  });

  it("collapsing closes an open pin window immediately", async () => {
    const c = mountShell({ sidebarCollapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-pinning")).toBe(true);

    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-pinning")).toBe(false);
    expect(c.aside().style.width).toBe("56px");
  });

  it("a child transitionend never ends the window (filtered to the host's width)", async () => {
    const c = mountShell({ sidebarCollapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);

    c.panel().dispatchEvent(widthTransitionEnd());
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-pinning")).toBe(true);
  });
});

describe("HkFaceShell hover suppression: a pointer on the toggle never peeks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("suppresses the dwell while the pointer rests on the toggle, re-arms when it moves off", async () => {
    const c = mountShell({ sidebarCollapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    stubToggleRect(c.container, 100, 200);

    c.aside().dispatchEvent(POINTER_ENTER());
    c.aside().dispatchEvent(pointerMove(110, 210));
    await vi.advanceTimersByTimeAsync(400 * 4);
    expect(c.aside().hasAttribute("data-peeking"), "parked on the toggle: no peek").toBe(false);
    expect(c.slotParams[c.slotParams.length - 1]!.collapsed).toBe(true);

    c.aside().dispatchEvent(pointerMove(400, 500));
    await vi.advanceTimersByTimeAsync(400);
    expect(c.aside().hasAttribute("data-peeking"), "off the toggle the peek arms normally").toBe(true);
    expect(c.slotParams[c.slotParams.length - 1]!.peeking).toBe(true);
  });

  it("evaluates suppression on ENTER: crossing the boundary onto the toggle arms nothing", async () => {
    const c = mountShell({ sidebarCollapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    stubToggleRect(c.container, 100, 200);

    c.aside().dispatchEvent(pointerEnterAt(110, 210));
    await vi.advanceTimersByTimeAsync(400 * 4);
    expect(c.aside().hasAttribute("data-peeking"), "enter on the toggle arms nothing").toBe(false);
    expect(c.slotParams[c.slotParams.length - 1]!.collapsed).toBe(true);
  });

  it("evaluates suppression on ENTER: entering elsewhere on the rail still peeks", async () => {
    const c = mountShell({ sidebarCollapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    stubToggleRect(c.container, 100, 200);

    c.aside().dispatchEvent(pointerEnterAt(400, 500));
    await vi.advanceTimersByTimeAsync(399);
    expect(c.aside().hasAttribute("data-peeking"), "one tick before the dwell").toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(c.aside().hasAttribute("data-peeking"), "off the toggle the enter arms the dwell").toBe(true);
  });

  it("ignores a pointerleave whose relatedTarget is still inside the host", async () => {
    const c = mountShell({ sidebarCollapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    c.aside().dispatchEvent(POINTER_ENTER());
    await vi.advanceTimersByTimeAsync(400);
    expect(c.aside().hasAttribute("data-peeking")).toBe(true);

    const churn = POINTER_LEAVE();
    Object.defineProperty(churn, "relatedTarget", { value: c.container.querySelector(".sidebar-mock") });
    c.aside().dispatchEvent(churn);
    await vi.advanceTimersByTimeAsync(150 * 4);
    expect(c.aside().hasAttribute("data-peeking"), "DOM churn is not a leave").toBe(true);

    c.aside().dispatchEvent(POINTER_LEAVE());
    await vi.advanceTimersByTimeAsync(150);
    expect(c.aside().hasAttribute("data-peeking")).toBe(false);
  });

  it("clicking the toggle during an open peek still pins the sidebar expanded", async () => {
    const c = mountShell({ sidebarCollapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    c.aside().dispatchEvent(POINTER_ENTER());
    await vi.advanceTimersByTimeAsync(400);
    expect(c.aside().hasAttribute("data-peeking")).toBe(true);

    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-peeking")).toBe(false);
    expect(c.aside().style.width).toBe("224px");
    expect(c.aside().hasAttribute("data-pinning"), "the peek pin is a rail -> expanded flip").toBe(true);
  });
});

/**
 * The menu group fold vs the swap's GENERATIONS (#43, known-live-issues).
 *
 * HkSidebarRailSwap mounts each density as a FRESH generation — the
 * tab-panel contract — so an HkMenu inside the sidebar slot is a NEW
 * component instance in every generation. HkMenu's own docs still promise
 * "a group collapsed in the rail is still collapsed after a peek/expand
 * (and vice versa)"; 0.55.239 broke that promise by keeping the fold in
 * instance-local refs, measured on chest (same chest source: 2 rows /
 * aria-expanded=false on 0.55.236, 5 rows / true on 0.55.239).
 *
 * The fix is a stable fold store provided ABOVE the swap: every
 * generation injects the same instance, so the user's word survives an
 * arbitrary number of remounts. These are the tests that go red when the
 * store stops being provided above the swap (or HkMenu stops reading it).
 */
const GROUP_ITEMS: HkMenuItem[] = [
  { key: "home", label: "Home" },
  {
    key: "admin",
    label: "Administration",
    children: [
      { key: "users", label: "Users" },
      { key: "audit", label: "Audit log" },
    ],
  },
];

/** The ACTIVE generation, selected by the key it renders under: the
 *  leaving copy is frozen at its last render (it still shows the OLD
 *  fold), so asserting against it would pass for the wrong reason. */
function generation(container: HTMLElement, key: "rail" | "full"): HTMLElement {
  const gen = container.querySelector<HTMLElement>(
    `.hk-crossfade-item[data-crossfade-key="${key}"]`,
  );
  expect(gen, `the ${key} generation renders`).toBeTruthy();
  return gen!;
}

/** The group header inside a generation — the rail and full forms share
 *  the same class + aria-expanded contract. */
function groupToggle(root: HTMLElement): HTMLButtonElement {
  const row = root.querySelector<HTMLButtonElement>("button.hk-menu-sidebar-group-toggle");
  expect(row, "the menu's group header renders").toBeTruthy();
  return row!;
}

/** Let a dissolve settle (past HkCrossfade's 450ms watchdog), then hand
 *  back the generation that should now be the only live one. */
async function settle(container: HTMLElement, key: "rail" | "full"): Promise<HTMLElement> {
  await vi.advanceTimersByTimeAsync(600);
  return generation(container, key);
}

describe("rail group fold survives the crossfade generations (#43)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("keeps a group collapsed in the rail through a peek AND a full expand", async () => {
    const c = mountShell({ sidebarCollapsible: true }, () =>
      h(HkMenu, {
        variant: "sidebar",
        items: GROUP_ITEMS,
        open: false,
        defaultExpandGroups: true,
      }),
    );
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);

    const railGen = await settle(c.container, "rail");
    expect(
      groupToggle(railGen).getAttribute("aria-expanded"),
      "table-of-contents default: every group starts open",
    ).toBe("true");
    groupToggle(railGen).click();
    await vi.advanceTimersByTimeAsync(0);
    expect(groupToggle(railGen).getAttribute("aria-expanded")).toBe("false");
    expect(railGen.textContent, "the closed group lists no children").not.toContain("Audit log");

    // Peek: the slot is handed FULL rows again — a brand-new HkMenu.
    c.aside().dispatchEvent(POINTER_ENTER());
    await vi.advanceTimersByTimeAsync(400);
    const peekGen = await settle(c.container, "full");
    expect(c.aside().hasAttribute("data-peeking"), "the peek is open").toBe(true);
    expect(
      groupToggle(peekGen).getAttribute("aria-expanded"),
      "the fold crosses into the peek's fresh generation",
    ).toBe("false");
    expect(peekGen.textContent, "and the peek lists no children either").not.toContain("Audit log");

    // Leave -> grace -> the rail generation mounts a THIRD time, closed.
    c.aside().dispatchEvent(POINTER_LEAVE());
    await vi.advanceTimersByTimeAsync(150);
    const backGen = await settle(c.container, "rail");
    expect(c.aside().hasAttribute("data-peeking")).toBe(false);
    expect(
      groupToggle(backGen).getAttribute("aria-expanded"),
      "the fold survives the return leg too",
    ).toBe("false");

    // A full EXPAND (not a peek) reads the same fold.
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    const expandedGen = await settle(c.container, "full");
    expect(
      groupToggle(expandedGen).getAttribute("aria-expanded"),
      "and the expanded sidebar inherits it",
    ).toBe("false");
  });

  it("does not let the active row's auto-expansion resurrect a rail-collapsed group", async () => {
    // The chest shape: the group holding the active row auto-opens on every
    // FRESH mount (the auto seed), which is exactly what brought the
    // collapsed group back. The user's word must outrank the re-seed.
    const c = mountShell({ sidebarCollapsible: true }, () =>
      h(HkMenu, {
        variant: "sidebar",
        items: GROUP_ITEMS,
        open: false,
        activeKey: "users",
      }),
    );
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);

    const railGen = await settle(c.container, "rail");
    expect(
      groupToggle(railGen).getAttribute("aria-expanded"),
      "the active row auto-opens its group",
    ).toBe("true");
    groupToggle(railGen).click();
    await vi.advanceTimersByTimeAsync(0);
    expect(groupToggle(railGen).getAttribute("aria-expanded")).toBe("false");

    c.aside().dispatchEvent(POINTER_ENTER());
    await vi.advanceTimersByTimeAsync(400);
    const peekGen = await settle(c.container, "full");
    expect(
      groupToggle(peekGen).getAttribute("aria-expanded"),
      "the fresh generation re-seeds its auto set but keeps the user's word",
    ).toBe("false");
  });

  it("shows NO expanded flash mid-dissolve, and never patches the leaving copy", async () => {
    // MEASURED contract, not an inference. happy-dom completes a CSS
    // transition with no duration instantly, so the leaving copy would be
    // gone before it could be inspected; freezing rAF holds the leave open
    // exactly the way a real browser holds it for --duration-normal (the
    // same technique the swap test above uses).
    const c = mountShell({ sidebarCollapsible: true }, () =>
      h(HkMenu, {
        variant: "sidebar",
        items: GROUP_ITEMS,
        open: false,
        defaultExpandGroups: true,
      }),
    );
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    const railGen = await settle(c.container, "rail");
    groupToggle(railGen).click();
    await vi.advanceTimersByTimeAsync(0);
    expect(groupToggle(railGen).getAttribute("aria-expanded")).toBe("false");

    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    c.aside().dispatchEvent(POINTER_ENTER());
    await vi.advanceTimersByTimeAsync(400);

    const copiesNow = () => Array.from(c.container.querySelectorAll<HTMLElement>(".hk-crossfade-item"));
    expect(
      copiesNow().map((el) => el.dataset.crossfadeKey),
      "both generations share the swap cell during the dissolve",
    ).toEqual(["rail", "full"]);
    expect(
      copiesNow().map((el) => groupToggle(el).getAttribute("aria-expanded")),
      "neither copy shows the group re-opened",
    ).toEqual(["false", "false"]);

    // Now write the shared store DURING the dissolve (a toggle in the live
    // copy). The live copy re-renders; the leaving one keeps the DOM of its
    // last render — the frozen copy is out of the patch path, which is what
    // makes the dissolve safe. Reading the frozen copy after the write is
    // the measurement of that claim.
    const live = copiesNow()[1]!;
    groupToggle(live).click();
    await vi.advanceTimersByTimeAsync(0);
    const afterWrite = copiesNow().map((el) => ({
      key: el.dataset.crossfadeKey,
      expanded: groupToggle(el).getAttribute("aria-expanded"),
    }));
    expect(afterWrite).toEqual([
      { key: "rail", expanded: "false" },
      { key: "full", expanded: "true" },
    ]);
    vi.unstubAllGlobals();

    // The open group is the shared word: the next rail generation after the
    // peek closes shows it open (nothing was silently reverted mid-swap).
    c.aside().dispatchEvent(POINTER_LEAVE());
    await vi.advanceTimersByTimeAsync(150);
    const backGen = await settle(c.container, "rail");
    expect(groupToggle(backGen).getAttribute("aria-expanded")).toBe("true");
  });

  it("shares the fold with the mobile drawer's menu (the provide sits above BOTH slots)", async () => {
    // The rail is not the only slot consumer: under the breakpoint the same
    // sidebar slot renders inside the drawer. The store is provided from
    // HkFaceShell's own setup, so the drawer's fresh HkMenu instance must
    // read the desktop rail's fold too — otherwise the rail would be fixed
    // while mobile silently loses it. (provide/inject follows the component
    // tree, so the real HDrawer's teleport does not change the provider —
    // this stub renders inline and still pins the channel.)
    const c = mountShell({ sidebarCollapsible: true }, () =>
      h(HkMenu, {
        variant: "sidebar",
        items: GROUP_ITEMS,
        open: false,
        defaultExpandGroups: true,
      }),
    );
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    const railGen = await settle(c.container, "rail");
    groupToggle(railGen).click();
    await vi.advanceTimersByTimeAsync(0);
    expect(groupToggle(railGen).getAttribute("aria-expanded"), "collapsed in the rail").toBe("false");

    // Phone width: the desktop sidebar unmounts, the drawer becomes the nav.
    window.innerWidth = 800;
    window.dispatchEvent(new Event("resize"));
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside(), "no desktop rail under the breakpoint").toBeFalsy();

    c.openDrawer();
    await vi.advanceTimersByTimeAsync(0);
    const drawerBody = c.container.querySelector(".drawer-stub-body") as HTMLElement;
    expect(drawerBody, "the drawer renders the sidebar slot").toBeTruthy();
    expect(
      groupToggle(drawerBody).getAttribute("aria-expanded"),
      "the drawer's menu reads the SAME fold",
    ).toBe("false");

    // And the other direction: opening it in the drawer is what the desktop
    // sidebar shows when the window grows back.
    groupToggle(drawerBody).click();
    await vi.advanceTimersByTimeAsync(0);
    expect(groupToggle(drawerBody).getAttribute("aria-expanded")).toBe("true");

    window.innerWidth = 1024;
    window.dispatchEvent(new Event("resize"));
    await vi.advanceTimersByTimeAsync(0);
    const desktopGen = await settle(c.container, "rail");
    expect(
      groupToggle(desktopGen).getAttribute("aria-expanded"),
      "the rail inherits the drawer's word",
    ).toBe("true");
  });
});
