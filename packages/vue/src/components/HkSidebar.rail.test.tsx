import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, ref } from "vue";

import HSidebar from "./HkSidebar";

/**
 * HkSidebar's own rail + peek surface (2026-10-30): the standalone panel
 * composes the SAME state machine (useSidebarRail) and the SAME geometry
 * classes (HkSidebarRail.scss) the shell uses — this file pins the
 * composition, the v-model channel (update:collapsed), and that the
 * legacy collapsed mode (no collapsible prop) renders byte-for-byte the
 * old widths. The machine's timing itself is pinned in
 * composables/useSidebarRail.test.ts.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

interface SidebarSlotParams {
  collapsed: boolean;
  peeking: boolean;
  closePeek: () => void;
}

function mountSidebar(props: Record<string, unknown> = {}) {
  const slotParams: SidebarSlotParams[] = [];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Harness = defineComponent({
    name: "SidebarHarness",
    setup() {
      const collapsed = ref((props.collapsed as boolean) ?? false);
      return () =>
        h(HSidebar, {
          ...props,
          collapsed: collapsed.value,
          "onUpdate:collapsed": (v: boolean) => {
            collapsed.value = v;
          },
        }, {
          default: (params: SidebarSlotParams) => {
            slotParams.push(params);
            return h("nav", {}, "NAV");
          },
        });
    },
  });
  const app = createApp(Harness);
  app.mount(container);
  mounts.push({ app, container });
  return {
    container,
    slotParams,
    aside: () => container.querySelector("aside.hk-sidebar") as HTMLElement,
    panel: () => container.querySelector("nav.hk-sidebar-panel") as HTMLElement,
    toggle: () => container.querySelector(".hk-sidebar-rail-toggle button") as HTMLButtonElement,
  };
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  vi.useRealTimers();
});

describe("HkSidebar rail capability", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("renders the LEGACY panel when not collapsible (widths unchanged)", () => {
    const full = mountSidebar({ width: "240px" });
    expect(full.aside().style.width).toBe("240px");
    expect(full.aside().className).not.toContain("hk-sidebar-rail-host");
    expect(full.toggle()).toBeFalsy();

    const legacyCollapsed = mountSidebar({ width: "240px", collapsed: true });
    // The historical 56px rail — byte-identical behavior.
    expect(legacyCollapsed.aside().style.width).toBe("56px");
    expect(legacyCollapsed.panel().style.width).toBe("56px");
    expect(legacyCollapsed.aside().className).not.toContain("hk-sidebar-rail-host");
  });

  it("collapses through the toggle into the rail host", async () => {
    const c = mountSidebar({ width: "240px", collapsible: true, collapsedWidth: "64px" });
    expect(c.aside().className).toContain("hk-sidebar-rail-host");
    expect(c.aside().style.width).toBe("240px");

    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().style.width).toBe("64px");
    expect(c.panel().style.width).toBe("64px");
    expect(c.aside().hasAttribute("data-collapsed")).toBe(true);
  });

  it("peeks as an overlay: the host width never moves", async () => {
    const c = mountSidebar({ width: "240px", collapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);

    c.aside().dispatchEvent(new Event("pointerenter"));
    await vi.advanceTimersByTimeAsync(400);
    expect(c.aside().hasAttribute("data-peeking")).toBe(true);
    expect(c.aside().style.width, "the LAYOUT footprint stays at rail width").toBe("56px");
    expect(c.panel().style.width, "the panel overlays at full width").toBe("240px");

    c.aside().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-peeking")).toBe(false);
    expect(c.panel().style.width).toBe("56px");
  });

  it("scopes the slot params live and drops data-collapsed during a peek", async () => {
    const c = mountSidebar({ width: "240px", collapsible: true });
    c.toggle().click();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.slotParams[c.slotParams.length - 1]!.collapsed).toBe(true);
    expect(c.slotParams[c.slotParams.length - 1]!.peeking).toBe(false);
    expect(c.aside().hasAttribute("data-collapsed"), "rail density while collapsed").toBe(true);

    c.aside().dispatchEvent(new Event("pointerenter"));
    await vi.advanceTimersByTimeAsync(400);
    expect(c.slotParams[c.slotParams.length - 1]!.collapsed, "full rows during the peek").toBe(false);
    expect(c.slotParams[c.slotParams.length - 1]!.peeking).toBe(true);
    expect(c.aside().hasAttribute("data-collapsed"), "no rail density on the peek panel").toBe(false);

    // closePeek (the nav-row hook) closes the drawer.
    c.slotParams[c.slotParams.length - 1]!.closePeek();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.aside().hasAttribute("data-peeking")).toBe(false);
    expect(c.slotParams[c.slotParams.length - 1]!.collapsed).toBe(true);
  });

  it("keeps the mobile drawer shape untouched (no rail chrome when mobile)", () => {
    const c = mountSidebar({ collapsible: true, mobile: true });
    expect(c.aside().style.width).toBe("");
    expect(c.aside().className).not.toContain("hk-sidebar-rail-host");
    expect(c.toggle()).toBeFalsy();
  });
});
