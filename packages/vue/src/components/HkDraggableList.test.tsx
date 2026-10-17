import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import HDraggableList from "./HkDraggableList";

/**
 * DOM contract for the locked-row handle lane.
 *
 * Every row renders a 20px handle lane so the grip column stays aligned
 * across draggable and locked rows; a locked row hides its grip
 * (`data-hidden` → visibility: hidden — reserved, not removed). When
 * EVERY row is locked the list can never reorder at all, and an
 * all-hidden lane reads as "missing grips" rather than "locked" (user
 * report 2026-10-11 on chest's 2FA factors list): the root then carries
 * `data-all-locked` and the sheet collapses the lane entirely (the sheet
 * twin of this contract: HkDraggableList.styles.test.ts). A custom
 * `handle` slot rides the same lane, so it collapses with it.
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils.)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

afterEach(() => {
  while (mounts.length) {
    const { app, container } = mounts.pop()!;
    app.unmount();
    container.remove();
  }
});

function mountList(items: string[], lockedKeys: string[]): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(
        HDraggableList,
        { items: items.map((key) => ({ key })), lockedKeys },
        {
          item: ({ item }: { item: { key: string } }) =>
            h("span", { class: "row-body" }, item.key),
        },
      ),
  });
  app.mount(container);
  mounts.push({ app, container });
  return container.querySelector(".hk-draggable-list") as HTMLElement;
}

function handlesOf(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll(".hk-draggable-list-handle"));
}

describe("HkDraggableList locked-lane contract", () => {
  it("hides a locked row's grip but keeps the lane in mixed lists", () => {
    const root = mountList(["a", "b"], ["b"]);

    expect(root.hasAttribute("data-all-locked")).toBe(false);
    const handles = handlesOf(root);
    expect(handles).toHaveLength(2);
    expect(handles[0]!.hasAttribute("data-hidden")).toBe(false);
    expect(handles[1]!.hasAttribute("data-hidden")).toBe(true);
  });

  it("marks an all-locked list so the sheet can collapse the lane", () => {
    const root = mountList(["a", "b"], ["a", "b"]);

    expect(root.hasAttribute("data-all-locked")).toBe(true);
    // Handles stay in the DOM (consumers count them — chest's 2FA
    // contract test does); the collapse is presentational, carried by
    // the sheet, so the marker is the load-bearing part here.
    const handles = handlesOf(root);
    expect(handles).toHaveLength(2);
    expect(handles.every((handle) => handle.hasAttribute("data-hidden"))).toBe(true);
  });

  it("flips the marker reactively as the last draggable row locks", async () => {
    const lockedKeys = ref<string[]>([]);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(
          HDraggableList,
          { items: [{ key: "a" }, { key: "b" }], lockedKeys: lockedKeys.value },
          {
            item: ({ item }: { item: { key: string } }) =>
              h("span", { class: "row-body" }, item.key),
          },
        ),
    });
    app.mount(container);
    mounts.push({ app, container });
    const root = container.querySelector(".hk-draggable-list") as HTMLElement;

    expect(root.hasAttribute("data-all-locked")).toBe(false);

    lockedKeys.value = ["a", "b"];
    await nextTick();

    expect(root.hasAttribute("data-all-locked")).toBe(true);
  });

  it("collapses a custom handle slot with the lane in an all-locked list", () => {
    // The handle slot renders INSIDE the lane span, so the collapse rule
    // hides custom grips the same as the default six-dot svg.
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(
          HDraggableList,
          { items: [{ key: "a" }], lockedKeys: ["a"] },
          {
            item: ({ item }: { item: { key: string } }) =>
              h("span", { class: "row-body" }, item.key),
            handle: () => h("span", { class: "custom-grip" }, "≡"),
          },
        ),
    });
    app.mount(container);
    mounts.push({ app, container });

    const grip = container.querySelector(".custom-grip") as HTMLElement;
    expect(grip).not.toBeNull();
    // The custom grip rides the lane span that the sheet display:nones.
    expect(grip.closest(".hk-draggable-list-handle")).not.toBeNull();
    expect(grip.closest(".hk-draggable-list")).not.toBeNull();
    expect(
      (grip.closest(".hk-draggable-list") as HTMLElement).hasAttribute("data-all-locked"),
    ).toBe(true);
  });

  it("carries no marker on an empty list", () => {
    const root = mountList([], []);

    expect(root.hasAttribute("data-all-locked")).toBe(false);
    expect(handlesOf(root)).toHaveLength(0);
  });

  it("ignores locked keys that match no row — membership, not counts", () => {
    // Guards against a length-arithmetic refactor
    // (lockedKeys.length >= items.length): TWO phantom keys vs two rows
    // satisfy the count yet lock nothing — the list stays draggable and
    // the lane must stay.
    const phantomOnly = mountList(["a", "b"], ["zzz", "yyy"]);
    expect(phantomOnly.hasAttribute("data-all-locked")).toBe(false);

    // A superset still marks: every real row IS locked.
    const superset = mountList(["a", "b"], ["zzz", "a", "b"]);
    expect(superset.hasAttribute("data-all-locked")).toBe(true);
  });

  it("flips the marker reactively as rows are added around a locked one", async () => {
    const items = ref<{ key: string }[]>([{ key: "a" }]);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(
          HDraggableList,
          { items: items.value, lockedKeys: ["a"] },
          {
            item: ({ item }: { item: { key: string } }) =>
              h("span", { class: "row-body" }, item.key),
          },
        ),
    });
    app.mount(container);
    mounts.push({ app, container });
    const root = container.querySelector(".hk-draggable-list") as HTMLElement;

    expect(root.hasAttribute("data-all-locked")).toBe(true);

    items.value = [{ key: "a" }, { key: "b" }];
    await nextTick();

    expect(root.hasAttribute("data-all-locked")).toBe(false);
  });
});

describe("HkDraggableList list semantics", () => {
  /** A reorderable list is a list for AT users whether or not the host
   *  names it: the root always carries role="list" and every row
   *  role="listitem" (the vocabulary a11y rulings #736/#737 applied to
   *  the picker surfaces — the drag list adopts the same contract). The
   *  accessible NAME stays the host's call: aria-label renders only when
   *  the `label` prop is passed, so an unnamed list is still structural
   *  and never announces an empty string. */

  it("announces the root and rows as a list regardless of the label", () => {
    const root = mountList(["a", "b"], []);

    expect(root.getAttribute("role")).toBe("list");
    expect(root.hasAttribute("aria-label")).toBe(false);
    const rows = Array.from(root.querySelectorAll(".hk-draggable-list-item"));
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.getAttribute("role") === "listitem")).toBe(true);
  });

  it("names the list through the label prop", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(
          HDraggableList,
          { items: [{ key: "a" }], label: "Sortable accounts" },
          {
            item: ({ item }: { item: { key: string } }) =>
              h("span", { class: "row-body" }, item.key),
          },
        ),
    });
    app.mount(container);
    mounts.push({ app, container });

    const root = container.querySelector(".hk-draggable-list") as HTMLElement;
    expect(root.getAttribute("role")).toBe("list");
    expect(root.getAttribute("aria-label")).toBe("Sortable accounts");
  });
});

describe("HkDraggableList content-lane shape", () => {
  /** The lane hands the slot content through verbatim, and the sheet
   *  stretches a lane's ONLY element child across the row (the
   *  `:only-child` fill — sheet twin:
   *  HkDraggableList.styles.test.ts). That selector's semantics hinge on
   *  this shape: a single-root slot must land as exactly one element
   *  child, and a fragment slot as several siblings (which the fill
   *  deliberately does not match). */

  function mountWithSlot(slot: () => unknown): HTMLElement {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(
          HDraggableList,
          { items: [{ key: "a" }] },
          { item: () => slot() },
        ),
    });
    app.mount(container);
    mounts.push({ app, container });
    return container.querySelector(".hk-draggable-list") as HTMLElement;
  }

  function laneOf(root: HTMLElement): HTMLElement {
    return root.querySelector(".hk-draggable-list-content") as HTMLElement;
  }

  it("lands a single-root slot as the lane's only element child", () => {
    const root = mountWithSlot(() => h("div", { class: "row-card" }, "body"));
    const children = Array.from(laneOf(root).children);
    expect(children).toHaveLength(1);
    expect(children[0]!.classList.contains("row-card")).toBe(true);
  });

  it("lands a fragment slot as several lane siblings the fill ignores", () => {
    const root = mountWithSlot(() => [
      h("span", { class: "row-lead" }, "lead"),
      h("span", { class: "row-tail" }, "tail"),
    ]);
    const children = Array.from(laneOf(root).children);
    expect(children).toHaveLength(2);
    expect(children[0]!.classList.contains("row-lead")).toBe(true);
    expect(children[1]!.classList.contains("row-tail")).toBe(true);
  });
});

describe("HkDraggableList press ergonomics (clickable rows)", () => {
  /** Two guards make a clickable row safe inside the list (ported from
   *  wowsp's SortableList twin, which ran them in production):
   *
   *    1. ARM — a press under 5px of travel never publishes drag state
   *       (no ghost flash on a jittered tap) and keeps the tap's native
   *       semantics: no preventDefault until the arm.
   *    2. SWALLOW — the release of an ARMED drag lands as a click on the
   *       row the press started from; a capture-phase guard on the root
   *       eats it, so dropping a row onto a clickable card never also
   *       activates that card. Time-boxed at 300ms so it can never eat
   *       a later keyboard activation, which has no pointerdown to
   *       reset it. */

  const PointerEventCtor: typeof MouseEvent =
    (globalThis as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? MouseEvent;

  const pointerInit: MouseEventInit = { bubbles: true, cancelable: true };

  function fire(el: Element, type: string, x = 0, y = 0) {
    el.dispatchEvent(new PointerEventCtor(type, {
      ...pointerInit,
      button: 0,
      clientX: x,
      clientY: y,
    }));
  }

  function fireWin(type: string, x = 0, y = 0) {
    window.dispatchEvent(new PointerEventCtor(type, {
      ...pointerInit,
      clientX: x,
      clientY: y,
    }));
  }

  function mountClickable(): { root: HTMLElement; clicks: () => number } {
    let clicked = 0;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(
          HDraggableList,
          { items: [{ key: "a" }, { key: "b" }] },
          {
            item: () =>
              h(
                "div",
                { class: "row-body", onClick: () => { clicked++; } },
                "row",
              ),
          },
        ),
    });
    app.mount(container);
    mounts.push({ app, container });
    const root = container.querySelector(".hk-draggable-list") as HTMLElement;
    return { root, clicks: () => clicked };
  }

  it("keeps a plain tap a tap: no drag state, and the row's click fires", async () => {
    const { root, clicks } = mountClickable();
    const row = root.querySelectorAll(".hk-draggable-list-item")[0] as HTMLElement;

    fire(row, "pointerdown", 10, 10);
    // A 1px jitter stays under the arm threshold — no drag publishes.
    fireWin("pointermove", 11, 10);
    await nextTick();
    expect(row.hasAttribute("data-dragging")).toBe(false);

    fireWin("pointerup");
    (row.querySelector(".row-body") as HTMLElement).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    expect(clicks()).toBe(1);
  });

  it("arms past the threshold, drags, and swallows the release click", async () => {
    const { root, clicks } = mountClickable();
    const row = root.querySelectorAll(".hk-draggable-list-item")[0] as HTMLElement;

    fire(row, "pointerdown", 10, 10);
    fireWin("pointermove", 30, 40);
    await nextTick();
    expect(row.getAttribute("data-dragging")).not.toBeNull();

    fireWin("pointerup");
    (row.querySelector(".row-body") as HTMLElement).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    expect(clicks()).toBe(0);
  });

  it("time-boxes the swallow — a click after the window passes through", async () => {
    vi.useFakeTimers();
    try {
      const { root, clicks } = mountClickable();
      const row = root.querySelectorAll(".hk-draggable-list-item")[0] as HTMLElement;

      fire(row, "pointerdown", 10, 10);
      fireWin("pointermove", 30, 40);
      fireWin("pointerup");

      (row.querySelector(".row-body") as HTMLElement).dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      expect(clicks()).toBe(0);

      vi.advanceTimersByTime(301);
      (row.querySelector(".row-body") as HTMLElement).dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      expect(clicks()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("HkDraggableList actions lane", () => {
  /** The standard row-actions contract: hosts inject trailing buttons
   *  through the scoped `actions` slot instead of hand-rolling
   *  ml-auto/flex-1 spacers inside the row content (chest's pricing
   *  ladder shipped exactly such a hand-rolled group and its buttons
   *  hugged the row's text mid-card). The lane renders as a SIBLING of
   *  the content lane — never inside it — so the content sheet's
   *  `> :only-child` fill keeps matching single-root rows even when
   *  actions ride along (sheet twin: HkDraggableList.styles.test.ts). */

  function mountWithActions(items: { key: string }[], opts?: { lockedKeys?: string[] }): HTMLElement {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(
          HDraggableList,
          { items, lockedKeys: opts?.lockedKeys ?? [] },
          {
            item: ({ item }: { item: { key: string } }) =>
              h("span", { class: "row-body" }, item.key),
            actions: ({
              item,
              index,
              locked,
            }: {
              item: { key: string };
              index: number;
              locked: boolean;
            }) =>
              h("span", {
                class: "row-actions",
                "data-key": item.key,
                "data-index": index,
                "data-locked": locked,
              }),
          },
        ),
    });
    app.mount(container);
    mounts.push({ app, container });
    return container.querySelector(".hk-draggable-list") as HTMLElement;
  }

  it("renders a right-lane sibling per row only when the slot is provided", () => {
    const root = mountWithActions([{ key: "a" }, { key: "b" }]);

    const lanes = Array.from(root.querySelectorAll(".hk-draggable-list-actions"));
    expect(lanes).toHaveLength(2);
    for (const lane of lanes) {
      // Sibling of the content lane, not a child of it — the :only-child
      // fill contract above must keep matching the row body.
      expect(lane.closest(".hk-draggable-list-content")).toBeNull();
      expect(lane.previousElementSibling?.classList.contains("hk-draggable-list-content")).toBe(
        true,
      );
    }
  });

  it("keeps the content lane's :only-child fill intact alongside the lane", () => {
    const root = mountWithActions([{ key: "a" }]);

    const content = root.querySelector(".hk-draggable-list-content") as HTMLElement;
    const elementChildren = Array.from(content.children);
    expect(elementChildren).toHaveLength(1);
    expect(elementChildren[0]!.classList.contains("row-body")).toBe(true);
  });

  it("scopes the slot with item, index, and locked-ness", () => {
    const root = mountWithActions([{ key: "a" }, { key: "b" }], { lockedKeys: ["b"] });

    const marks = Array.from(root.querySelectorAll(".row-actions")) as HTMLElement[];
    expect(marks).toHaveLength(2);
    expect(marks.map((m) => `${m.dataset.key}:${m.dataset.index}:${m.dataset.locked}`).join(",")).toBe(
      "a:0:false,b:1:true",
    );
  });

  it("renders no lane for hosts that do not adopt the slot", () => {
    const root = mountList(["a"], []);

    expect(root.querySelectorAll(".hk-draggable-list-actions")).toHaveLength(0);
  });

  it("keeps a press on a lane button from arming a drag — the handle still drags", async () => {
    /** The lane exists to host buttons, so the row's interactive-content
     *  exclusion (button, a, input, textarea, select, [contenteditable])
     *  must own every press that starts on one — and a lane FULL of
     *  buttons must leave the handle's drag path untouched. */
    const PointerEventCtor: typeof MouseEvent =
      (globalThis as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? MouseEvent;
    const fire = (el: Element, type: string, x = 0, y = 0) =>
      el.dispatchEvent(
        new PointerEventCtor(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }),
      );
    const fireWin = (type: string, x = 0, y = 0) =>
      window.dispatchEvent(new PointerEventCtor(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(HDraggableList, { items: [{ key: "a" }] }, {
          item: ({ item }: { item: { key: string } }) => h("span", { class: "row-body" }, item.key),
          actions: () => [
            h("button", { class: "lane-button", type: "button" }, "✏"),
            h("button", { class: "lane-button", type: "button" }, "⋯"),
          ],
        }),
    });
    app.mount(container);
    mounts.push({ app, container });
    const root = container.querySelector(".hk-draggable-list") as HTMLElement;
    const row = root.querySelector(".hk-draggable-list-item") as HTMLElement;
    const button = row.querySelector(".lane-button") as HTMLElement;
    const handle = row.querySelector(".hk-draggable-list-handle") as HTMLElement;

    // Press ON the button (target = button, bubbling to the row) and
    // travel far past the arm threshold: no drag may publish.
    fire(button, "pointerdown", 10, 10);
    fireWin("pointermove", 30, 40);
    await nextTick();
    expect(row.hasAttribute("data-dragging")).toBe(false);

    // The same gesture on the handle still arms — a button-filled lane
    // never breaks the drag path.
    fire(handle, "pointerdown", 10, 10);
    fireWin("pointermove", 30, 40);
    await nextTick();
    expect(row.getAttribute("data-dragging")).not.toBeNull();

    fireWin("pointerup");
  });
});
