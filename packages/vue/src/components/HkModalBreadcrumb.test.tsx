import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, nextTick } from "vue";

import HkModalBreadcrumb from "./HkModalBreadcrumb";
import { usePopupManager } from "../runtime/usePopupManager";
import { displayWidthUnits } from "../runtime/displayWidth";

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

/** Wait until pred() holds (surfaces leave the registry asynchronously —
 *  happy-dom never fires transitionend, so a closing sheet lingers until
 *  its machine's own deadline). */
async function until(pred: () => boolean, ms = 1000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!pred() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await nextTick();
  }
  await nextTick();
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

  it("keeps the whole layer name on a cut label", async () => {
    manager.register("modal", true, LONG);
    manager.register("modal", true, "细节");
    await mountStrip();
    const nav = strip()!;
    const first = nav.querySelector<HTMLButtonElement>(
      ":scope > .hk-modal-breadcrumb-crumb button.hk-modal-breadcrumb-item",
    )!;
    // Rendered cut, announced whole: a truncated string is not a name.
    expect(first.textContent).toBe(LONG_TAIL);
    expect(first.getAttribute("aria-label")).toBe(LONG);
    expect(first.getAttribute("aria-expanded")).toBe("false");
    // An uncut label stays plain text — no new interaction surface.
    expect(nav.querySelectorAll("button.hk-modal-breadcrumb-item")).toHaveLength(1);
    // The measurement clone must never join the a11y tree.
    expect(
      nav.querySelector(".hk-modal-breadcrumb-measure")!.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("fits the reported phone scenario without folding anything away", async () => {
    // The report: two ordinary chest titles on a phone. Both layers must
    // still be READABLE (a fold would hide one behind the trigger) and each
    // label must stay inside the ten-unit budget.
    setViewport(390);
    manager.register("modal", true, LONG);
    manager.register("drawer", true, "任务节点 e2e-w0-002310");
    await mountStrip();
    const shown = labels();
    expect(more()).toBeNull();
    expect(shown).toHaveLength(2);
    expect(shown[0]).toBe(LONG_TAIL);
    expect(shown[1].endsWith("…")).toBe(true);
    for (const text of shown) {
      expect(displayWidthUnits(text)).toBeLessThanOrEqual(10);
    }
  });

  it("reveals a cut label on the same crumb's popover", async () => {
    setViewport(1200);
    manager.register("modal", true, LONG);
    manager.register("modal", true, "细节");
    await mountStrip();
    const cut = () =>
      strip()!.querySelector<HTMLButtonElement>("button.hk-modal-breadcrumb-item")!;
    expect(document.body.querySelector(".hk-popover-panel")).toBeNull();

    cut().click();
    await nextTick();
    await nextTick();
    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel")!;
    expect(panel).toBeTruthy();
    // Desktop: an anchored popover carrying the WHOLE name, wrapping.
    expect(panel.classList.contains("hk-is-sheet")).toBe(false);
    expect(panel.querySelector(".hk-modal-breadcrumb-reveal")!.textContent).toBe(LONG);
    expect(cut().getAttribute("aria-expanded")).toBe("true");

    // Tapping the same crumb again puts it away.
    cut().click();
    await nextTick();
    await nextTick();
    expect(cut().getAttribute("aria-expanded")).toBe("false");
    expect(document.body.querySelector(".hk-modal-breadcrumb-reveal")).toBeNull();
  });

  it("docks the revealed name as a bottom sheet on mobile", async () => {
    setViewport(360);
    manager.register("modal", true, LONG);
    manager.register("modal", true, "细节");
    await mountStrip();
    strip()!.querySelector<HTMLButtonElement>("button.hk-modal-breadcrumb-item")!.click();
    // Settle before asserting: the sheet's own registration re-folds the
    // strip, and the surface must outlive that (see the phone test above).
    await until(() => document.body.querySelector(".hk-modal-breadcrumb-reveal") !== null);
    await until(() => false, 150);
    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel")!;
    expect(panel.classList.contains("hk-is-sheet")).toBe(true);
    expect(panel.querySelector(".hk-modal-breadcrumb-reveal")!.textContent).toBe(LONG);
    // It registers as a window layer like any other blocking sheet, and the
    // name it reveals is the name it carries.
    const blocking = [...manager.registry.value.values()].filter((entry) => entry.blocking);
    expect(blocking.map((entry) => entry.title)).toContain(LONG);
  });

  it("keeps the revealed name open on a phone, where its own sheet moves the fold", async () => {
    // Opening the reveal docks a blocking sheet, the sheet joins the stack
    // the strip lists, and the tail is re-decided underneath: the tapped
    // crumb can end up behind the trigger in the same frame. The surface
    // belongs to the LAYER, not to the fold — closing it there made the
    // reveal cancel itself on every phone (2026-09-16 review).
    setViewport(360);
    manager.register("modal", true, LONG); // cut, and visible before the tap
    manager.register("modal", true, "第二层");
    manager.register("modal", true, "第三层");
    await mountStrip();
    const crumb = strip()!.querySelector<HTMLButtonElement>("button.hk-modal-breadcrumb-item")!;
    expect(crumb.getAttribute("aria-label")).toBe(LONG);

    crumb.click();
    await until(() => document.body.querySelector(".hk-modal-breadcrumb-reveal") !== null);
    // Let every deferred consequence land (the sheet's registration, the
    // re-measure, the fold) and assert the surface is STILL there.
    await until(() => false, 200);
    expect(document.body.querySelector(".hk-modal-breadcrumb-reveal")!.textContent).toBe(LONG);
    expect(document.body.querySelector<HTMLElement>(".hk-popover-panel")!.classList.contains("hk-is-sheet")).toBe(true);
  });

  it("closes the reveal when its layer stops being cut (retitle)", async () => {
    setViewport(1200);
    const layer = manager.register("modal", true, LONG);
    manager.register("modal", true, "细节");
    await mountStrip();
    strip()!.querySelector<HTMLButtonElement>("button.hk-modal-breadcrumb-item")!.click();
    await nextTick();
    await nextTick();
    expect(document.body.querySelector(".hk-modal-breadcrumb-reveal")).toBeTruthy();

    // The owner renames the window to something that fits: the crumb is
    // plain text again, so an open panel would be anchored to nothing while
    // showing a name that no longer exists.
    manager.setTitle(layer.id, "短标题");
    await nextTick();
    await nextTick();
    expect(strip()!.querySelectorAll("button.hk-modal-breadcrumb-item")).toHaveLength(0);
    expect(document.body.querySelector(".hk-modal-breadcrumb-reveal")).toBeNull();
  });

  it("follows a retitle that is still cut", async () => {
    setViewport(1200);
    const layer = manager.register("modal", true, LONG);
    manager.register("modal", true, "细节");
    await mountStrip();
    strip()!.querySelector<HTMLButtonElement>("button.hk-modal-breadcrumb-item")!.click();
    await nextTick();
    await nextTick();
    const longer = "另一个非常长的层级标题占位一二三四五";
    manager.setTitle(layer.id, longer);
    await nextTick();
    await nextTick();
    expect(document.body.querySelector(".hk-modal-breadcrumb-reveal")!.textContent).toBe(longer);
  });

  it("does not reopen the reveal after the strip comes back", async () => {
    // The strip unmounts when the stack drops to one layer: the reveal goes
    // with it (its surface is rendered inside), and a stale `revealed` would
    // otherwise spring back — anchored to the element that no longer exists
    // — the moment another window opens (review round two).
    setViewport(1200);
    manager.register("modal", true, LONG);
    const other = manager.register("modal", true, "细节");
    await mountStrip();
    strip()!.querySelector<HTMLButtonElement>("button.hk-modal-breadcrumb-item")!.click();
    await nextTick();
    await nextTick();
    expect(document.body.querySelector(".hk-modal-breadcrumb-reveal")).toBeTruthy();

    manager.unregister(other.id); // one layer left: the strip goes away
    await nextTick();
    expect(strip()).toBeNull();
    manager.register("modal", true, "新来的层级");
    await nextTick();
    await nextTick();
    expect(strip()).not.toBeNull();
    expect(document.body.querySelector(".hk-modal-breadcrumb-reveal")).toBeNull();
  });

  it("closes the anchored reveal when its crumb folds behind the trigger", async () => {
    // A fold that unmounts the anchor would leave the anchored panel
    // measuring a detached 0×0 rect on its next reposition, which parks it
    // in the viewport corner (review round two). The sheet form needs no
    // anchor and keeps the name (see the phone test above).
    setViewport(1200);
    manager.register("modal", true, LONG);
    manager.register("modal", true, "第二个很长的层级标题占位一二三");
    manager.register("modal", true, "第三个很长的层级标题占位一二三");
    manager.register("modal", true, "细节");
    await mountStrip();
    expect(more()).toBeNull();
    strip()!.querySelector<HTMLButtonElement>("button.hk-modal-breadcrumb-item")!.click();
    await nextTick();
    await nextTick();
    expect(document.body.querySelector(".hk-modal-breadcrumb-reveal")).toBeTruthy();

    // More windows push the tapped crumb behind the trigger (the fold is
    // re-decided a tick after the labels land, then rendered).
    STACK_TITLES.forEach((title) => manager.register("modal", true, title));
    await until(() => more() !== null, 300);
    expect(more()).not.toBeNull();
    expect(strip()!.querySelector<HTMLButtonElement>("button.hk-modal-breadcrumb-item")).not.toBeNull();
    expect(document.body.querySelector(".hk-modal-breadcrumb-reveal")).toBeNull();
  });

  it("closes an open reveal when the folded-layers menu opens", async () => {
    // On a phone the strip paints above the sheet's scrim, so its trigger
    // stays tappable while a reveal is docked (review round two). The menu
    // must take over from the reveal, not stack on top of it: one Escape,
    // one surface.
    setViewport(360);
    [LONG, LONG, LONG, LONG].forEach((title, i) =>
      manager.register("modal", true, `${i}：${title}`),
    );
    await mountStrip();
    expect(more()).not.toBeNull();
    strip()!.querySelector<HTMLButtonElement>("button.hk-modal-breadcrumb-item")!.click();
    await until(() => document.body.querySelector(".hk-modal-breadcrumb-reveal") !== null);
    expect(more()!.getAttribute("aria-expanded")).toBe("false");

    more()!.click();
    await nextTick();
    await nextTick();
    expect(more()!.getAttribute("aria-expanded")).toBe("true");
    // The reveal's own sheet plays its leave out before the DOM drops it —
    // and with nothing closing it, it never does (this assertion is what
    // pins the symmetric close).
    await until(() => document.body.querySelector(".hk-modal-breadcrumb-reveal") === null, 900);
    expect(document.body.querySelector(".hk-modal-breadcrumb-reveal")).toBeNull();
  });

  it("closes whichever surface is open on Escape", async () => {
    setViewport(1200);
    STACK_TITLES.forEach((title) => manager.register("modal", true, title));
    manager.register("modal", true, "细节");
    await mountStrip();

    // The folded-layers menu (anchored: its panel takes no focus, so the
    // strip owns the key).
    more()!.click();
    await nextTick();
    await nextTick();
    expect(more()!.getAttribute("aria-expanded")).toBe("true");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();
    expect(more()!.getAttribute("aria-expanded")).toBe("false");

    // The revealed name.
    strip()!.querySelector<HTMLButtonElement>("button.hk-modal-breadcrumb-item")!.click();
    await nextTick();
    await nextTick();
    expect(document.body.querySelector(".hk-modal-breadcrumb-reveal")).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();
    expect(document.body.querySelector(".hk-modal-breadcrumb-reveal")).toBeNull();
  });

  it("closes the reveal when its layer leaves the stack", async () => {
    setViewport(1200);
    const layer = manager.register("modal", true, LONG);
    manager.register("modal", true, "细节");
    await mountStrip();
    strip()!.querySelector<HTMLButtonElement>("button.hk-modal-breadcrumb-item")!.click();
    await nextTick();
    await nextTick();
    expect(document.body.querySelector(".hk-modal-breadcrumb-reveal")).toBeTruthy();

    // The window closes under the open panel: there is no name left to
    // reveal.
    manager.unregister(layer.id);
    await nextTick();
    await nextTick();
    expect(document.body.querySelector(".hk-modal-breadcrumb-reveal")).toBeNull();
  });

  it("opens the reveal instead of the hidden-layers menu", async () => {
    // The two surfaces are never open together: tapping a crumb closes the
    // menu it was opened from (its leave plays out, so the logical state is
    // what the assertion reads).
    setViewport(800);
    STACK_TITLES.forEach((title) => manager.register("modal", true, title));
    manager.register("modal", true, "细节");
    await mountStrip();
    more()!.click();
    await nextTick();
    await nextTick();
    expect(menuRows().length).toBeGreaterThan(0);
    expect(more()!.getAttribute("aria-expanded")).toBe("true");

    strip()!.querySelector<HTMLButtonElement>("button.hk-modal-breadcrumb-item")!.click();
    await nextTick();
    await nextTick();
    expect(document.body.querySelector(".hk-modal-breadcrumb-reveal")).toBeTruthy();
    expect(more()!.getAttribute("aria-expanded")).toBe("false");
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

  it("estimates the same box model the measurement would report", async () => {
    // No layout engine in this DOM, so the strip estimates: a non-first
    // crumb is [chevron 12px][inner gap 8px][label], and the strip's own
    // inter-crumb gap is added once per pair — never inside the crumb as
    // well. Two 3-ideograph labels (36px each) are 36 + (12 + 8 + 36) + 8 =
    // 100px, so a 104px content budget keeps both.
    setViewport(186); // 186 − 16 gutter − 64 padding − 2 border = 104
    manager.register("modal", true, "第一层");
    manager.register("modal", true, "第二层");
    await mountStrip();
    expect(more()).toBeNull();
    expect(labels()).toEqual(["第一层", "第二层"]);

    // 96px: one 8px gap more than the stack needs.
    setViewport(178);
    await nextTick();
    expect(more()).not.toBeNull();
    expect(labels()).toEqual(["第二层"]);
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

  it("converts the header height through a root zoom for its own top", async () => {
    // The strip is teleported into the host's zoomed root: the header's
    // rect is VISUAL px while the inline top it writes is LOCAL px, so the
    // height is divided by the zoom. Forgetting the division drifts the
    // strip (zoom − 1) · height / 2 down its window.
    const app = document.createElement("div");
    app.id = "app";
    app.style.top = "10px";
    const header = document.createElement("div");
    header.className = "hk-glass-header";
    app.appendChild(header);
    document.body.appendChild(app);

    const original = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      (el: Element, pseudo?: string | null): CSSStyleDeclaration => {
        const decl = original(el, pseudo ?? undefined);
        return new Proxy(decl, {
          get(target, prop, recv) {
            if (prop === "zoom") return el === document.documentElement ? "2" : undefined;
            const v = Reflect.get(target, prop, recv);
            return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
          },
        });
      },
    );
    const rect = (height: number): DOMRect =>
      ({ x: 0, y: 0, width: 200, height, top: 0, left: 0, right: 200, bottom: height, toJSON: () => ({}) }) as DOMRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this === header ? rect(96) : rect(0);
    });
    try {
      setViewport(1200);
      manager.register("modal", true, "第一层");
      manager.register("modal", true, "第二层");
      await mountStrip();
      // 10 (app top, local) + (96 visual / 2 zoom) / 2
      expect(strip()!.style.top).toBe("34px");
    } finally {
      vi.restoreAllMocks();
      app.remove();
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

  it("never folds the current layer away, even when nothing else fits", async () => {
    // The last layer IS the strip's reason to exist: when no tail fits at
    // all it keeps the strip and its own CSS ellipsis does the rest. Only
    // the trigger may be left standing if the loop ever walked past it.
    setViewport(120);
    manager.register("modal", true, "第一层");
    manager.register("modal", true, "第二层");
    manager.register("modal", true, "第三层");
    const restore = stubWidths((el) =>
      el.classList.contains("hk-modal-breadcrumb-more") ? 24 : 400,
    );
    try {
      await mountStrip();
      expect(more()).not.toBeNull();
      expect(labels()).toEqual(["第三层"]);
    } finally {
      restore();
    }
  });

  it("re-measures when the clone's box moves (late webfont, host type scale)", async () => {
    // The strip's ruler is observed: a font swap changes every crumb's
    // width without a resize, and the fold must follow it.
    class FakeRO {
      static instances: FakeRO[] = [];
      observed: Element[] = [];
      constructor(private readonly cb: () => void) {
        FakeRO.instances.push(this);
      }
      observe(el: Element): void {
        this.observed.push(el);
      }
      unobserve(): void {}
      disconnect(): void {
        this.observed = [];
      }
      fire(): void {
        this.cb();
      }
    }
    vi.stubGlobal("ResizeObserver", FakeRO);
    let width = 20; // a narrow font: everything fits
    const restore = stubWidths(() => width);
    try {
      setViewport(360);
      manager.register("modal", true, "第一层标题占位一二三");
      manager.register("modal", true, "第二层标题占位一二三");
      await mountStrip();
      expect(more()).toBeNull();
      const ro = FakeRO.instances.find((inst) =>
        inst.observed.some((el) => el.classList.contains("hk-modal-breadcrumb-measure")),
      );
      expect(ro, "the clone answers the observer").toBeTruthy();

      width = 400; // the webfont lands: the same labels now measure wide
      ro!.fire();
      await nextTick();
      expect(more()).not.toBeNull();
    } finally {
      restore();
      vi.unstubAllGlobals();
    }
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
    // It is a window layer in every sense — including naming itself as the
    // current crumb of the very strip it was opened from.
    expect(
      strip()!.querySelector(".hk-modal-breadcrumb-item-current")!.textContent,
    ).toBe("Hidden layers");
  });

  it("drops the trigger and the menu once the stack stops folding", async () => {
    setViewport(360);
    manager.register("modal", true, "自动化测试流水线冒烟");
    manager.register("modal", true, "自动化测试流水线冒烟");
    manager.register("modal", true, "自动化测试流水线冒烟");
    await mountStrip();
    more()!.click();
    await nextTick();
    await nextTick();
    expect(menuRows().length).toBeGreaterThan(0);
    expect(more()!.getAttribute("aria-expanded")).toBe("true");

    // Wide enough for the whole stack, still the same form factor (so the
    // popover's own breakpoint rule is not what closes it): nothing is left
    // to list, and the trigger the menu is anchored to must go with it.
    setViewport(760);
    await until(
      () =>
        more() === null &&
        ![...manager.registry.value.values()].some((entry) => entry.blocking),
    );
    expect(more()).toBeNull();
    expect(labels()).toHaveLength(3);
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
