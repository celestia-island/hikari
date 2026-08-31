import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import type { ComponentPublicInstance } from "vue";

import HkSelectPanel from "./HkSelectPanel";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  // happy-dom never fires transitionend, so leave transitions never
  // finish and teleported panels linger on <body> — strip them or the
  // next test's querySelector sees this test's panel.
  document.body
    .querySelectorAll(".hk-popover-panel, .hk-popover-scrim, .hk-select-popout, .hk-select-popout-host, .hk-select-sheet-panel, .hk-select-sheet-scrim")
    .forEach((el) => el.remove());
  setViewport(1200);
});

function setViewport(width: number) {
  window.innerWidth = width;
  window.dispatchEvent(new Event("resize"));
}

/**
 * The custom-invocation rig: a plain button (NOT a dropdown trigger) that
 * anchors a panel filled with checkbox rows — the exact "not a dropdown,
 * but opens the dropdown's panel" shape downstream apps need.
 */
function mountPanel(props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const open = ref(false);
  const checked = ref(["a"]);
  const anchorEl = ref<HTMLElement | null>(null);
  const keydownSpy = vi.fn();
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h("div", [
          h(
            "button",
            {
              ref: (el: Element | ComponentPublicInstance | null) => {
                anchorEl.value = el as HTMLElement | null;
              },
              type: "button",
              onClick: () => { open.value = !open.value; },
            },
            "filter",
          ),
          h(
            HkSelectPanel,
            {
              open: open.value,
              "onUpdate:open": (v: boolean) => { open.value = v; },
              anchorRef: anchorEl.value,
              title: "Filters",
              placement: "top-start",
              onKeydown: keydownSpy,
              ...props,
            },
            {
              default: () =>
                ["a", "b"].map((k) =>
                  h("label", { class: "row", key: k }, [
                    h("input", {
                      type: "checkbox",
                      checked: checked.value.includes(k),
                      onChange: () => {
                        checked.value = checked.value.includes(k)
                          ? checked.value.filter((x) => x !== k)
                          : [...checked.value, k];
                      },
                    }),
                    k,
                  ]),
                ),
            },
          ),
        ]);
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return { open, checked, container, keydownSpy };
}

describe("HkSelectPanel custom invocation", () => {
  it("renders custom slot rows in an anchored popout on desktop", async () => {
    const { container } = mountPanel();
    await nextTick();

    container.querySelector<HTMLButtonElement>("button")!.click();
    await nextTick();

    const popout = document.body.querySelector<HTMLElement>(".hk-select-popout")!;
    expect(popout).toBeTruthy();
    expect(popout.querySelectorAll("label.row")).toHaveLength(2);
    // No sheet form on desktop widths.
    expect(document.body.querySelector(".hk-select-sheet-panel")).toBeNull();
  });

  it("keeps the panel open while rows toggle (no auto-close)", async () => {
    const { container, open } = mountPanel();
    await nextTick();

    container.querySelector<HTMLButtonElement>("button")!.click();
    await nextTick();

    const box = document.body.querySelector<HTMLInputElement>(".hk-select-popout label.row input")!;
    box.click();
    await nextTick();
    expect(open.value).toBe(true);
  });

  it("scrolling through the overlay track does not dismiss the popout", async () => {
    const { container, open } = mountPanel();
    await nextTick();

    container.querySelector<HTMLButtonElement>("button")!.click();
    await nextTick();
    await nextTick(); // the overlay attaches on a post-open nextTick

    // The track is appended to the fixed HOST wrapper — a sibling of the
    // popout panel, NOT contained by it. A click there (which reaches the
    // capture-phase document dismissal listener before any track handler)
    // must read as inside the panel, exactly like the native scrollbar it
    // replaced — native bars never emit page-visible clicks.
    const track = document.body.querySelector<HTMLElement>(
      ".hk-select-popout-host > .hk-scrollbar-track",
    );
    expect(track).toBeTruthy();
    track!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(open.value).toBe(true);
  });

  it("closes on outside click but not on row clicks", async () => {
    const { open } = mountPanel();
    await nextTick();
    open.value = true;
    await nextTick();

    document.body.querySelector<HTMLElement>(".hk-select-popout label.row")!.click();
    await nextTick();
    expect(open.value).toBe(true);

    const outside = document.createElement("div");
    document.body.appendChild(outside);
    outside.click();
    await nextTick();
    expect(open.value).toBe(false);
    outside.remove();
  });

  it("forwards surface keydown to the owner and closes on surface Escape only", async () => {
    const { open, keydownSpy } = mountPanel();
    await nextTick();
    open.value = true;
    await nextTick();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(keydownSpy).not.toHaveBeenCalled(); // document-level ≠ panel surface

    document.body
      .querySelector<HTMLElement>(".hk-select-popout")!
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );
    expect(keydownSpy).toHaveBeenCalled();

    // Escape on an unrelated input must NOT close the panel (no
    // document-capture listener — Escape is surface-attached).
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await nextTick();
    expect(open.value).toBe(true);

    document.body
      .querySelector<HTMLElement>(".hk-select-popout")!
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    await nextTick();
    expect(open.value).toBe(false);
  });

  it("docks as a titled bottom sheet on mobile widths", async () => {
    setViewport(375);
    const { open } = mountPanel();
    await nextTick();
    open.value = true;
    await nextTick();

    const sheet = document.body.querySelector<HTMLElement>(".hk-select-sheet-panel")!;
    expect(sheet).toBeTruthy();
    expect(sheet.getAttribute("aria-modal")).toBe("true");
    expect(sheet.querySelector(".hk-select-sheet-title")!.textContent).toBe("Filters");
    expect(sheet.querySelectorAll("label.row")).toHaveLength(2);
    expect(document.body.querySelector(".hk-select-popout")).toBeNull();

    (document.body.querySelector<HTMLElement>(".hk-select-sheet-scrim"))!.click();
    await nextTick();
    expect(open.value).toBe(false);
  });

  it("keeps the sheet mounted through its close so the leave transition runs", async () => {
    setViewport(375);
    const { open } = mountPanel();
    await nextTick();
    open.value = true;
    await nextTick();

    const panel = document.body.querySelector<HTMLElement>(".hk-select-sheet-panel")!;
    expect(panel).toBeTruthy();

    open.value = false;
    await nextTick();
    // happy-dom never finishes leave transitions, so the panel lingers —
    // exactly what a running slide-down leave looks like. A synchronous
    // unmount (the regression this guards against) removes it instantly.
    expect(document.body.querySelector(".hk-select-sheet-panel")).toBeTruthy();
  });

  it("registers with the popup manager when mounted already open", async () => {
    // immediate:true — a panel mounted with open=true must land in the
    // z band (handle z ≥ 1000), not the unregistered fallback.
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const open = ref(true);
    const anchorEl = ref<HTMLElement | null>(null);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h("div", [
            h("button", {
              ref: (el: Element | ComponentPublicInstance | null) => {
                anchorEl.value = el as HTMLElement | null;
              },
              type: "button",
            }, "anchor"),
            h(
              HkSelectPanel,
              {
                open: open.value,
                "onUpdate:open": (v: boolean) => { open.value = v; },
                anchorRef: anchorEl.value,
                title: "Filters",
              },
              { default: () => h("label", { class: "row" }, "row") },
            ),
          ]);
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await nextTick();

    // Inline geometry (coords + popup-manager z) lives on the fixed
    // positioning wrapper that hosts the overlay scrollbar tracks.
    const host = document.body.querySelector<HTMLElement>(".hk-select-popout-host")!;
    expect(host).toBeTruthy();
    const z = Number.parseInt(host.style.zIndex, 10);
    expect(z).toBeGreaterThanOrEqual(1000);
  });

  it("places a top-start popout above the anchor and flips when cramped", async () => {
    const { container, open } = mountPanel();
    await nextTick();

    const anchor = container.querySelector<HTMLButtonElement>("button")!;
    anchor.getBoundingClientRect = () =>
      ({ top: 500, bottom: 520, left: 40, right: 140, width: 100, height: 20 }) as DOMRect;
    open.value = true;
    await nextTick();

    const host = document.body.querySelector<HTMLElement>(".hk-select-popout-host")!;
    const top = Number.parseInt(host.style.top, 10);
    // Anchor bottom at 520 → a top-start panel sits above 520 (minus offset).
    expect(top).toBeLessThan(520);
    expect(host.style.minWidth).toBe("100px");

    // Starved top side flips the panel below the anchor instead.
    anchor.getBoundingClientRect = () =>
      ({ top: 0, bottom: 8, left: 40, right: 140, width: 100, height: 8 }) as DOMRect;
    window.dispatchEvent(new Event("resize"));
    await nextTick();
    const flipped = Number.parseInt(host.style.top, 10);
    expect(flipped).toBeGreaterThan(8);
  });

  it("clamps a tall flipped popout into the viewport instead of going negative", async () => {
    // The taller viewport-relative CSS cap admits ~576px panels: anchored
    // mid-viewport (top 380 / bottom 424 on an 800px-tall viewport), a
    // bottom-start panel cannot fit below (428 + 576 > 792) and flips
    // top-side into 380 - 4 - 576 = -200 — the single flip never
    // re-checks, and the raw negative top used to be applied verbatim.
    const prevHeight = window.innerHeight;
    window.innerHeight = 800;
    try {
      const { container, open } = mountPanel({ placement: "bottom-start" });
      await nextTick();

      const anchor = container.querySelector<HTMLButtonElement>("button")!;
      anchor.getBoundingClientRect = () =>
        ({ top: 380, bottom: 424, left: 40, right: 140, width: 100, height: 44 }) as DOMRect;
      open.value = true;
      await nextTick();

      const popout = document.body.querySelector<HTMLElement>(".hk-select-popout")!;
      const host = document.body.querySelector<HTMLElement>(".hk-select-popout-host")!;
      // happy-dom lays nothing out (offsetHeight 0 → the 200px fallback in
      // positionPanel), so fake the near-max-height box the new cap allows
      // and re-run geometry via the same resize path the cramped test uses.
      // (positionPanel measures the popout; the applied coords land on the
      // host wrapper.)
      Object.defineProperty(popout, "offsetHeight", { value: 576, configurable: true });
      window.dispatchEvent(new Event("resize"));
      await nextTick();

      const top = Number.parseInt(host.style.top, 10);
      // Whole panel on-screen: top edge at/inside the viewport pad and the
      // bottom edge inside it too — overflow beyond that is the panel's
      // own internal scroll, never off-screen geometry.
      expect(top).toBeGreaterThanOrEqual(8);
      expect(top + 576).toBeLessThanOrEqual(800 - 8);
    } finally {
      window.innerHeight = prevHeight;
    }
  });
});

describe("HkSelectPanel back-guard (window-first back priority)", () => {
  /** nextTick + one macrotask: lets deferred rewinds (setTimeout 0) flush. */
  async function settle(): Promise<void> {
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }

  /** Wait until pred() holds (history navigation settles asynchronously). */
  async function until(pred: () => boolean, ms = 500): Promise<void> {
    const deadline = Date.now() + ms;
    while (!pred() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await nextTick();
    }
  }

  it("back closes the open panel instead of navigating the page", async () => {
    const { open, container } = mountPanel();
    await nextTick();
    container.querySelector<HTMLButtonElement>("button")!.click();
    await settle();

    // The open panel owns one marked history entry above the page base.
    expect(
      (window.history.state as Record<string, unknown>)?.__hkBack,
    ).toEqual(expect.any(String));

    // Browser/system back: closes the panel, stays on the page.
    window.history.back();
    await until(() => open.value === false);
    await until(() => window.history.state === null);
    expect(open.value).toBe(false);
  });

  it("closing via outside click rewinds the pushed entry (no dead back)", async () => {
    const { open, container } = mountPanel();
    await nextTick();
    container.querySelector<HTMLButtonElement>("button")!.click();
    await settle();
    expect(
      (window.history.state as Record<string, unknown>)?.__hkBack,
    ).toEqual(expect.any(String));

    // An ordinary close (outside click) rewinds the entry so no dead
    // back remains — assert BOTH the logical close and the history base,
    // so a broken rewind fails loudly instead of timing out silently.
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    outside.click();
    outside.remove();
    await until(() => open.value === false);
    expect(open.value).toBe(false);
    await until(() => window.history.state === null);
    expect(window.history.state).toBeNull();
  });

  it("unmounting an open panel rewinds its entry (no stranded marker)", async () => {
    const { container } = mountPanel();
    await nextTick();
    container.querySelector<HTMLButtonElement>("button")!.click();
    await settle();
    expect(
      (window.history.state as Record<string, unknown>)?.__hkBack,
    ).toEqual(expect.any(String));

    // Unmount (e.g. route change) must not strand a dead marker entry.
    const app = mounts.pop()!;
    app.unmount();
    await settle();
    await until(() => window.history.state === null);
    expect(window.history.state).toBeNull();
  });

  it("a same-tick close→reopen keeps the reopened panel guarded", async () => {
    const { open, container } = mountPanel();
    await nextTick();
    container.querySelector<HTMLButtonElement>("button")!.click();
    await settle();

    // Close, let the watcher's close branch run (release claims the
    // rewind), then reopen before the deferred flush fires — the flush
    // must not consume the freshly pushed entry: after it settles the
    // reopened panel still owns exactly one marked entry.
    open.value = false;
    await nextTick();
    open.value = true;
    await settle();
    const st = window.history.state as Record<string, unknown> | null;
    expect(st?.__hkBack).toEqual(expect.any(String));

    // And the back gesture still closes it (not the page).
    window.history.back();
    await until(() => open.value === false);
    expect(open.value).toBe(false);
    await until(() => window.history.state === null);
    expect(window.history.state).toBeNull();
  });
});

describe("HkSelectPanel mobile-sheet duplicate-title filter", () => {
  /** Composition-mode rig with a reactive title and arbitrary slot
   *  content — the shape HkMenu pickers render on phones. */
  function mountSheet(opts: {
    title?: ReturnType<typeof ref<string>>;
    slot?: () => unknown;
  } = {}) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const open = ref(false);
    const anchorEl = ref<HTMLElement | null>(null);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h("div", [
            h("button", {
              ref: (el: Element | ComponentPublicInstance | null) => {
                anchorEl.value = el as HTMLElement | null;
              },
              type: "button",
            }, "anchor"),
            h(
              HkSelectPanel,
              {
                open: open.value,
                "onUpdate:open": (v: boolean) => { open.value = v; },
                anchorRef: anchorEl.value,
                title: opts.title?.value ?? "Workspaces",
              },
              { default: opts.slot ?? (() => h("div", { class: "rows" }, "rows")) },
            ),
          ]);
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    return { open, container };
  }

  /** Mobile viewport + open, settled past the post-open nextTick sync. */
  async function openSheet(open: ReturnType<typeof ref<boolean>>): Promise<void> {
    setViewport(375);
    await nextTick();
    open.value = true;
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }

  it("hides a leading in-content heading that repeats the sheet title", async () => {
    const { open } = mountSheet({
      slot: () =>
        h("div", { class: "menu" }, [
          h("div", { class: "menu-label" }, "Workspaces"),
          h("div", { class: "hint" }, "No workspaces found."),
        ]),
    });
    await openSheet(open);

    const list = document.body.querySelector<HTMLElement>(".hk-select-sheet-list")!;
    // The repeated heading is filtered; the rest of the content stays.
    expect(list.querySelector<HTMLElement>(".menu-label")!.classList.contains("hk-sheet-dup-title")).toBe(true);
    expect(list.querySelector<HTMLElement>(".hint")!.classList.contains("hk-sheet-dup-title")).toBe(false);
    // The sheet header still names the sheet.
    expect(document.body.querySelector<HTMLElement>(".hk-select-sheet-title")!.textContent).toBe("Workspaces");
  });

  it("keeps headings that merely contain the title and non-matching text", async () => {
    const { open } = mountSheet({
      slot: () =>
        h("div", { class: "menu" }, [
          h("div", { class: "menu-label" }, "Workspaces and devices"),
          h("div", { class: "hint" }, "pick one"),
        ]),
    });
    await openSheet(open);

    const list = document.body.querySelector<HTMLElement>(".hk-select-sheet-list")!;
    // Partial ("contains") matches are real content — only an exact,
    // non-interactive match hides.
    expect(list.querySelector<HTMLElement>(".menu-label")!.classList.contains("hk-sheet-dup-title")).toBe(false);
    expect(list.querySelector<HTMLElement>(".hint")!.classList.contains("hk-sheet-dup-title")).toBe(false);
  });

  it("never hides interactive rows or option blocks that say the title", async () => {
    const { open } = mountSheet({
      slot: () =>
        h("div", { class: "menu" }, [
          h("button", { class: "row", type: "button" }, "Workspaces"),
          h("div", { class: "hk-select-option" }, "Workspaces"),
          h("div", { class: "hk-menu-row" }, "Workspaces"),
        ]),
    });
    await openSheet(open);

    for (const sel of ["button.row", ".hk-select-option", ".hk-menu-row"]) {
      const el = document.body.querySelector<HTMLElement>(`.hk-select-sheet-list ${sel}`)!;
      expect(el.classList.contains("hk-sheet-dup-title")).toBe(false);
    }
  });

  it("does not hide a wrapper whose text matches only via a contained row", async () => {
    // Data-driven HkMenu shape: a menu level wrapping a single row whose
    // label equals the title — the wrapper must survive with its row.
    const { open } = mountSheet({
      slot: () =>
        h("div", { class: "hk-menu-level", role: "menu" }, [
          h("button", { class: "hk-menu-row", type: "button" }, "Workspaces"),
        ]),
    });
    await openSheet(open);

    const list = document.body.querySelector<HTMLElement>(".hk-select-sheet-list")!;
    expect(list.querySelector<HTMLElement>(".hk-menu-level")!.classList.contains("hk-sheet-dup-title")).toBe(false);
    expect(list.querySelector<HTMLElement>("button.hk-menu-row")!.classList.contains("hk-sheet-dup-title")).toBe(false);
  });

  it("keeps the in-content heading on the desktop popout (no dedupe there)", async () => {
    setViewport(1200);
    const { open } = mountSheet({
      slot: () => h("div", { class: "menu-label" }, "Workspaces"),
    });
    await nextTick();
    open.value = true;
    await nextTick();

    const popout = document.body.querySelector<HTMLElement>(".hk-select-popout")!;
    expect(popout.querySelector<HTMLElement>(".menu-label")!.classList.contains("hk-sheet-dup-title")).toBe(false);
  });

  it("re-syncs when late content adds a duplicate heading while open", async () => {
    const { open } = mountSheet({
      slot: () => h("div", { class: "hint" }, "loading…"),
    });
    await openSheet(open);

    const list = document.body.querySelector<HTMLElement>(".hk-select-sheet-list")!;
    const late = document.createElement("div");
    late.className = "menu-label";
    late.textContent = "Workspaces";
    list.appendChild(late);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
    expect(late.classList.contains("hk-sheet-dup-title")).toBe(true);
  });

  it("restores the hidden heading when the open sheet is retitled", async () => {
    const title = ref("Workspaces");
    const { open } = mountSheet({
      title,
      slot: () => h("div", { class: "menu-label" }, "Workspaces"),
    });
    await openSheet(open);
    const label = document.body.querySelector<HTMLElement>(".hk-select-sheet-list .menu-label")!;
    expect(label.classList.contains("hk-sheet-dup-title")).toBe(true);

    title.value = "Devices";
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
    expect(label.classList.contains("hk-sheet-dup-title")).toBe(false);
  });
});
