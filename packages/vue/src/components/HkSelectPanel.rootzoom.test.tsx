/**
 * Regression rig for the select-panel popout under standardized CSS zoom
 * (chest's root-level manual DPI scale): the anchor gBCR and the clamp
 * viewport live in the root VISUAL space, the teleported fixed host
 * paints its local px scaled by the cumulative zoom, and the panel's
 * offsetWidth stays local — positionPanel must multiply the panel size
 * into visual space for the flip/clamp math and divide the written px
 * back to local, or every dropdown lands zoom× away from its trigger.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import type { ComponentPublicInstance } from "vue";

import HkSelectPanel from "./HkSelectPanel";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  document.body
    .querySelectorAll(".hk-select-popout, .hk-select-popout-host, .hk-select-sheet-panel, .hk-select-sheet-scrim")
    .forEach((el) => el.remove());
  vi.restoreAllMocks();
  window.innerWidth = 1200;
});

function rect(x: number, y: number, w: number, h: number): DOMRect {
  return { x, y, width: w, height: h, top: y, left: x, right: x + w, bottom: y + h, toJSON: () => ({}) } as DOMRect;
}

function patchRootZoom(zoom: string) {
  const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    (el: Element, pseudo?: string | null): CSSStyleDeclaration => {
      const decl = original(el, pseudo ?? undefined);
      return new Proxy(decl, {
        get(target, prop, recv) {
          if (prop === "zoom") return el === document.documentElement ? zoom : undefined;
          const v = Reflect.get(target, prop, recv);
          return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
        },
      });
    },
  );
}

function mountPanel() {
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
            onClick: () => { open.value = !open.value; },
          }, "filter"),
          h(HkSelectPanel, {
            open: open.value,
            "onUpdate:open": (v: boolean) => { open.value = v; },
            anchorRef: anchorEl.value,
            title: "Filters",
            placement: "top-start",
          }, {
            default: () => [h("label", { class: "row" }, "a"), h("label", { class: "row" }, "b")],
          }),
        ]);
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return { open, button: container.querySelector<HTMLButtonElement>("button")! };
}

async function flush() {
  await nextTick();
  await nextTick();
  await new Promise((r) => setTimeout(r, 0));
}

describe("HkSelectPanel popout under root CSS zoom", () => {
  // Anchor mid-viewport, panel size unmeasurable in happy-dom (offsetWidth
  // 0) → pw falls back to max(anchorWidth,180)=180, ph to 200.
  const ANCHOR = { x: 200, y: 300, w: 100, h: 40 };

  it("writes visual px verbatim at zoom 1 (identity)", async () => {
    window.innerWidth = 1200;
    patchRootZoom("1");
    const { button } = mountPanel();
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue(rect(ANCHOR.x, ANCHOR.y, ANCHOR.w, ANCHOR.h));

    button.click();
    await flush();

    const host = document.body.querySelector<HTMLElement>(".hk-select-popout-host")!;
    // top = 300 - 4 - 200 = 96, left = 200 (start).
    expect(host.style.top).toBe("96px");
    expect(host.style.left).toBe("200px");
  });

  it("divides the written px by the cumulative root zoom", async () => {
    window.innerWidth = 1200;
    patchRootZoom("2");
    const { button } = mountPanel();
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue(rect(ANCHOR.x, ANCHOR.y, ANCHOR.w, ANCHOR.h));

    button.click();
    await flush();

    const host = document.body.querySelector<HTMLElement>(".hk-select-popout-host")!;
    // Same visual target, written in the host's local space: 96/2, 200/2.
    expect(host.style.top).toBe("48px");
    expect(host.style.left).toBe("100px");
  });
});
