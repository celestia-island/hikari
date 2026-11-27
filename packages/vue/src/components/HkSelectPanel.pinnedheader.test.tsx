/**
 * HkSelectPanel's TWO content bands (2026-11-27 user direction): the
 * `pinnedHeader` slot is chrome that never scrolls — a picker's live-filter
 * search field — and renders OUTSIDE the surface's scroll region on both
 * form factors. Before the slot every picker painted its search INSIDE the
 * scrolling content, so the first swipe down scrolled the filter off the
 * sheet. Pinned here at the DOM level, both shapes:
 *
 *   desktop popout   .hk-select-popout.is-pinned-header (closed box)
 *                      .hk-select-popout-pinned   { pinnedHeader }
 *                      .hk-select-popout-body-host (the overlay rail's host)
 *                        .hk-select-popout-body   { default }   ← scrolls
 *   mobile sheet     .hk-select-sheet-panel
 *                      .hk-select-sheet-header (title row)
 *                      .hk-select-sheet-pinned   { pinnedHeader }
 *                      .hk-select-sheet-body > .hk-select-sheet-list { default }
 *
 * plus the second half of the same report: the `maxHeight` cap is a DESKTOP
 * POPOUT measure and never reaches the sheet (it squashed every picker
 * sheet to under half the phone), and a header-less panel renders the exact
 * pre-slot DOM (no wrapper, the popout itself scrolls).
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, defineComponent, h, nextTick, ref, type ComponentPublicInstance } from "vue";

import HkSelectPanel from "./HkSelectPanel";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  document.body
    .querySelectorAll(".hk-select-popout, .hk-select-popout-host, .hk-select-sheet-panel, .hk-select-sheet-scrim")
    .forEach((el) => el.remove());
  setViewport(1200);
});

function setViewport(width: number) {
  window.innerWidth = width;
  window.dispatchEvent(new Event("resize"));
}

/** A panel with a pinned search field above two rows; `pinned` toggles
 *  the slot so the header-less shape can be compared in the same rig. */
function mountPanel(opts: { pinned?: boolean; maxHeight?: string } = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const open = ref(false);
  const anchorEl = ref<HTMLElement | null>(null);
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
              maxHeight: opts.maxHeight,
            },
            opts.pinned === false
              ? { default: () => rows() }
              : {
                  pinnedHeader: () => h("input", { class: "pin", type: "search" }),
                  default: () => rows(),
                },
          ),
        ]);
    },
  });
  const rows = () => [h("div", { class: "row", key: "a" }, "a"), h("div", { class: "row", key: "b" }, "b")];
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return { open, container };
}

async function openPanel(container: HTMLElement) {
  container.querySelector<HTMLButtonElement>("button")!.click();
  await nextTick();
  await nextTick(); // the overlay scrollbar attaches on a post-open nextTick
}

describe("HkSelectPanel pinnedHeader — desktop popout", () => {
  it("renders the pinned band outside a scrolling body inside a closed popout", async () => {
    const { container } = mountPanel();
    await openPanel(container);

    const popout = document.body.querySelector<HTMLElement>(".hk-select-popout")!;
    expect(popout.classList.contains("is-pinned-header")).toBe(true);
    const pinned = popout.querySelector<HTMLElement>(":scope > .hk-select-popout-pinned");
    const host = popout.querySelector<HTMLElement>(":scope > .hk-select-popout-body-host");
    const body = popout.querySelector<HTMLElement>(":scope > .hk-select-popout-body-host > .hk-select-popout-body");
    expect(pinned, "pinned band is a direct child of the popout").toBeTruthy();
    expect(pinned!.querySelector("input.pin"), "the slot content lands in the band").toBeTruthy();
    expect(host, "the rail host wraps the body").toBeTruthy();
    expect(body, "the body is the host's child").toBeTruthy();
    expect(body!.querySelectorAll(".row"), "rows scroll inside the body").toHaveLength(2);
    expect(pinned!.querySelector(".row"), "no rows in the pinned band").toBeNull();
    expect(body!.querySelector("input.pin"), "the search is NOT in the scrolling body").toBeNull();
  });

  it("carries the transition classes on the HOST only — the panel stays bare (2026-11-27 R17)", () => {
    // The popout's transition choreography lives on the fixed HOST
    // (data-side/transform-origin are host-only, HkSelect.scss), and the
    // Rust mirror renders the panel bare. A `machine.classesFor` spread
    // accidentally duplicated the enter/leave classes onto the nested
    // static panel too — double opacity animation + mirror drift (R17).
    // Asserted at source: the transient enter/leave classes are
    // watchdog-stripped in happy-dom, so a DOM read is timing-fragile
    // here; the class array is the durable artifact.
    const tsx = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "HkSelectPanel.tsx"),
      "utf-8",
    );
    // The host's spread — load-bearing (the pop motion family).
    expect(tsx).toContain(
      'class={["hk-select-popout-host", ...machine.classesFor("hk-select-popout")]}',
    );
    // The PANEL must stay bare: exactly ONE spread of that name in the
    // file, and it is the host's.
    const occurrences = tsx.split('machine.classesFor("hk-select-popout")').length - 1;
    expect(occurrences, "exactly one machine-class spread (the host's)").toBe(1);
  });

  it("attaches the overlay rail to the body host, not the popout host", async () => {
    const { container } = mountPanel();
    await openPanel(container);
    // The rail must wrap EXACTLY the viewport: with a pinned head the
    // popout host (which also holds the band) is no longer that box.
    expect(document.body.querySelector(".hk-select-popout-body-host > .hk-scrollbar-track")).toBeTruthy();
    expect(document.body.querySelector(".hk-select-popout-host > .hk-scrollbar-track")).toBeNull();
  });

  it("keeps the popout cap on the popout itself (the whole column)", async () => {
    const { container } = mountPanel({ maxHeight: "min(18rem, 45dvh)" });
    await openPanel(container);
    const popout = document.body.querySelector<HTMLElement>(".hk-select-popout")!;
    expect(popout.style.getPropertyValue("--hk-select-panel-max-height")).toBe("min(18rem, 45dvh)");
    expect(popout.querySelector<HTMLElement>(".hk-select-popout-body")!.hasAttribute("style")).toBe(false);
  });

  it("renders the exact pre-slot DOM when no pinnedHeader is passed", async () => {
    const { container } = mountPanel({ pinned: false });
    await openPanel(container);
    const popout = document.body.querySelector<HTMLElement>(".hk-select-popout")!;
    expect(popout.classList.contains("is-pinned-header")).toBe(false);
    expect(popout.querySelector(".hk-select-popout-pinned")).toBeNull();
    expect(popout.querySelector(".hk-select-popout-body-host")).toBeNull();
    expect(popout.querySelectorAll(":scope > .row"), "rows are direct children; the popout itself scrolls").toHaveLength(2);
    expect(document.body.querySelector(".hk-select-popout-host > .hk-scrollbar-track")).toBeTruthy();
  });

  it("re-attaches the overlay rail when the pinned slot flips on a live panel (2026-11-27 R19)", async () => {
    // HkCurrencySelect pins its search only while `searchable` — a parent
    // can flip that WHILE the panel is open, and the flip swaps the scroll
    // viewport's identity (body ⇄ bare panel). The rail binds once per
    // open, so without a re-attach the surface scrolls with no scrollbar.
    // Reactive-slot rig: the pinned prop flips on a LIVE open panel.
    const host = document.createElement("div");
    document.body.appendChild(host);
    const open = ref(false);
    const pinned = ref(true);
    const anchorEl = ref<HTMLElement | null>(null);
    const wrapper = createApp({
      setup() {
        return () =>
          h("div", [
            h("button", {
              ref: (el: Element | ComponentPublicInstance | null) => {
                anchorEl.value = el as HTMLElement | null;
              },
              type: "button",
              onClick: () => { open.value = !open.value; },
            }),
            h(
              HkSelectPanel,
              {
                open: open.value,
                "onUpdate:open": (v: boolean) => { open.value = v; },
                anchorRef: anchorEl.value,
                title: "Filters",
              },
              // Reactive slot presence (slots are the CHILDREN object, not
              // props): the pinned band appears/disappears on the live panel.
              pinned.value
                ? {
                    pinnedHeader: () => h("input", { class: "pin", type: "search" }),
                    default: () => [h("div", { class: "row" }, "a"), h("div", { class: "row" }, "b")],
                  }
                : { default: () => [h("div", { class: "row" }, "a"), h("div", { class: "row" }, "b")] },
            ),
          ]);
      },
    });
    wrapper.mount(host);
    mounts.push(wrapper);
    host.querySelector<HTMLButtonElement>("button")!.click();
    await nextTick(); await nextTick();
    expect(
      document.body.querySelector(".hk-select-popout-body-host > .hk-scrollbar-track"),
      "pinned shape: the rail hugs the body",
    ).toBeTruthy();
    // Flip the slot OFF on the live panel: the bare popout becomes the
    // scroller, so the rail must move to the fixed host.
    pinned.value = false;
    await nextTick(); await nextTick();
    console.log("PROBE after-flip bodyHost=", !!document.body.querySelector(".hk-select-popout-body-host"),
      "trackAnywhere=", !!document.body.querySelector(".hk-scrollbar-track"),
      "trackOnHost=", !!document.body.querySelector(".hk-select-popout-host > .hk-scrollbar-track"),
      "panelCls=", JSON.stringify(document.body.querySelector(".hk-select-popout")?.className));
    expect(
      document.body.querySelector(".hk-select-popout-host > .hk-scrollbar-track"),
      "header-less shape: the rail hugs the popout host",
    ).toBeTruthy();
    expect(
      document.body.querySelector(".hk-select-popout-body-host"),
      "the body wrapper is gone",
    ).toBeNull();
    // …and back ON: the rail returns to the body host.
    pinned.value = true;
    await nextTick(); await nextTick();
    expect(
      document.body.querySelector(".hk-select-popout-body-host > .hk-scrollbar-track"),
      "the rail follows the flip back",
    ).toBeTruthy();
  });

  it("clicks inside the pinned band never dismiss the popout (it is inside the surface)", async () => {
    const { container, open } = mountPanel();
    await openPanel(container);
    document.body
      .querySelector<HTMLElement>(".hk-select-popout-pinned input.pin")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(open.value).toBe(true);
  });

  it("detaches the body-host rail on close — it never outlives the panel (2026-11-27 R16)", async () => {
    // The pinned-header popout mounts a rail whose HOST wrapper is a child
    // of the panel: when the panel dies the wrapper goes with it, so a
    // leaked rail would be STRANDED. `handleCloseRequest` calls
    // detachPanelScrollbar() for exactly this; every other assertion here
    // only ever reads the OPEN shape, so dropping that call left the whole
    // suite green (2026-11-27 R16 mutation).
    //
    // The observation window: the surface machine keeps the Teleport
    // mounted through its leave (`popoutHostRef` carries
    // `hk-select-popout-leave-active`), so the ideal instant to look is
    // while the panel is still in the DOM but already closing.
    const { container, open } = mountPanel();
    await openPanel(container);
    expect(
      document.body.querySelector(".hk-select-popout-body-host > .hk-scrollbar-track"),
      "rail attached while open",
    ).toBeTruthy();

    open.value = false;
    await nextTick();
    await nextTick();

    // Still mounted (the leave owns the frame) — so absence of the rail is
    // the detach, not a teardown.
    const host = document.body.querySelector<HTMLElement>(".hk-select-popout-host");
    expect(host, "the panel is still mounted for its leave").toBeTruthy();
    expect(host!.className, "the host is in the leave phase").not.toContain("hk-select-popout-enter");
    expect(
      document.body.querySelector(".hk-select-popout-body-host > .hk-scrollbar-track"),
      "no rail left behind on the closing panel",
    ).toBeNull();
  });
});

describe("HkSelectPanel pinnedHeader — mobile sheet", () => {
  it("renders the pinned band between the title row and the scrolling list", async () => {
    setViewport(375);
    const { container } = mountPanel();
    await openPanel(container);
    const sheet = document.body.querySelector<HTMLElement>(".hk-select-sheet-panel")!;
    const order = [...sheet.children].map((c) => c.className);
    expect(order.indexOf("hk-select-sheet-header")).toBeLessThan(order.indexOf("hk-select-sheet-pinned"));
    expect(order.indexOf("hk-select-sheet-pinned")).toBeLessThan(order.indexOf("hk-select-sheet-body"));
    const band = sheet.querySelector<HTMLElement>(".hk-select-sheet-pinned")!;
    expect(band.querySelector("input.pin")).toBeTruthy();
    const list = sheet.querySelector<HTMLElement>(".hk-select-sheet-list")!;
    expect(list.querySelectorAll(".row")).toHaveLength(2);
    expect(list.querySelector("input.pin"), "the search is NOT inside the scrolling list").toBeNull();
    // No popout-shaped wrapper leaks into the sheet.
    expect(sheet.querySelector(".hk-select-popout-body")).toBeNull();
  });

  it("the dup-title filter never scans the pinned band (2026-11-27 R16)", async () => {
    // The filter hides a leading in-content heading that merely repeats the
    // sheet title — but the BAND is chrome the consumer deliberately put
    // there (a "Filters" label above a filter field). The scan is anchored
    // on `sheetListRef`, and its band-anchored form was unpinned: widening
    // it to the panel would hide the band's own label (2026-11-27 R16).
    setViewport(375);
    const { container } = mountPanel();
    await openPanel(container);
    // Same text in BOTH places: the list's heading hides, the band's stays.
    const band = document.querySelector<HTMLElement>(".hk-select-sheet-pinned")!;
    band.insertAdjacentHTML("beforeend", '<div class="band-label">Filters</div>');
    const list = document.querySelector<HTMLElement>(".hk-select-sheet-list")!;
    list.insertAdjacentHTML("beforeend", '<div class="list-label">Filters</div>');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
    // Band FIRST: a widened scan returns the band's label before it ever
    // reaches the list, so asserting the list first would report a diff
    // misread (the list's own heading is fine) instead of the actual
    // regression.
    expect(
      band.querySelector<HTMLElement>(".band-label")!.classList.contains("hk-sheet-dup-title"),
      "the pinned band's label is never judged",
    ).toBe(false);
    expect(
      list.querySelector<HTMLElement>(".list-label")!.classList.contains("hk-sheet-dup-title"),
      "the scrolling list's duplicate heading is still filtered",
    ).toBe(true);
  });

  it("never publishes the popout cap on the sheet — neither band nor panel", async () => {
    setViewport(375);
    const { container } = mountPanel({ maxHeight: "min(18rem, 45dvh)" });
    await openPanel(container);
    const sheet = document.body.querySelector<HTMLElement>(".hk-select-sheet-panel")!;
    expect(sheet.style.getPropertyValue("--hk-select-panel-max-height")).toBe("");
    const list = sheet.querySelector<HTMLElement>(".hk-select-sheet-list")!;
    expect(list.style.getPropertyValue("--hk-select-panel-max-height")).toBe("");
    expect(list.hasAttribute("style")).toBe(false);
  });
});
