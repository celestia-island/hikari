import { afterEach, describe, expect, it } from "vitest";
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
