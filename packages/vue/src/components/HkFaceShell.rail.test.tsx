import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, ref } from "vue";

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
  emitted: string[];
}

function mountShell(props: Record<string, unknown> = {}): RailMount {
  const slotParams: SlotParams[] = [];
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
          header: () => null,
          sidebar: (params: SlotParams) => {
            slotParams.push(params);
            return h("div", { class: "sidebar-mock" }, "NAV");
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
    emitted,
  };
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
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
