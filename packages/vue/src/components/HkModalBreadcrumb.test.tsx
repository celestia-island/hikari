import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, nextTick } from "vue";

import HkModalBreadcrumb from "./HkModalBreadcrumb";
import { usePopupManager } from "../runtime/usePopupManager";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];
// The registry is a module singleton shared with the strip.
const manager = usePopupManager();
const originalWidth = window.innerWidth;

afterEach(async () => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  for (const entry of [...manager.registry.value.values()]) {
    manager.unregister(entry.id);
  }
  document.body.style.overflow = "";
  window.innerWidth = originalWidth;
  // happy-dom never fires transitionend, so a popover's leave never settles
  // and its teleported panel lingers on <body> — strip it, or the next
  // test's querySelector finds this test's menu.
  document.body
    .querySelectorAll(".hk-popover-panel, .hk-popover-scrim, .hk-popover-backdrop")
    .forEach((el) => el.remove());
});

/** Lend the layout-less test DOM a box model for one test: every element
 *  reports a fixed width, so the strip's MEASUREMENT path (not just its
 *  text estimate) can be exercised. */
function stubWidths(widthOf: (el: HTMLElement) => number): () => void {
  const original = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const rect = original.call(this);
    const width = widthOf(this);
    return { ...rect, width, right: rect.left + width } as DOMRect;
  };
  return () => {
    HTMLElement.prototype.getBoundingClientRect = original;
  };
}

function setViewport(width: number): void {
  window.innerWidth = width;
  window.dispatchEvent(new Event("resize"));
}

async function mountStrip(props: Record<string, unknown> = {}): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const app = createApp(HkModalBreadcrumb, props);
  mounts.push(app);
  app.mount(container);
  await nextTick();
  await nextTick();
}

function strip(): HTMLElement | null {
  return document.querySelector("nav.hk-modal-breadcrumb");
}

/** Visible crumbs only: the strip also carries an off-screen measurement
 *  clone of EVERY layer (its own ruler), which shares the crumb classes. */
function visibleCrumbs(): HTMLElement[] {
  const nav = strip();
  if (!nav) return [];
  return [...nav.querySelectorAll<HTMLElement>(":scope > .hk-modal-breadcrumb-crumb")];
}

/** What a crumb RENDERS — a cut label also carries its full name in a
 *  screen-reader-only span, which textContent would concatenate. */
function itemText(item: Element | null): string {
  if (!item) return "";
  return item.querySelector('[aria-hidden="true"]')?.textContent ?? item.textContent ?? "";
}

function labels(): string[] {
  // The "…" trigger is a crumb too and carries no layer name: labels are
  // exactly the crumbs that name a layer.
  return visibleCrumbs()
    .map((crumb) => crumb.querySelector(".hk-modal-breadcrumb-item"))
    .filter((item): item is Element => item !== null)
    .map(itemText);
}

function more(): HTMLButtonElement | null {
  return strip()?.querySelector<HTMLButtonElement>("button.hk-modal-breadcrumb-more") ?? null;
}

function menuRows(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>(".hk-menu-action-item")];
}

const LONG = "【e2e-w0-002310】自动化测试流水线冒烟：请巡检当前氢站电解槽压力与温度状态";
const LONG_TAIL = "【e2e-w0-002310】…";

/** A stack that outgrows any viewport this suite uses: every label is cut to
 *  the 10-unit budget, and eight of them never fit on one line. */
const STACK_TITLES = [
  LONG,
  "第二个很长的层级标题占位一二三四",
  "第三个很长的层级标题占位一二三四",
  "第四个很长的层级标题占位一二三四",
  "第五个很长的层级标题占位一二三四",
  "第六个很长的层级标题占位一二三四",
  "第七个很长的层级标题占位一二三四",
  "第八个很长的层级标题占位一二三四",
];

describe("HkModalBreadcrumb window-stack policy", () => {
  it("treats an anchored desktop menu as a hidden level", async () => {
    // Theme window + an untitled anchor-attached popover (blocking=false):
    // the popover is not a window the user navigates, so a single-window
    // situation stays strip-less.
    manager.register("modal", true, "Custom theme");
    manager.register("dropdown", false);
    await mountStrip();
    expect(strip()).toBeNull();
  });

  it("lists a menu only while it blocks as a mobile bottom sheet", async () => {
    manager.register("modal", true, "Custom theme");
    const popup = manager.register("dropdown", false, "Pick a color", true);
    await mountStrip();
    expect(labels()).toEqual(["Custom theme", "Pick a color"]);
    // The sheet paints above the window, so it is the current crumb.
    expect(
      strip()!.querySelector(".hk-modal-breadcrumb-item-current")!.textContent,
    ).toBe("Pick a color");

    // Morphing back to an anchored popover (blocking=false) removes the
    // level instead of leaving a stale crumb behind.
    manager.setBlocking(popup.id, false);
    await nextTick();
    expect(strip()).toBeNull();
  });

  it("never falls back to a bare Layer N label", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      // Untitled window + untitled blocking sheet: the strip must use the
      // localized generic labels ("Window" / "Menu" in en), not "Layer N".
      manager.register("modal", true);
      manager.register("dropdown", false, undefined, true);
      await mountStrip();
      expect(labels()).toEqual(["Window", "Menu"]);
      expect(labels().join(" ")).not.toMatch(/Layer/);
    } finally {
      warn.mockRestore();
    }
  });

  it("orders crumbs by z and names the strip for assistive tech", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const win = manager.register("modal", true, "Settings");
      const drawer = manager.register("drawer", true, "Details");
      expect(drawer.zIndex).toBeGreaterThan(win.zIndex); // same band, later slot
      await mountStrip();
      // In-band order is open order: the later drawer sits on top.
      expect(labels()).toEqual(["Settings", "Details"]);
      expect(strip()!.getAttribute("aria-label")).toBe("Window layers");
    } finally {
      warn.mockRestore();
    }
  });

  it("exposes the registry entry shape the strip reads", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const handle = manager.register("dropdown", false, "Sheet", true);
      const entry = manager.registry.value.get(handle.id);
      expect(entry).toMatchObject({ kind: "dropdown", title: "Sheet", blocking: true });
    } finally {
      warn.mockRestore();
    }
  });
});

describe("HkModalBreadcrumb label budget", () => {
  it("cuts a label at the full-width unit budget and closes it with an ellipsis", async () => {
    // 11 ideographs, cap 10: nine glyphs + the ellipsis (the ellipsis counts
    // inside the budget, so a label never renders wider than ten).
    manager.register("modal", true, "自动化测试流水线冒烟请");
    manager.register("modal", true, "细节");
    await mountStrip();
    expect(labels()).toEqual(["自动化测试流水线冒…", "细节"]);
  });

  it("leaves a label that already fits byte-for-byte", async () => {
    // Exactly ten ideographs — the budget is a maximum, not a cut point.
    manager.register("modal", true, "自动化测试流水线冒烟");
    manager.register("modal", true, "细节");
    await mountStrip();
    expect(labels()).toEqual(["自动化测试流水线冒烟", "细节"]);
  });

  it("counts a Latin glyph as half a full-width glyph", async () => {
    // 20 half-width glyphs = 10 units: fits. 21 = 10.5: cut to 19 + ellipsis.
    manager.register("modal", true, "abcdefghijklmnopqrst");
    manager.register("modal", true, "abcdefghijklmnopqrstu");
    await mountStrip();
    expect(labels()).toEqual(["abcdefghijklmnopqrst", "abcdefghijklmnopqr…"]);
  });

  it("keeps the whole layer name for assistive tech when it cuts", async () => {
    manager.register("modal", true, LONG);
    manager.register("modal", true, "细节");
    await mountStrip();
    const nav = strip()!;
    const first = nav.querySelector<HTMLElement>(
      ":scope > .hk-modal-breadcrumb-crumb .hk-modal-breadcrumb-item",
    )!;
    expect(first.querySelector('[aria-hidden="true"]')!.textContent).toBe(LONG_TAIL);
    expect(first.querySelector(".hk-modal-breadcrumb-sr-only")!.textContent).toBe(LONG);
    // The measurement clone must never join the a11y tree.
    expect(
      nav.querySelector(".hk-modal-breadcrumb-measure")!.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("honours a narrower budget from the host", async () => {
    manager.register("modal", true, "自动化测试流水线冒烟");
    manager.register("modal", true, "细节");
    await mountStrip({ maxLabelUnits: 4 });
    expect(labels()).toEqual(["自动化…", "细节"]);
  });
});

describe("HkModalBreadcrumb overflow fold", () => {
  it("keeps every layer while the stack fits", async () => {
    setViewport(1200);
    manager.register("modal", true, "Settings");
    manager.register("modal", true, "Details");
    await mountStrip();
    expect(more()).toBeNull();
    expect(labels()).toEqual(["Settings", "Details"]);
    // A separators-only grammar: chevrons BETWEEN crumbs, never leading.
    const crumbs = visibleCrumbs();
    expect(crumbs[0].querySelector(".hk-modal-breadcrumb-sep")).toBeNull();
    expect(crumbs[1].querySelector(".hk-modal-breadcrumb-sep")).not.toBeNull();
  });

  it("folds the leading layers into a … trigger on a narrow viewport", async () => {
    setViewport(360);
    manager.register("modal", true, "第一层标题占位");
    manager.register("modal", true, "第二层标题占位");
    manager.register("modal", true, "第三层标题占位");
    manager.register("modal", true, "第四层标题占位");
    await mountStrip();
    const tail = labels();
    expect(more()).not.toBeNull();
    // The current layer is never folded away, and the visible tail is the
    // TRUE suffix of the stack (leading layers fold, order is untouched).
    expect(tail.length).toBeGreaterThanOrEqual(1);
    expect(tail[tail.length - 1]).toBe("第四层标题占位");
    expect(tail.length).toBeLessThan(4);
    // The first crumb after the trigger still carries its chevron.
    expect(visibleCrumbs()[1].querySelector(".hk-modal-breadcrumb-sep")).not.toBeNull();
  });

  it("folds on MEASURED widths — a stack the estimate would fit still folds", async () => {
    // The type-size estimate says three 3-ideograph labels take ~150px and
    // fit a 600px viewport; the DOM says each renders 200px. The strip must
    // trust the DOM — this is the real-font path the estimate only backs up.
    setViewport(600);
    manager.register("modal", true, "第一层");
    manager.register("modal", true, "第二层");
    manager.register("modal", true, "第三层");
    const restore = stubWidths(() => 200);
    try {
      await mountStrip();
      expect(more()).not.toBeNull();
      expect(labels()).toEqual(["第三层"]);
    } finally {
      restore();
    }
  });

  it("keeps a stack the estimate would fold when the DOM says it fits", async () => {
    setViewport(360);
    manager.register("modal", true, "自动化测试流水线冒烟");
    manager.register("modal", true, "自动化测试流水线冒烟");
    manager.register("modal", true, "自动化测试流水线冒烟");
    // Ten ideographs per label: the estimate (120px + chevron each) folds
    // two of them away. A narrow rendering font makes them 60px each.
    const restore = stubWidths(() => 60);
    try {
      await mountStrip();
      expect(more()).toBeNull();
      expect(labels()).toHaveLength(3);
    } finally {
      restore();
    }
  });

  it("derives its fence AND its budget through a host root zoom", async () => {
    // chest scales the app root by hand. The strip is teleported to <body>
    // (inside that zoomed subtree), so both its own px and the shared gutter
    // scale at paint while the viewport and every rect stay visual: neither
    // the fence nor the fold budget may be taken literally.
    setViewport(1200);
    const zoom = 2;
    const original = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      (el: Element, pseudo?: string | null): CSSStyleDeclaration => {
        const decl = original(el, pseudo ?? undefined);
        return new Proxy(decl, {
          get(target, prop, recv) {
            if (prop === "zoom") return el === document.documentElement ? String(zoom) : undefined;
            const v = Reflect.get(target, prop, recv);
            return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
          },
        });
      },
    );
    manager.register("modal", true, "第一层");
    manager.register("modal", true, "第二层");
    const restore = stubWidths((el) =>
      el.classList.contains("hk-modal-breadcrumb-more") ? 24 : 500,
    );
    try {
      await mountStrip();
      // (1200 − 2 · 16local · 2zoom) / 2zoom
      expect(strip()!.style.maxWidth).toBe("568px");
      // 500 + 500 + a 16px (8local · 2) gap overflows the zoom-scaled budget
      // (1200 − 64 gutter − 128 padding − 4 border = 1004) and must fold;
      // an uncorrected gutter would have called 1036 and kept both.
      expect(more()).not.toBeNull();
      expect(labels()).toEqual(["第二层"]);
    } finally {
      restore();
      vi.restoreAllMocks();
    }
  });

  it("writes the viewport fence in the strip's own px", async () => {
    // A vw-authored cap would be scaled by a host root zoom at paint, so the
    // fence is re-derived from the live viewport (minus the shared gutter)
    // and written as local px — exactly like the strip's `top`.
    setViewport(360);
    manager.register("modal", true, "第一层");
    manager.register("modal", true, "第二层");
    await mountStrip();
    expect(strip()!.style.maxWidth).toBe("344px");

    setViewport(1200);
    await nextTick();
    expect(strip()!.style.maxWidth).toBe("1168px");
  });

  it("re-decides the fold when the viewport widens", async () => {
    setViewport(320);
    manager.register("modal", true, "第一层标题占位一二三");
    manager.register("modal", true, "第二层标题占位一二三");
    manager.register("modal", true, "第三层标题占位一二三");
    await mountStrip();
    expect(more()).not.toBeNull();
    expect(labels().length).toBeLessThan(3);

    setViewport(2400);
    await nextTick();
    expect(more()).toBeNull();
    expect(labels()).toHaveLength(3);
  });
});

describe("HkModalBreadcrumb hidden-layers menu", () => {
  function registerStack(extraTitle: string): void {
    STACK_TITLES.forEach((title) => manager.register("modal", true, title));
    manager.register("modal", true, extraTitle);
  }

  it("lists the folded layers with their full names", async () => {
    setViewport(360);
    registerStack("细节");
    await mountStrip();
    const allTitles = [...STACK_TITLES, "细节"];
    // The tail that stays on the strip before the menu opens: the menu
    // snapshots exactly the layers this run folds away.
    const tailBefore = labels();
    expect(more()).not.toBeNull();
    expect(tailBefore.length).toBeGreaterThan(0);
    expect(tailBefore.length).toBeLessThan(allTitles.length);

    more()!.click();
    await nextTick();
    await nextTick();
    const rows = menuRows();
    // Full names, in stack order — the strip's clamp never reaches here.
    expect(rows.map((row) => row.textContent)).toEqual(
      allTitles.slice(0, allTitles.length - tailBefore.length),
    );
    expect(rows.map((row) => row.textContent)).not.toContain(LONG_TAIL);
    expect(rows.some((row) => row.textContent?.includes("…"))).toBe(false);
  });

  it("docks the menu as a bottom-up sheet on mobile", async () => {
    setViewport(360);
    registerStack("细节");
    await mountStrip();
    more()!.click();
    await nextTick();
    await nextTick();
    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel")!;
    expect(panel).toBeTruthy();
    expect(panel.classList.contains("hk-is-sheet")).toBe(true);
    expect(document.body.querySelector(".hk-popover-scrim")).not.toBeNull();
    // The blocking sheet registers with the popup manager like every other
    // window layer — it is named, and it counts as a layer of the stack it
    // was opened from.
    const blocking = [...manager.registry.value.values()].filter((entry) => entry.blocking);
    expect(blocking.map((entry) => entry.title)).toContain("Hidden layers");
  });

  it("anchors the menu under the trigger on desktop", async () => {
    setViewport(800);
    registerStack("细节");
    await mountStrip();
    more()!.click();
    await nextTick();
    await nextTick();
    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel")!;
    expect(panel).toBeTruthy();
    expect(panel.classList.contains("hk-is-sheet")).toBe(false);
    expect(panel.getAttribute("aria-label")).toBe("Hidden layers");
    expect(document.body.querySelector(".hk-popover-scrim")).toBeNull();
    // Anchored = a hidden level: nothing new joins the window stack.
    expect([...manager.registry.value.values()].filter((entry) => entry.blocking)).toHaveLength(0);
  });

  it("navigates back by closing every layer above the chosen one", async () => {
    setViewport(360);
    const closes = STACK_TITLES.map(() => vi.fn());
    STACK_TITLES.forEach((title, i) => {
      manager.register("modal", true, title, false, closes[i]);
    });
    // The topmost layer's owner registered no close channel: a jump back
    // past it must leave it alone rather than tear it down behind its
    // owner's back.
    const noChannel = manager.register("modal", true, "没有关闭通道的层级占位文本");
    await mountStrip();
    more()!.click();
    await nextTick();
    await nextTick();
    const rows = menuRows();
    expect(rows.length).toBeGreaterThan(1);
    expect(rows[0].textContent).toBe(LONG);

    // Pick the SECOND folded layer: everything above it closes, it and
    // everything below it stay.
    rows[1].click();
    await nextTick();
    expect(closes[0]).not.toHaveBeenCalled();
    expect(closes[1]).not.toHaveBeenCalled();
    for (let i = 2; i < closes.length; i++) {
      expect(closes[i]).toHaveBeenCalledTimes(1);
    }
    expect(manager.registry.value.has(noChannel.id)).toBe(true);
    // The jump dismisses the menu that carried it.
    expect(more()!.getAttribute("aria-expanded")).toBe("false");
  });
});
