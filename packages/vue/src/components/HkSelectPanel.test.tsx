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
    .querySelectorAll(".hk-popover-panel, .hk-popover-scrim, .hk-select-sheet-panel, .hk-select-sheet-scrim")
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

    const popout = document.body.querySelector<HTMLElement>(".hk-select-popout")!;
    expect(popout).toBeTruthy();
    const z = Number.parseInt(popout.style.zIndex, 10);
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

    const popout = document.body.querySelector<HTMLElement>(".hk-select-popout")!;
    const top = Number.parseInt(popout.style.top, 10);
    // Anchor bottom at 520 → a top-start panel sits above 520 (minus offset).
    expect(top).toBeLessThan(520);
    expect(popout.style.minWidth).toBe("100px");

    // Starved top side flips the panel below the anchor instead.
    anchor.getBoundingClientRect = () =>
      ({ top: 0, bottom: 8, left: 40, right: 140, width: 100, height: 8 }) as DOMRect;
    window.dispatchEvent(new Event("resize"));
    await nextTick();
    const flipped = Number.parseInt(popout.style.top, 10);
    expect(flipped).toBeGreaterThan(8);
  });
});
