import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkContextMenuProvider from "../components/HkContextMenuProvider";
import {
  bindContextMenu,
  CONTEXT_HOLD_MS,
  useContextMenu,
  useContextMenuTrigger,
  type ContextMenuApi,
  type ContextMenuRequest,
} from "./useContextMenu";

/** Mount into a detached div appended to the body (HkMenu tests see the
 * teleported popups through document.querySelectorAll). */
function mountToDom(component: ReturnType<typeof defineComponent>): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  createApp(component).mount(el);
  return el;
}

const popouts = () =>
  Array.from(document.querySelectorAll(".hk-select-popout")) as HTMLElement[];

const menuRows = () =>
  Array.from(document.querySelectorAll(".hk-menu-row")) as HTMLButtonElement[];

/** The provider host: opens a menu through the injected API on demand.
 * The consumer must be INSIDE the provider for the injection to flow. */
function makeProviderHost(onSelect: (key: string) => void) {
  const closed = vi.fn();
  const Inner = defineComponent({
    name: "ContextInner",
    setup() {
      const api = useContextMenu();
      const openIt = () =>
        api.open({
          x: 100,
          y: 80,
          title: "Test menu",
          items: [
            { key: "details", label: "Details" },
            { key: "delete", label: "Delete", danger: true },
          ],
          onSelect: (key) => onSelect(key),
          onClose: () => closed(),
        });
      return () => (
        <button class="open-btn" onClick={openIt}>
          open
        </button>
      );
    },
  });
  const Component = defineComponent({
    name: "ContextHost",
    setup() {
      return () => (
        <HkContextMenuProvider>
          <Inner />
        </HkContextMenuProvider>
      );
    },
  });
  return { Component, closed };
}

afterEach(() => {
  document
    .querySelectorAll(
      ".hk-select-popout, .hk-select-sheet-panel, .hk-select-sheet-scrim, .open-btn, [data-bind-target]",
    )
    .forEach((el) => el.remove());
  // HkMenu panels push back-guard history entries; leave a clean state
  // for the next test (same discipline as HkMenu.test).
  window.history.replaceState(null, "");
});

/** nextTick + a macrotask + nextTick — popouts mount/unmount through
 * transitions and history, so a single nextTick races them. */
async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

/** Wait until pred() holds (panel teardown settles asynchronously). */
async function until(pred: () => boolean, ms = 500): Promise<void> {
  const deadline = Date.now() + ms;
  while (!pred() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await nextTick();
  }
}

/** A recording stand-in for the injected API (bindContextMenu is a plain
 * DOM helper — no component scope needed to drive it). */
function mockApi() {
  const opens: ContextMenuRequest[] = [];
  let closes = 0;
  const api = {
    open: (req: ContextMenuRequest) => {
      opens.push(req);
    },
    close: () => {
      closes += 1;
    },
  };
  return { opens, closeCount: () => closes, api };
}

/**
 * The context-menu system: one provider-mounted menu surface driven by
 * an injected API, plus the three triggers (right-click, long-press,
 * keyboard menu key). The surface itself is HkMenu's — these tests pin
 * the ORCHESTRATION, not the menu's own rendering.
 */
describe("useContextMenu + HkContextMenuProvider", () => {
  it("opens a menu at the point through the injected API and reports the pick", async () => {
    const picked: string[] = [];
    const { Component, closed } = makeProviderHost((key) => picked.push(key));
    mountToDom(Component);
    expect(popouts()).toHaveLength(0);

    (document.querySelector(".open-btn") as HTMLElement).click();
    await settle();
    expect(popouts()).toHaveLength(1);

    const rows = menuRows();
    expect(rows.map((r) => r.textContent)).toContain("Delete");
    const del = rows.find((r) => r.textContent === "Delete")!;
    del.click();
    await settle();
    expect(picked).toEqual(["delete"]);
    // A selection is NOT a dismissal — onClose must stay silent (the
    // R1 M5 guard gap: nothing asserted this before).
    expect(closed).not.toHaveBeenCalled();
    await until(() => popouts().length === 0);
  });

  it("replaces an open menu with a fresh one (R2 NEW-MAJOR-1)", async () => {
    let api: ReturnType<typeof useContextMenu> | null = null;
    const Inner = defineComponent({
      name: "ReplaceInner",
      setup() {
        api = useContextMenu();
        const openA = () => {
          api!.open({
            x: 60,
            y: 60,
            title: "First",
            items: [
              { key: "a1", label: "Alpha One" },
              { key: "a2", label: "Alpha Two", children: [{ key: "a2a", label: "Nested" }] },
            ],
          });
        };
        const openBWhileOpen = () => {
          // The scenario: the menu is open, the user right-clicks
          // ANOTHER target — the provider must swap to the new menu,
          // not close into nothing.
          api!.open({
            x: 200,
            y: 60,
            title: "Second",
            items: [{ key: "b1", label: "Beta One" }],
          });
        };
        return () => (
          <div>
            <button class="open-btn" onClick={openA}>open</button>
            <button class="replace-btn" onClick={openBWhileOpen}>replace</button>
          </div>
        );
      },
    });
    const Host = defineComponent({
      setup() {
        return () => (
          <HkContextMenuProvider>
            <Inner />
          </HkContextMenuProvider>
        );
      },
    });
    mountToDom(Host);
    (document.querySelector(".open-btn") as HTMLElement).click();
    await settle();
    expect(menuRows().map((r) => r.textContent)).toContain("Alpha One");

    (document.querySelector(".replace-btn") as HTMLElement).click();
    await settle();
    // The replacement menu IS open and shows ITS items.
    expect(popouts().length).toBeGreaterThan(0);
    const labels = menuRows().map((r) => r.textContent);
    expect(labels).toContain("Beta One");
    expect(labels).not.toContain("Alpha One");
  });

  it("opens the LAST request when two opens race in one tick (R2 NEW-MINOR-1)", async () => {
    const Inner = defineComponent({
      name: "RaceInner",
      setup() {
        const api = useContextMenu();
        const race = () => {
          api.open({ x: 10, y: 10, title: "B", items: [{ key: "b1", label: "Racer B" }] });
          api.open({ x: 10, y: 10, title: "C", items: [{ key: "c1", label: "Racer C" }] });
        };
        return () => (
          <button class="open-btn" onClick={race}>open</button>
        );
      },
    });
    const Host = defineComponent({
      setup() {
        return () => (
          <HkContextMenuProvider>
            <Inner />
          </HkContextMenuProvider>
        );
      },
    });
    mountToDom(Host);
    (document.querySelector(".open-btn") as HTMLElement).click();
    await settle();
    // Exactly one menu, showing the newest request — from a fresh
    // instance (remount), not a half-updated one.
    expect(popouts()).toHaveLength(1);
    const labels = menuRows().map((r) => r.textContent);
    expect(labels).toContain("Racer C");
    expect(labels).not.toContain("Racer B");
  });

  it("remounts on a programmatic replace so a stale cascade cannot survive (R3 W4b)", async () => {
    let captured: ContextMenuApi | null = null;
    const Inner = defineComponent({
      name: "ProgrammaticReplaceInner",
      setup() {
        captured = useContextMenu();
        const openA = () => {
          captured!.open({
            x: 80,
            y: 80,
            title: "First",
            items: [
              { key: "a1", label: "Alpha One" },
              { key: "a2", label: "Alpha Two", children: [{ key: "a2a", label: "Nested" }] },
            ],
          });
        };
        return () => (
          <button class="open-btn" onClick={openA}>open</button>
        );
      },
    });
    const Host = defineComponent({
      setup() {
        return () => (
          <HkContextMenuProvider>
            <Inner />
          </HkContextMenuProvider>
        );
      },
    });
    mountToDom(Host);
    (document.querySelector(".open-btn") as HTMLElement).click();
    await settle();
    // Open the cascade: two panels live.
    menuRows().find((r) => r.textContent === "Alpha Two")!.click();
    await settle();
    expect(popouts().length).toBe(2);

    // Replace PROGRAMMATICALLY — no click that would first close the
    // menu via outside-click (that path hides the replace branch; the
    // canvas long-press opens land exactly here). The provider must
    // remount, so the open submenu state of the OLD menu cannot leak
    // into the new one.
    captured!.open({
      x: 120,
      y: 80,
      title: "Second",
      items: [{ key: "b1", label: "Beta One" }],
    });
    await settle();
    await until(() => popouts().length <= 1);
    expect(popouts()).toHaveLength(1);
    const labels = menuRows().map((r) => r.textContent);
    expect(labels).toContain("Beta One");
    expect(labels).not.toContain("Nested"); // the stale cascade is gone
  });

  it("keeps a menu the select handler opens (the finished menu's trailing close must not kill it)", async () => {
    const Inner = defineComponent({
      name: "ReopenInner",
      setup() {
        const api = useContextMenu();
        const phase = ref(0);
        const open = () => {
          phase.value = 1;
          api.open({
            x: 50,
            y: 50,
            title: "Step 1",
            items: [{ key: "go2", label: "Go step 2" }],
            onSelect: () => {
              phase.value = 2;
              // Reopen SYNCHRONOUSLY in the select callback — the old
              // menu's closeAll is still about to emit update:open.
              api.open({
                x: 50,
                y: 50,
                title: "Step 2",
                items: [{ key: "done", label: "Done" }],
              });
            },
          });
        };
        return () => (
          <button class="open-btn" onClick={open}>
            open
          </button>
        );
      },
    });
    const Host = defineComponent({
      setup() {
        return () => (
          <HkContextMenuProvider>
            <Inner />
          </HkContextMenuProvider>
        );
      },
    });
    mountToDom(Host);
    (document.querySelector(".open-btn") as HTMLElement).click();
    await settle();
    menuRows().find((r) => r.textContent === "Go step 2")!.click();
    await settle();
    // The second menu survived the first menu's trailing close.
    expect(popouts().length).toBe(1);
    expect(menuRows().map((r) => r.textContent)).toContain("Done");
  });

  it("falls back to a no-op API without a provider", () => {
    const seen: string[] = [];
    const Probe = defineComponent({
      setup() {
        const api = useContextMenu();
        seen.push(typeof api.open, typeof api.close);
        return () => h("div", "x");
      },
    });
    mountToDom(Probe);
    expect(seen).toEqual(["function", "function"]);
  });

  it("binds right-click: builds the request, opens, preventDefaults", () => {
    const target = document.createElement("div");
    target.setAttribute("data-bind-target", "");
    document.body.appendChild(target);

    const { opens, api } = mockApi();
    const built: string[] = [];
    const unbind = bindContextMenu(target, api, (point) => {
      built.push(point.kind);
      return {
        x: point.x,
        y: point.y,
        items: [{ key: "a", label: "A" }],
      };
    });

    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 40,
      clientY: 30,
    });
    target.dispatchEvent(event);
    expect(built).toEqual(["pointer"]);
    expect(opens).toHaveLength(1);
    expect(opens[0].x).toBe(40);
    expect(event.defaultPrevented).toBe(true);
    unbind();
  });

  it("lets a null build defer to outer bindings without preventing", () => {
    const target = document.createElement("div");
    target.setAttribute("data-bind-target", "");
    document.body.appendChild(target);
    const { api } = mockApi();
    const unbind = bindContextMenu(target, api, () => null);
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    unbind();
  });

  it("long-presses (touch) into a menu and suppresses the follow-up native event", () => {
    vi.useFakeTimers();
    try {
      const target = document.createElement("div");
      target.setAttribute("data-bind-target", "");
      document.body.appendChild(target);
      const { opens, api } = mockApi();
      const kinds: string[] = [];
      const unbind = bindContextMenu(target, api, (point) => {
        kinds.push(point.kind);
        return { x: point.x, y: point.y, items: [{ key: "a", label: "A" }] };
      });

      target.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: 10,
          clientY: 10,
        }),
      );
      vi.advanceTimersByTime(CONTEXT_HOLD_MS + 50);
      expect(kinds).toEqual(["longpress"]);
      expect(opens).toHaveLength(1);

      // The platform synthesizes a contextmenu right after the hold.
      const native = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(native);
      expect(kinds).toEqual(["longpress"]); // not re-opened
      expect(opens).toHaveLength(1);
      expect(native.defaultPrevented).toBe(true); // but still suppressed

      unbind();
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels the hold when the finger travels past the slop", () => {
    vi.useFakeTimers();
    try {
      const target = document.createElement("div");
      target.setAttribute("data-bind-target", "");
      document.body.appendChild(target);
      const { opens, api } = mockApi();
      const kinds: string[] = [];
      const unbind = bindContextMenu(target, api, (point) => {
        kinds.push(point.kind);
        return { x: point.x, y: point.y, items: [{ key: "a", label: "A" }] };
      });
      target.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: 10,
          clientY: 10,
        }),
      );
      target.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: 40,
          clientY: 10,
        }),
      );
      vi.advanceTimersByTime(CONTEXT_HOLD_MS + 50);
      expect(kinds).toEqual([]); // a scroll, not a press-and-hold
      expect(opens).toHaveLength(0);
      unbind();
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens on the keyboard menu key at the element's corner", () => {
    const target = document.createElement("div");
    target.setAttribute("data-bind-target", "");
    target.tabIndex = 0;
    document.body.appendChild(target);
    const { opens, api } = mockApi();
    const kinds: string[] = [];
    const unbind = bindContextMenu(target, api, (point) => {
      kinds.push(point.kind);
      return { x: point.x, y: point.y, items: [{ key: "a", label: "A" }] };
    });
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "ContextMenu",
    });
    target.dispatchEvent(event);
    expect(kinds).toEqual(["keyboard"]);
    expect(opens).toHaveLength(1);
    expect(event.defaultPrevented).toBe(true);
    unbind();
  });

  it("rebinds when the trigger element ref changes", async () => {
    const el1 = document.createElement("div");
    const el2 = document.createElement("div");
    el1.setAttribute("data-bind-target", "");
    el2.setAttribute("data-bind-target", "");
    document.body.append(el1, el2);
    const which: Element[] = [];
    const Host = defineComponent({
      setup() {
        const target = ref<HTMLElement | null>(el1);
        useContextMenuTrigger(target, (point) => {
          which.push(point.target as Element);
          return { x: point.x, y: point.y, items: [{ key: "a", label: "A" }] };
        });
        const swap = () => {
          target.value = el2;
        };
        return () => h("button", { class: "swap", onClick: swap }, "swap");
      },
    });
    mountToDom(Host);
    el1.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    expect(which).toEqual([el1]);
    (document.querySelector(".swap") as HTMLElement).click();
    await nextTick();
    el1.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    el2.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    expect(which).toEqual([el1, el2]); // el1 unbound, el2 bound
  });
});
