import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkModal from "./HkModal";
import { closeAll } from "../runtime/useOverlay";
import { usePopupManager } from "../runtime/usePopupManager";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(async () => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
});

describe("HkModal overlay integration", () => {
  it("the JS breakpoint drives the sheet class (2026-11-15 Via-browser field report)", async () => {
    // The CSS media query and the individual `translate` property both
    // lagged on the reporting device's WebView — every HkModal skewed
    // off-viewport-left while HkPopover's JS-class sheet rendered fine.
    // The sheet branch now rides the SAME JS signal: isMobile →
    // .hk-is-sheet, and the SCSS docks the frame by class alone.
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const previousWidth = window.innerWidth;
    const open = ref(true);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, { modelValue: open.value }, { default: () => h("div", "content") });
      },
    });
    try {
      // Mobile: the frame docks via the class.
      (window as { innerWidth: number }).innerWidth = 500;
      const app = createApp(Wrapper);
      mounts.push(app);
      app.mount(container);
      await nextTick();
      const sheetFrame = document.querySelector<HTMLElement>(".hk-modal-content");
      expect(sheetFrame, "modal frame renders").toBeTruthy();
      expect(sheetFrame!.classList.contains("hk-is-sheet")).toBe(true);

      // Desktop: the centered frame comes back (class absent).
      app.unmount();
      (window as { innerWidth: number }).innerWidth = 1280;
      const app2 = createApp(Wrapper);
      mounts.push(app2);
      app2.mount(container);
      await nextTick();
      const deskFrame = document.querySelector<HTMLElement>(".hk-modal-content");
      expect(deskFrame!.classList.contains("hk-is-sheet")).toBe(false);
    } finally {
      (window as { innerWidth: number }).innerWidth = previousWidth;
    }
  });

  it("closeAll() closes an open closable modal through its update:modelValue", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const open = ref(true);
    const emitted: boolean[] = [];
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: open.value,
            closable: true,
            "onUpdate:modelValue": (v: boolean) => { emitted.push(v); open.value = v; },
          }, { default: () => h("div", "content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await nextTick();

    closeAll();
    await nextTick();
    expect(emitted).toEqual([false]);
  });

  it("closeAll() leaves a non-closable modal alone", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const open = ref(true);
    const emitted: boolean[] = [];
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: open.value,
            closable: false,
            "onUpdate:modelValue": (v: boolean) => { emitted.push(v); open.value = v; },
          }, { default: () => h("div", "content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await nextTick();

    closeAll();
    await nextTick();
    expect(emitted).toEqual([]);
  });

  it("closeAbove() closes an open closable modal through its update:modelValue", async () => {
    // The modal-stack breadcrumb jumps back through the popup manager's
    // close channel — a real modal must close exactly as it does for
    // closeAll(), not merely forget its layer.
    const manager = usePopupManager();
    const below = manager.register("modal", true, "Below");
    try {
      const container = document.createElement("div");
      document.body.appendChild(container);
      containers.push(container);

      const open = ref(true);
      const emitted: boolean[] = [];
      const Wrapper = defineComponent({
        setup() {
          return () =>
            h(HkModal, {
              modelValue: open.value,
              closable: true,
              title: "Settings",
              "onUpdate:modelValue": (v: boolean) => { emitted.push(v); open.value = v; },
            }, { default: () => h("div", "content") });
        },
      });
      const app = createApp(Wrapper);
      mounts.push(app);
      app.mount(container);
      await nextTick();

      expect(manager.closeAbove(below.id)).toBe(1);
      await nextTick();
      expect(emitted).toEqual([false]);
    } finally {
      manager.unregister(below.id);
    }
  });

  it("closeAbove() cannot close a non-closable modal", async () => {
    const manager = usePopupManager();
    const below = manager.register("modal", true, "Below");
    try {
      const container = document.createElement("div");
      document.body.appendChild(container);
      containers.push(container);

      const open = ref(true);
      const emitted: boolean[] = [];
      const Wrapper = defineComponent({
        setup() {
          return () =>
            h(HkModal, {
              modelValue: open.value,
              closable: false,
              title: "Locked",
              "onUpdate:modelValue": (v: boolean) => { emitted.push(v); open.value = v; },
            }, { default: () => h("div", "content") });
        },
      });
      const app = createApp(Wrapper);
      mounts.push(app);
      app.mount(container);
      await nextTick();

      // The channel exists (the owner is asked, so the stack knows the
      // layer is there), but a locked modal refuses exactly as it does for
      // Escape and the overlay click.
      expect(manager.closeAbove(below.id)).toBe(1);
      await nextTick();
      expect(emitted).toEqual([]);
      expect(open.value).toBe(true);
    } finally {
      manager.unregister(below.id);
    }
  });
});

describe("HkModal back-guard (window-first back priority)", () => {
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

  it("pushes a history entry on open and back closes the modal, not the page", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const open = ref(true);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: open.value,
            closable: true,
            "onUpdate:modelValue": (v: boolean) => { open.value = v; },
          }, { default: () => h("div", "content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await settle();

    // The open modal owns one marked history entry above the page base.
    expect((window.history.state as Record<string, unknown>)?.__hkBack).toEqual(expect.any(String));

    // Browser/system back: closes the modal and stays on the page.
    // (happy-dom never fires transition end events, so the leave
    // animation keeps the DOM node — the logical state is what matters.)
    window.history.back();
    await until(() => open.value === false);
    await until(() => window.history.state === null);
    app.unmount();
  });

  it("closing via the X button rewinds the pushed entry (no dead back)", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const open = ref(true);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: open.value,
            closable: true,
            "onUpdate:modelValue": (v: boolean) => { open.value = v; },
          }, { default: () => h("div", "content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await settle();
    expect((window.history.state as Record<string, unknown>)?.__hkBack).toEqual(expect.any(String));

    // Unified close chrome: the header close is the shared icon-button X
    // (default-slot glyph, never the fallback placeholder circle).
    const closeBtn = document.querySelector<HTMLButtonElement>(".hk-modal-close")!;
    expect(closeBtn.classList.contains("hk-window-close")).toBe(true);
    expect(closeBtn.querySelector(".hk-icon")).not.toBeNull();
    expect(closeBtn.querySelector("circle")).toBeNull();

    (document.querySelector(".hk-modal-close") as HTMLButtonElement).click();
    await until(() => open.value === false);
    // History rewound to the page base — a subsequent back leaves the page,
    // it is not consumed by a spent modal entry.
    await until(() => window.history.state === null);
    app.unmount();
  });

  it("a non-closable modal never owns history", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const open = ref(true);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: open.value,
            closable: false,
            "onUpdate:modelValue": (v: boolean) => { open.value = v; },
          }, { default: () => h("div", "content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await settle();

    expect((window.history.state as Record<string, unknown>)?.__hkBack).toBeUndefined();
    app.unmount();
  });
});

describe("HkModal autoFollow", () => {
  const SCROLL_H = 1000;
  const CLIENT_H = 300;
  /** scrollTop that leaves exactly 200px hidden below the fold. */
  const CANCEL_TOP = SCROLL_H - CLIENT_H - 200;
  /** Bottom-anchored scrollTop (distance to bottom = 0). */
  const BOTTOM_TOP = SCROLL_H - CLIENT_H;

  async function until(pred: () => boolean, ms = 1500): Promise<void> {
    await vi.waitFor(() => {
      if (!pred()) throw new Error("condition not met yet");
    }, { timeout: ms, interval: 10 });
  }

  interface Setup {
    scroller: HTMLElement;
    tag: () => Element | null;
    jump: () => HTMLButtonElement | null;
  }

  function stubGeometry(el: HTMLElement) {
    for (const [key, value] of [
      ["scrollHeight", SCROLL_H],
      ["clientHeight", CLIENT_H],
    ] as const) {
      Object.defineProperty(el, key, { configurable: true, value });
    }
  }

  /** Mount an open autoFollow modal and return its scroll container.
   *  Geometry stubs land BEFORE the enter transition finishes so the
   *  follow setup sees them; a first scroll pass makes the tag appear. */
  async function mountAutoFollow(): Promise<Setup> {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: true,
            autoFollow: true,
          }, { default: () => h("p", { class: "follow-line" }, "log line") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await nextTick();

    const scroller = document.body.querySelector<HTMLElement>(".hk-modal-body-scroll");
    if (!scroller) throw new Error("scroller not rendered");
    stubGeometry(scroller);

    // onAfterEnter wires setupAutoFollow; poll instead of assuming when
    // the Transition hook fires under happy-dom. One synthetic scroll
    // makes the initial overflow sense deterministic whenever it runs.
    await until(() => {
      scroller.dispatchEvent(new Event("scroll"));
      return document.body.querySelector(".hk-modal-autofollow-tag") !== null;
    });

    return {
      scroller,
      tag: () => document.body.querySelector(".hk-modal-autofollow-tag"),
      jump: () => document.body.querySelector<HTMLButtonElement>(".hk-modal-jump .hk-fab-button"),
    };
  }

  async function flush(): Promise<void> {
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }

  it("streaming-style pinning never cancels follow", async () => {
    const s = await mountAutoFollow();
    expect(s.tag()).not.toBeNull();
    expect(s.jump()).toBeNull();

    // MutationObserver path: append content while pinned at bottom.
    s.scroller.scrollTop = BOTTOM_TOP;
    const inner = document.body.querySelector(".hk-modal-body-inner");
    if (!inner) throw new Error("body inner missing");
    inner.appendChild(document.createElement("p"));
    // Settle frames keep pinning to the (stubbed constant) bottom.
    await until(() => s.scroller.scrollTop === SCROLL_H);
    await flush();
    await flush();

    expect(s.tag()).not.toBeNull();
    expect(s.jump()).toBeNull();
  });

  it("a gesture followed by an over-threshold scroll cancels follow", async () => {
    const s = await mountAutoFollow();
    expect(s.tag()).not.toBeNull();

    s.scroller.dispatchEvent(new WheelEvent("wheel"));
    s.scroller.scrollTop = CANCEL_TOP; // distance 200 > FOLLOW_THRESHOLD
    s.scroller.dispatchEvent(new Event("scroll"));
    await flush();

    expect(s.tag()).toBeNull();
    expect(s.jump()).not.toBeNull();
  });

  it("a slow drag keeps the flag alive across sub-threshold scrolls and cancels", async () => {
    const s = await mountAutoFollow();
    expect(s.tag()).not.toBeNull();

    s.scroller.dispatchEvent(new WheelEvent("wheel"));
    // First sub-threshold step (<32px): still following — must NOT eat
    // the gesture flag (regression guard for BLOCKER 1).
    s.scroller.scrollTop = BOTTOM_TOP - 10; // distance 10
    s.scroller.dispatchEvent(new Event("scroll"));
    await flush();
    expect(s.tag()).not.toBeNull();
    expect(s.jump()).toBeNull();

    // Drag crosses the threshold later: cancellation must still happen.
    s.scroller.scrollTop = CANCEL_TOP; // distance 200
    s.scroller.dispatchEvent(new Event("scroll"));
    await flush();
    expect(s.tag()).toBeNull();
    expect(s.jump()).not.toBeNull();
  });

  it("jump-to-latest pins to bottom, re-arms follow, drops the FAB", async () => {
    const s = await mountAutoFollow();

    s.scroller.dispatchEvent(new WheelEvent("wheel"));
    s.scroller.scrollTop = CANCEL_TOP;
    s.scroller.dispatchEvent(new Event("scroll"));
    await flush();
    const fab = s.jump();
    if (!fab) throw new Error("jump FAB did not appear after cancel");

    fab.click(); // resumeJumpLatest: direct pin + settle frames re-kick
    await until(() => s.scroller.scrollTop === SCROLL_H);
    await until(() => s.tag() !== null);
    expect(s.scroller.scrollTop).toBe(SCROLL_H);
    expect(s.jump()).toBeNull();
    // Follow is armed again: the next streaming chunk must neither
    // cancel nor demand a fresh gesture. (happy-dom keeps scrollTop
    // unclamped above scrollHeight - clientHeight, so geometry reads
    // as "past the bottom" here — the render state is what matters.)
    const innerAfterJump = document.body.querySelector(".hk-modal-body-inner");
    if (!innerAfterJump) throw new Error("body inner missing");
    innerAfterJump.appendChild(document.createElement("p"));
    for (let i = 0; i < 8; i++) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      await flush();
    }
    expect(s.tag()).not.toBeNull();
    expect(s.jump()).toBeNull();
  });
});

// Stack-priority dial slot (user direction 2026-10-04): the window owns
// its dial while it is the topmost window, yields while another window
// stacks above, and the page dial returns on close. The surface machine
// runs on macrotask timers, so every stack transition below is staged
// through vi.waitFor, never bare ticks.
describe("HkModal dial slot (stack priority)", () => {
  async function mountDialModal(withDial: boolean) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const open = ref(true);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: open.value,
            title: "Window",
            "onUpdate:modelValue": (v: boolean) => { open.value = v; },
          }, withDial
            ? {
                default: () => h("div", "body content"),
                dial: () => h("button", { class: "dial-probe" }, "dial"),
              }
            : { default: () => h("div", "body content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    return { open };
  }
  const dialLayer = () => document.body.querySelector(".hk-floating-layer");

  it("mounts its dial slot on the top layer while the window is topmost", async () => {
    await mountDialModal(true);
    await vi.waitFor(() => {
      const layer = dialLayer();
      expect(layer).not.toBeNull();
      expect(layer!.querySelector(".dial-probe")).not.toBeNull();
    });
  });

  it("yields while another window stacks above and returns when it closes", async () => {
    const m = await mountDialModal(true);
    await vi.waitFor(() => expect(dialLayer()).not.toBeNull());
    const { register, unregister } = usePopupManager();
    const above = register("modal", true, "Above");
    await vi.waitFor(() => expect(dialLayer()).toBeNull());
    unregister(above.id);
    await vi.waitFor(() => expect(dialLayer()).not.toBeNull());
    m.open.value = false;
    await vi.waitFor(() => expect(dialLayer()).toBeNull());
  });

  it("renders no dial layer when the window declares none", async () => {
    await mountDialModal(false);
    await vi.waitFor(() => expect(document.body.querySelector(".hk-modal-root")).not.toBeNull());
    expect(dialLayer()).toBeNull();
  });
});

describe("HkModal window-level material slot", () => {
  it("wears the backdrop over the whole frame: layer first, chrome above, no body-level bed", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: true,
            title: "Window",
          }, {
            default: () => h("p", { class: "body-probe" }, "content"),
            backdrop: () => h("div", { class: "material-probe" }, "art"),
          });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);

    await vi.waitFor(() => {
      const content = document.body.querySelector(".hk-modal-content");
      expect(content).not.toBeNull();
      // The frame is MARKED as wearing a material: the stylesheet keys the
      // gutter-cover suppression off this attribute, so a layer without
      // the mark would leave solid bands across the padding.
      expect(content!.getAttribute("data-backdrop")).not.toBeNull();
      const layer = content!.querySelector(".hk-modal-backdrop");
      expect(layer).not.toBeNull();
      // Decorative by contract: inert to pointer and hidden from a11y.
      expect(layer!.getAttribute("aria-hidden")).toBe("true");
      // The artwork sits at FRAME level — above the frame's own fill,
      // below every in-flow chrome band. It must not live in the body:
      // the body-level bed is exactly the "padding looks like a second
      // surface" bug this slot replaces.
      expect(layer!.parentElement).toBe(content);
      expect(content!.querySelector(".hk-modal-body")!.contains(layer!)).toBe(false);
      expect(layer!.querySelector(".material-probe")).not.toBeNull();
      // First child: the header, body and footer all paint above it in
      // source order, so the material never covers the chrome.
      expect(content!.firstElementChild).toBe(layer);
      const header = content!.querySelector(".hk-modal-header");
      expect(header).not.toBeNull();
      expect(layer!.contains(header!)).toBe(false);
    });
  });

  it("renders no layer and no mark when no backdrop is handed in", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, { modelValue: true, title: "Window" }, {
            default: () => h("p", null, "content"),
          });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);

    await vi.waitFor(() => {
      const content = document.body.querySelector(".hk-modal-content");
      expect(content).not.toBeNull();
      expect(content!.getAttribute("data-backdrop")).toBeNull();
      expect(content!.querySelector(".hk-modal-backdrop")).toBeNull();
    });
  });
});

describe("HkModal chrome / content split", () => {
  it("keeps the title bar and the footer action row outside the scaled content region", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: true,
            title: "Window",
            footerActions: [{ label: "OK", variant: "primary" }],
          }, {
            default: () => h("p", { class: "body-probe" }, "content"),
            // The sub-header only exists when the consumer passes this
            // slot — mount it, or its sibling pin below is vacuous.
            header: () => h("p", { class: "subheader-probe" }, "sub"),
          });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);

    await vi.waitFor(() => {
      const content = document.body.querySelector(".hk-modal-content");
      expect(content).not.toBeNull();
      const body = content!.querySelector(".hk-modal-body");
      expect(body).not.toBeNull();
      const header = content!.querySelector(".hk-modal-header");
      const footer = content!.querySelector(".hk-modal-footer");
      expect(header).not.toBeNull();
      expect(footer).not.toBeNull();
      // The open/close scale lives on .hk-modal-body (user direction
      // 2026-11-05: content only). Header and footer must stay SIBLINGS
      // of the body — one level deeper and the chrome would ride the
      // scale again.
      expect(body!.contains(header)).toBe(false);
      expect(body!.contains(footer)).toBe(false);
      expect(header!.parentElement).toBe(content);
      expect(footer!.parentElement).toBe(content);
      // The content itself IS inside the scaled region.
      expect(body!.querySelector(".body-probe")).not.toBeNull();
      // The sub-header is chrome too (it sits above the scroller with its
      // own divider): it must stay a sibling of the body, never ride the
      // content scale.
      const subheader = content!.querySelector(".hk-modal-subheader");
      expect(subheader, "the sub-header slot must render for this pin").not.toBeNull();
      expect(subheader!.querySelector(".subheader-probe")).not.toBeNull();
      expect(body!.contains(subheader)).toBe(false);
      expect(subheader!.parentElement).toBe(content);
      // No inline transform on any ride surface: the animation is CSS
      // class-driven, and an inline `style` transform on the frame, the
      // body or the chrome would win over the stylesheet unseen.
      // Exactly one footer band: an empty decoy sibling before the real
      // action row would make a first-match query read the wrong element.
      expect(content!.querySelectorAll(".hk-modal-footer").length).toBe(1);
      const title = content!.querySelector<HTMLElement>(".hk-modal-title");
      expect(title).not.toBeNull();
      for (const el of [content!, body!, header!, footer!, title!] as HTMLElement[]) {
        const inline = [el.style.transform, el.style.scale, el.style.zoom, el.style.translate]
          .map((value) => value ?? "")
          .join("");
        expect(inline, `inline transform on ${el.className}`).toBe("");
      }
    });
  });
});

describe("HkModal Escape precedence", () => {
  it("lets a nested control own Escape while a bare Escape still closes", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const open = ref(true);
    const emitted: boolean[] = [];
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: open.value,
            closable: true,
            title: "Escape precedence",
            "onUpdate:modelValue": (v: boolean) => { emitted.push(v); open.value = v; },
          }, {
            default: () => h("div", {
              class: "escape-owner",
              onKeydown: (e: KeyboardEvent) => {
                if (e.key === "Escape") e.preventDefault();
              },
            }, "nested control"),
          });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);

    await vi.waitFor(() => {
      expect(document.body.querySelector(".escape-owner")).not.toBeNull();
    });
    const owner = document.body.querySelector<HTMLElement>(".escape-owner")!;

    // The nested control consumes Escape: the window must stay open.
    owner.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
    await nextTick();
    expect(emitted, "a consumed Escape must not close the window").toEqual([]);
    expect(open.value).toBe(true);

    // A bare Escape (nothing below consumed it) still closes.
    const content = document.body.querySelector<HTMLElement>(".hk-modal-content")!;
    content.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
    await nextTick();
    expect(emitted).toEqual([false]);
  });

  it("keeps a consumed Escape from reaching page-level Escape listeners", async () => {
    // One press must mean one action: before the precedence rule a closable
    // window swallowed every Escape at its root, so a handled press travelling
    // on would hand the same key to a page-level listener (a revealed strip, a
    // pointer-reorder cancel) while the nested control also acted on it.
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const open = ref(true);
    const emitted: boolean[] = [];
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: open.value,
            closable: true,
            title: "Escape propagation",
            "onUpdate:modelValue": (v: boolean) => { emitted.push(v); open.value = v; },
          }, {
            default: () => h("div", {
              class: "escape-owner",
              onKeydown: (e: KeyboardEvent) => {
                if (e.key === "Escape") e.preventDefault();
              },
            }, "nested control"),
          });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await vi.waitFor(() => {
      expect(document.body.querySelector(".escape-owner")).not.toBeNull();
    });

    const pageHits: string[] = [];
    const pageListener = (e: KeyboardEvent) => {
      if (e.key === "Escape") pageHits.push("escape");
    };
    document.addEventListener("keydown", pageListener);
    try {
      const owner = document.body.querySelector<HTMLElement>(".escape-owner")!;
      owner.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
      await nextTick();
      expect(emitted, "a consumed Escape must not close the window").toEqual([]);
      expect(pageHits, "a consumed Escape must not reach page-level listeners").toEqual([]);

      // A bare Escape closes AND is still swallowed (the pre-existing rule).
      const content = document.body.querySelector<HTMLElement>(".hk-modal-content")!;
      content.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
      await nextTick();
      expect(emitted).toEqual([false]);
      expect(pageHits, "a closing Escape is swallowed by the window").toEqual([]);
    } finally {
      document.removeEventListener("keydown", pageListener);
    }
  });

  it("does not close a non-closable window on a consumed Escape, and does not swallow it", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const open = ref(true);
    const emitted: boolean[] = [];
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: open.value,
            closable: false,
            title: "Locked",
            "onUpdate:modelValue": (v: boolean) => { emitted.push(v); open.value = v; },
          }, {
            default: () => h("div", {
              class: "escape-owner",
              onKeydown: (e: KeyboardEvent) => {
                if (e.key === "Escape") e.preventDefault();
              },
            }, "nested control"),
          });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await vi.waitFor(() => {
      expect(document.body.querySelector(".escape-owner")).not.toBeNull();
    });
    const owner = document.body.querySelector<HTMLElement>(".escape-owner")!;

    const pageHits: string[] = [];
    const pageListener = (e: KeyboardEvent) => {
      if (e.key === "Escape") pageHits.push("escape");
    };
    document.addEventListener("keydown", pageListener);
    try {
      const consumed = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      owner.dispatchEvent(consumed);
      await nextTick();
      expect(consumed.defaultPrevented, "the nested control consumed the key").toBe(true);
      expect(emitted, "a non-closable window never emits on Escape").toEqual([]);
      expect(open.value).toBe(true);
      // Current semantics: the precedence guard returns before the close path
      // and does NOT stopPropagation for a non-closable window, so page-level
      // listeners still see the key.
      expect(pageHits, "a non-closable window must not swallow the key").toEqual(["escape"]);
    } finally {
      document.removeEventListener("keydown", pageListener);
    }
  });

  it("leaves a bare Escape to the host when the window is not closable", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const open = ref(true);
    const emitted: boolean[] = [];
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: open.value,
            closable: false,
            title: "Locked",
            "onUpdate:modelValue": (v: boolean) => { emitted.push(v); open.value = v; },
          }, {
            default: () => h("div", "content"),
          });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await vi.waitFor(() => {
      expect(document.body.querySelector(".hk-modal-content")).not.toBeNull();
    });
    const content = document.body.querySelector<HTMLElement>(".hk-modal-content")!;

    const pageHits: string[] = [];
    const pageListener = (e: KeyboardEvent) => {
      if (e.key === "Escape") pageHits.push("escape");
    };
    document.addEventListener("keydown", pageListener);
    try {
      const bare = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      content.dispatchEvent(bare);
      await nextTick();
      expect(emitted, "a non-closable window must stay open").toEqual([]);
      expect(open.value).toBe(true);
      expect(pageHits, "the host still gets the key").toEqual(["escape"]);
      expect(bare.defaultPrevented, "and the window did not consume it").toBe(false);
    } finally {
      document.removeEventListener("keydown", pageListener);
    }
  });

  it("keeps the Tab focus trap working when a nested control consumes Tab", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, {
            modelValue: true,
            closable: false,
            title: "Trap",
          }, {
            default: () => h("div", {
              class: "tab-owner",
              onKeydown: (e: KeyboardEvent) => {
                if (e.key === "Tab") e.preventDefault();
              },
            }, [
              h("button", { class: "tab-first" }, "first"),
              h("button", { class: "tab-last" }, "last"),
            ]),
          });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await vi.waitFor(() => {
      expect(document.body.querySelector(".tab-last")).not.toBeNull();
    });
    const first = document.body.querySelector<HTMLButtonElement>(".tab-first")!;
    const last = document.body.querySelector<HTMLButtonElement>(".tab-last")!;
    const owner = document.body.querySelector<HTMLElement>(".tab-owner")!;

    last.focus();
    expect(document.activeElement, "the last focusable holds focus").toBe(last);

    // A nested control consumes Tab; the focus trap must still run. This pins
    // the defaultPrevented guard INSIDE the Escape branch: hoisting it to the
    // top of the handler would silently disable wrapping for exactly this
    // case.
    owner.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
    );
    await nextTick();
    expect(document.activeElement, "focus wraps back to the first focusable").toBe(first);
  });
});

describe("HkModal blur plate", () => {
  it("lets a host name the close affordance (closeLabel)", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const open = ref(true);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(
            HkModal,
            {
              modelValue: open.value,
              "onUpdate:modelValue": (v: boolean) => {
                open.value = v;
              },
              title: "Message",
              closeLabel: "Dismiss message",
            },
            { default: () => h("div", "content") },
          );
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await nextTick();
    // A host whose own wording is more specific than "Close" keeps it on
    // the window's X; unset, the localized default stands (HkModal's
    // long-standing behaviour, unchanged).
    expect(
      document.querySelector(".hk-modal-close")?.getAttribute("aria-label"),
    ).toBe("Dismiss message");
  });

  it("renders the plate as the aria-hidden last child of the root", async () => {
    // The plate is DOM-last so the sheet's stack-covered drop can be keyed
    // by attribute scoping without depending on paint order (z-indexes
    // carry that). Structural pin: last child + hidden from a11y.
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const open = ref(true);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, { modelValue: open.value }, { default: () => h("div", "content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await nextTick();
    await nextTick();
    const root = document.querySelector(".hk-modal-root")!;
    const last = root.lastElementChild as HTMLElement | null;
    expect(last?.classList.contains("hk-modal-blur-plate")).toBe(true);
    expect(last?.getAttribute("aria-hidden")).toBe("true");
  });

  it("marks covered roots while a higher window is open", async () => {
    // TOP-ONLY BLUR wiring: the covered (lower) root carries
    // data-stack-covered; the top root does not. Flips live with the
    // registry: closing the top window un-covers the lower one.
    const mounts2: ReturnType<typeof createApp>[] = [];
    const containers2: HTMLElement[] = [];
    try {
      const openA = ref(true);
      const openB = ref(true);
      const mk = (mv: { value: boolean }, title: string) => {
        const container = document.createElement("div");
        document.body.appendChild(container);
        containers2.push(container);
        const Wrapper = defineComponent({
          setup() {
            return () =>
              h(HkModal, { modelValue: mv.value, title }, { default: () => h("div", "content") });
          },
        });
        const app = createApp(Wrapper);
        mounts2.push(app);
        app.mount(container);
      };
      mk(openA, "下层窗");
      mk(openB, "上层窗");
      await nextTick();
      await nextTick();
      const roots = () => [...document.querySelectorAll(".hk-modal-root")];
      expect(roots()).toHaveLength(2);
      // The later-registered window is the top: the FIRST root is covered.
      const attrs = roots().map((r) => r.hasAttribute("data-stack-covered"));
      expect(attrs).toEqual([true, false]);
      openB.value = false;
      await nextTick();
      // The leave settles on the surface machine's own clock.
      const deadline = Date.now() + 1500;
      while (roots().some((r) => r.classList.contains("hk-modal-content-leave-active")) && Date.now() < deadline) {
        await nextTick();
      }
      const deadline2 = Date.now() + 1500;
      while (roots().some((r) => r.hasAttribute("data-stack-covered")) && Date.now() < deadline2) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        await nextTick();
      }
      expect(roots().every((r) => !r.hasAttribute("data-stack-covered"))).toBe(true);
    } finally {
      for (const a of mounts2.splice(0)) a.unmount();
      for (const c of containers2.splice(0)) c.remove();
    }
  });
});

describe("HkModal top-edge anchor (centred frame must not fly)", () => {
  // 2026-11-23 user direction: "where the content can change inside the
  // card, do not let the whole card fly." The frame is centred by
  // `translate: -50% -50%`, so a height morph of Δ lifts the whole window
  // by Δ/2; the anchor folds the measured drift into --hk-modal-anchor-y.
  function mountModal() {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const open = ref(true);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkModal, { modelValue: open.value, title: "Anchor" },
            { default: () => h("div", "content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    return {
      container,
      open,
      frame: document.querySelector(".hk-modal-content") as HTMLElement,
    };
  }

  it("folds a centred height drift into the anchor variable", async () => {
    // A stubbed observer + a rect that composes the frame's own anchor
    // variable (an engine reports the PAINTED box) makes the closed loop
    // observable without a browser.
    const callbacks: Array<() => void> = [];
    vi.stubGlobal("ResizeObserver", class {
      private readonly cb: () => void;
      constructor(cb: () => void) { this.cb = cb; callbacks.push(cb); }
      observe() {}
      disconnect() {}
      unobserve() {}
    });
    const top = { value: 200 };
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const el = this as HTMLElement;
        const own = el.style?.getPropertyValue("--hk-modal-anchor-y") ?? "";
        const shift = Number(/(-?[\d.]+)px/.exec(own)?.[1] ?? 0);
        const rendered = top.value + shift;
        return {
          top: rendered, left: 0, bottom: rendered, right: 0,
          width: 0, height: 0, x: 0, y: rendered, toJSON: () => ({}),
        } as DOMRect;
      },
    );
    try {
      const { frame } = mountModal();
      for (let i = 0; i < 6; i++) await nextTick();
      expect(frame).not.toBeNull();
      // A centred growth lifted the top edge by 20px.
      top.value = 180;
      for (const cb of callbacks) cb();
      await nextTick();
      // MUT:modal-no-anchor (dropping the useAnchoredTop wiring leaves the
      // variable unset and this goes red).
      expect(frame.style.getPropertyValue("--hk-modal-anchor-y")).toBe("20px");
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  it("never writes the anchor on the mobile sheet branch", async () => {
    // ≤767px the frame is a BOTTOM sheet: growth already goes upward from
    // a fixed bottom edge, so anchoring the TOP would invert the motion.
    const previousWidth = window.innerWidth;
    const callbacks: Array<() => void> = [];
    vi.stubGlobal("ResizeObserver", class {
      private readonly cb: () => void;
      constructor(cb: () => void) { this.cb = cb; callbacks.push(cb); }
      observe() {}
      disconnect() {}
      unobserve() {}
    });
    const top = { value: 200 };
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      () => ({ top: top.value, left: 0, bottom: top.value, right: 0,
        width: 0, height: 0, x: 0, y: top.value, toJSON: () => ({}) }) as DOMRect,
    );
    try {
      (window as { innerWidth: number }).innerWidth = 500;
      const { frame } = mountModal();
      for (let i = 0; i < 6; i++) await nextTick();
      top.value = 180;
      for (const cb of callbacks) cb();
      await nextTick();
      // MUT:modal-anchor-on-sheet (dropping the enabled gate writes the
      // variable on the sheet branch and this goes red).
      expect(frame.style.getPropertyValue("--hk-modal-anchor-y")).toBe("");
    } finally {
      (window as { innerWidth: number }).innerWidth = previousWidth;
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  it("drops the offset on the next open (reopen never inherits the lift)", async () => {
    // The anchor holds after a morph settles (documented), so a dialog that
    // grew once is standing offset. The open edge must clear it, or the
    // SECOND open starts lifted.
    // MUT:modal-anchor-no-reopen-reset (deleting `anchor.reset()` at the
    // open edge leaves the variable set across close→open; this goes red).
    const callbacks: Array<() => void> = [];
    vi.stubGlobal("ResizeObserver", class {
      private readonly cb: () => void;
      constructor(cb: () => void) { this.cb = cb; callbacks.push(cb); }
      observe() {}
      disconnect() {}
      unobserve() {}
    });
    const top = { value: 200 };
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const el = this as HTMLElement;
        const own = el.style?.getPropertyValue("--hk-modal-anchor-y") ?? "";
        const shift = Number(/(-?[\d.]+)px/.exec(own)?.[1] ?? 0);
        const rendered = top.value + shift;
        return { top: rendered, left: 0, bottom: rendered, right: 0,
          width: 0, height: 0, x: 0, y: rendered, toJSON: () => ({}) } as DOMRect;
      },
    );
    try {
      const { frame, open } = mountModal();
      for (let i = 0; i < 8; i++) await nextTick();
      top.value = 180;
      for (const cb of callbacks) cb();
      await nextTick();
      expect(frame.style.getPropertyValue("--hk-modal-anchor-y")).toBe("20px");

      // CLOSE → OPEN as an INTERRUPT (one tick apart): the frame node
      // survives the abortive leave, so a stale offset would ride into the
      // next cycle. This is the only reachable path on which the open-edge
      // reset can matter — a full close unmounts the node and the variable
      // dies with it (verified: the same assertion without the reset and
      // with a settled close passes either way).
      open.value = false;
      await nextTick();
      open.value = true;
      for (let i = 0; i < 40; i++) await nextTick();
      const reopened = (document.querySelector(".hk-modal-content")
        ?? frame) as HTMLElement;
      expect(reopened.style.getPropertyValue("--hk-modal-anchor-y")).toBe("");
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  it("clears the offset when the dialog becomes the mobile sheet", async () => {
    // The gate alone only FREEZES the loop: an offset written on desktop
    // survived into the sheet branch and was re-applied stale on the way
    // back (R2 finding). The breakpoint watch clears it.
    // MUT:modal-anchor-sheet-roundtrip (dropping `watch(sheetMobile, …)`
    // leaves the variable set and this goes red).
    const previousWidth = window.innerWidth;
    const callbacks: Array<() => void> = [];
    vi.stubGlobal("ResizeObserver", class {
      private readonly cb: () => void;
      constructor(cb: () => void) { this.cb = cb; callbacks.push(cb); }
      observe() {}
      disconnect() {}
      unobserve() {}
    });
    const top = { value: 200 };
    /** The frame's live height — the stability probe's only clock. */
    const morphHeight = { value: 200 };
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const el = this as HTMLElement;
        const own = el.style?.getPropertyValue("--hk-modal-anchor-y") ?? "";
        const shift = Number(/(-?[\d.]+)px/.exec(own)?.[1] ?? 0);
        const rendered = top.value + shift;
        return { top: rendered, left: 0, bottom: rendered, right: 0,
          width: 0, height: morphHeight.value, x: 0, y: rendered,
          toJSON: () => ({}) } as DOMRect;
      },
    );
    try {
      (window as { innerWidth: number }).innerWidth = 1200;
      const { frame } = mountModal();
      for (let i = 0; i < 6; i++) await nextTick();
      top.value = 180;
      for (const cb of callbacks) cb();
      await nextTick();
      expect(frame.style.getPropertyValue("--hk-modal-anchor-y")).toBe("20px");

      // Cross into the sheet branch: the desktop offset must go.
      // useBreakpoint tracks the width through a `resize` listener, so the
      // probe must dispatch one — assigning innerWidth alone is invisible.
      (window as { innerWidth: number }).innerWidth = 500;
      window.dispatchEvent(new Event("resize"));
      for (let i = 0; i < 6; i++) await nextTick();
      expect(frame.style.getPropertyValue("--hk-modal-anchor-y")).toBe("");

      // …and coming back must not resurrect it.
      (window as { innerWidth: number }).innerWidth = 1200;
      window.dispatchEvent(new Event("resize"));
      for (let i = 0; i < 6; i++) await nextTick();
      expect(frame.style.getPropertyValue("--hk-modal-anchor-y")).toBe("");

      // R4's kill case: the frame is MID-MORPH when the crossing arrives.
      // A re-base at that instant adopts a transient top, and the loop then
      // bakes it into the resting position (a visible snap-then-lift).
      // `data-hk-morphing` is useSizeMorph's own marker, so the way-out
      // re-anchor defers until the frame settles.
      // The morph is LIVE (the frame's own height is still changing) and has
      // already moved the top edge — anything that re-bases NOW records a
      // geometry the frame will not rest at.
      morphHeight.value = 300;
      (window as { innerWidth: number }).innerWidth = 500;
      window.dispatchEvent(new Event("resize"));
      for (let i = 0; i < 6; i++) await nextTick();
      (window as { innerWidth: number }).innerWidth = 1200;
      window.dispatchEvent(new Event("resize"));
      // The drift fires MID-MORPH, just after the way-out crossing (the
      // height is still stepping; the top is still at the sheet-leg 180).
      // The fixed shape's deferred re-anchor has NOT fired yet (we are
      // inside the 220 ms settle window), so the anchor is still armed at
      // the pre-crossing 200 and a lift to 170 folds in as -30. The naive
      // shape reset at the crossing (adopting the transient 180) — its own
      // arms are already wrong.
      await new Promise((r) => setTimeout(r, 60));
      top.value = 170;
      for (const cb of callbacks) cb();
      await nextTick();
      // The crossing back lands MID-MORPH (the height is still stepping and
      // the frame still sits at the sheet-leg top). Two things happen at a
      // real crossing: the hook's own resize re-base adopts the geometry the
      // frame has at that instant (a viewport change legitimately moves the
      // block), and the deferred anchor reset re-bases again once the frame
      // has settled. The settle window is what keeps that second re-base
      // honest: a naive immediate reset re-bases on the TRANSIENT top and
      // the landed geometry then disagrees with it by 10px.
      top.value = 200;
      morphHeight.value = 400;
      await new Promise((r) => setTimeout(r, 320));
      for (let i = 0; i < 6; i++) await nextTick();
      // Settled: the anchor re-based onto the landed top, so no correction.
      expect(frame.style.getPropertyValue("--hk-modal-anchor-y")).toBe("");

      // A fresh drift after the crossing corrects from the LANDED anchor:
      // 200 → 170 is a 30px lift the loop folds back in. MUT:modal-crossing-
      // rebase-midmorph (a naive immediate reset at the crossing re-based on
      // the transient 180 and leaves only 10px here).
      top.value = 170;
      for (const cb of callbacks) cb();
      await nextTick();
      // MUT:modal-crossing-rebase-midmorph (a naive immediate reset at the
      // crossing re-bases on the transient 180 and lands 10px here instead
      // of 30px).
      expect(frame.style.getPropertyValue("--hk-modal-anchor-y")).toBe("30px");
    } finally {
      (window as { innerWidth: number }).innerWidth = previousWidth;
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});
