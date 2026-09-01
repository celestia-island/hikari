/**
 * Source contract: while an HkPopover is open, no native browser tooltip
 * may fire over the custom popup — the anchor's `title` AND every
 * descendant `title` are blanked and restored exactly (the model pill of
 * hikari #338 was a descendant-title case). Restore must be lossless:
 * elements without a title never gain one, `title=""` stays `title=""`,
 * and unmounting while open must not leak a blanked title.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkPopover from "./HkPopover";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  // happy-dom never fires transitionend, so leave transitions never
  // finish and teleported panels linger on <body> — strip them or the
  // next test's querySelector sees this test's panel.
  document.body
    .querySelectorAll(".hk-popover-panel, .hk-popover-scrim")
    .forEach((el) => el.remove());
  vi.restoreAllMocks();
});

function setViewport(width: number) {
  window.innerWidth = width;
  window.dispatchEvent(new Event("resize"));
}

/**
 * Mounts an HkPopover whose anchor is a plain DOM node (NOT rendered by
 * Vue) so tests can decorate it with arbitrary `title` attributes and
 * observe attribute mutations without Vue's patching interfering.
 */
function mountPopover(opts: { open?: boolean; anchor?: HTMLElement } = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const anchor = opts.anchor ?? document.createElement("button");
  // Only seed text on a fresh anchor — a caller-provided one may already
  // carry the decorated descendants under test (textContent would wipe them).
  if (!opts.anchor) anchor.textContent = "anchor";
  container.appendChild(anchor);

  const open = ref(opts.open ?? false);
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkPopover, {
          modelValue: open.value,
          "onUpdate:modelValue": (v: boolean) => { open.value = v; },
          anchorRef: anchor,
        }, { default: () => h("div", { class: "pop-content" }, "content") });
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return { open, app, anchor };
}

describe("HkPopover native title suppression", () => {
  it("blanks the anchor's and descendants' titles while open and restores both exactly on close", async () => {
    setViewport(1200);
    const anchor = document.createElement("button");
    anchor.setAttribute("title", "anchor tip");
    const inner = document.createElement("span");
    inner.setAttribute("title", "inner tip");
    const nested = document.createElement("em");
    nested.setAttribute("title", "nested tip");
    inner.appendChild(nested);
    anchor.appendChild(inner);

    const { open } = mountPopover({ anchor });
    await nextTick();
    expect(anchor.getAttribute("title")).toBe("anchor tip");

    open.value = true;
    await nextTick();
    expect(anchor.getAttribute("title")).toBe("");
    expect(inner.getAttribute("title")).toBe("");
    expect(nested.getAttribute("title")).toBe("");

    open.value = false;
    await nextTick();
    expect(anchor.getAttribute("title")).toBe("anchor tip");
    expect(inner.getAttribute("title")).toBe("inner tip");
    expect(nested.getAttribute("title")).toBe("nested tip");
  });

  it("does not grant a title to an element that never had one", async () => {
    setViewport(1200);
    const anchor = document.createElement("button");
    anchor.setAttribute("title", "anchor tip");
    const plain = document.createElement("span");
    anchor.appendChild(plain);

    const { open } = mountPopover({ anchor });
    open.value = true;
    await nextTick();
    open.value = false;
    await nextTick();

    expect(plain.hasAttribute("title")).toBe(false);
    expect(plain.getAttribute("title")).toBeNull();
  });

  it("leaves an existing title=\"\" as title=\"\" (not removed, not filled)", async () => {
    setViewport(1200);
    const anchor = document.createElement("button");
    const empty = document.createElement("span");
    empty.setAttribute("title", "");
    anchor.appendChild(empty);

    const { open } = mountPopover({ anchor });
    open.value = true;
    await nextTick();
    expect(empty.hasAttribute("title")).toBe(true);
    expect(empty.getAttribute("title")).toBe("");

    open.value = false;
    await nextTick();
    expect(empty.hasAttribute("title")).toBe(true);
    expect(empty.getAttribute("title")).toBe("");
  });

  it("restores the anchor's title when unmounted while open", async () => {
    setViewport(1200);
    const anchor = document.createElement("button");
    anchor.setAttribute("title", "unmount tip");

    const { open, app } = mountPopover({ anchor });
    open.value = true;
    await nextTick();
    expect(anchor.getAttribute("title")).toBe("");

    app.unmount();
    expect(anchor.getAttribute("title")).toBe("unmount tip");
  });

  it("performs no title-related DOM mutations when the anchor has no titles anywhere", async () => {
    setViewport(1200);
    const anchor = document.createElement("button");
    const plain = document.createElement("span");
    anchor.appendChild(plain);
    const setSpy = vi.spyOn(anchor, "setAttribute");
    const removeSpy = vi.spyOn(anchor, "removeAttribute");

    const { open } = mountPopover({ anchor });
    open.value = true;
    await nextTick();
    open.value = false;
    await nextTick();

    expect(setSpy).not.toHaveBeenCalled();
    expect(removeSpy).not.toHaveBeenCalled();
    expect(anchor.hasAttribute("title")).toBe(false);
    expect(anchor.querySelector("[title]")).toBeNull();
  });

  it("restores the retired anchor and suppresses the new one on a mid-open anchorRef swap", async () => {
    setViewport(1200);
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const oldAnchor = document.createElement("button");
    oldAnchor.setAttribute("title", "old tip");
    const oldInner = document.createElement("span");
    oldInner.setAttribute("title", "old inner tip");
    oldAnchor.appendChild(oldInner);
    const newAnchor = document.createElement("button");
    newAnchor.setAttribute("title", "new tip");
    container.append(oldAnchor, newAnchor);

    const open = ref(false);
    const anchorRef = ref<HTMLElement | null>(oldAnchor);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkPopover, {
            modelValue: open.value,
            "onUpdate:modelValue": (v: boolean) => { open.value = v; },
            anchorRef: anchorRef.value,
          }, { default: () => h("div", { class: "pop-content" }, "content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);

    open.value = true;
    await nextTick();
    expect(oldAnchor.getAttribute("title")).toBe("");
    expect(oldInner.getAttribute("title")).toBe("");

    anchorRef.value = newAnchor;
    await nextTick();
    expect(oldAnchor.getAttribute("title")).toBe("old tip");
    expect(oldInner.getAttribute("title")).toBe("old inner tip");
    expect(newAnchor.getAttribute("title")).toBe("");

    open.value = false;
    await nextTick();
    expect(newAnchor.getAttribute("title")).toBe("new tip");
    expect(oldAnchor.getAttribute("title")).toBe("old tip");
  });

  it("restores the retired subtree when opening and an anchor swap land in the same flush", async () => {
    setViewport(1200);
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const anchorA = document.createElement("button");
    anchorA.setAttribute("title", "A tip");
    const childA = document.createElement("span");
    childA.setAttribute("title", "A child tip");
    anchorA.appendChild(childA);
    const anchorB = document.createElement("button");
    anchorB.setAttribute("title", "B tip");
    const childB = document.createElement("span");
    childB.setAttribute("title", "B child tip");
    anchorB.appendChild(childB);
    container.append(anchorA, anchorB);

    const open = ref(false);
    const anchorRef = ref<HTMLElement | null>(anchorA);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkPopover, {
            modelValue: open.value,
            "onUpdate:modelValue": (v: boolean) => { open.value = v; },
            anchorRef: anchorRef.value,
          }, { default: () => h("div", { class: "pop-content" }, "content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);

    // Same tick: the popover never observes "open while anchored to A" —
    // open and the swap to B land in one flush together.
    open.value = true;
    anchorRef.value = anchorB;
    await nextTick();
    expect(anchorA.getAttribute("title")).toBe("A tip");
    expect(childA.getAttribute("title")).toBe("A child tip");
    expect(anchorB.getAttribute("title")).toBe("");
    expect(childB.getAttribute("title")).toBe("");

    open.value = false;
    await nextTick();
    expect(anchorA.getAttribute("title")).toBe("A tip");
    expect(childA.getAttribute("title")).toBe("A child tip");
    expect(anchorB.getAttribute("title")).toBe("B tip");
    expect(childB.getAttribute("title")).toBe("B child tip");
  });
});
