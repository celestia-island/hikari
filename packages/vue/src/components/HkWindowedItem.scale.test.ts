import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkWindowedItem from "./HkWindowedItem";
import { provideScrollWindow } from "../composables/useScrollWindow";

const SCREEN = 400; // laid-out size of the scroll root, in its own units
const ITEM = 40;

const apps: ReturnType<typeof createApp>[] = [];
let originalRect: typeof HTMLElement.prototype.getBoundingClientRect;
/** Drawn (client) geometry of the windowed item, in drawn pixels. */
let itemDrawn = { top: 0, height: ITEM };

function rectOf(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

beforeEach(() => {
  originalRect = HTMLElement.prototype.getBoundingClientRect;
  // The component's own root is created inside the mount, so its drawn box is
  // scripted per element class rather than per instance.
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    if (this.classList?.contains("hk-windowed-item")) {
      return rectOf(0, itemDrawn.top, 200, itemDrawn.height);
    }
    return originalRect.call(this);
  };
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
    observe(): void {}
    disconnect(): void {}
  } as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = originalRect;
  for (const app of apps.splice(0)) app.unmount();
  document.body.innerHTML = "";
  delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
});

/**
 * Mount one windowed item against a scroll root whose drawn box is `scale`
 * times its laid-out box (zoom on `documentElement`, a transformed ancestor, or
 * a scoped `zoom` all produce this), with the item laid out `laidTop` units
 * below the root's top. Returns whether the item mounted real content or the
 * placeholder.
 */
async function dataState(laidTop: number, scale: number): Promise<string | null> {
  const rootEl = document.createElement("div");
  document.body.appendChild(rootEl);
  Object.defineProperty(rootEl, "offsetWidth", { configurable: true, value: SCREEN });
  Object.defineProperty(rootEl, "offsetHeight", { configurable: true, value: SCREEN });
  Object.defineProperty(rootEl, "clientHeight", { configurable: true, value: SCREEN });
  Object.defineProperty(rootEl, "getBoundingClientRect", {
    configurable: true,
    value: () => rectOf(0, 0, SCREEN * scale, SCREEN * scale),
  });
  itemDrawn = { top: laidTop * scale, height: ITEM * scale };

  const scrollRoot = ref<HTMLElement | null>(rootEl);
  const Host = defineComponent({
    setup() {
      provideScrollWindow(scrollRoot, 1);
      return () => h(HkWindowedItem, { estimatedHeight: ITEM }, { default: () => h("span", { class: "real" }) });
    },
  });
  const app = createApp(Host);
  apps.push(app);
  const container = document.createElement("div");
  document.body.appendChild(container);
  app.mount(container);
  await nextTick();
  const item = container.querySelector<HTMLElement>(".hk-windowed-item");
  return item?.getAttribute("data-state") ?? null;
}

describe("HkWindowedItem scaled-space buffer", () => {
  it("keeps an item inside the overscan band that a scaled root draws out of it", async () => {
    // One laid-out screen of overscan = 400 of the root's own units. An item
    // 350 units below the root's bottom is inside it - but it is *drawn* 700px
    // below, so a buffer compared in drawn pixels without the scale reads as an
    // empty slot and the row unmounts while still on (scaled) screen.
    expect(await dataState(750, 2)).toBe("real");
  });

  it("still windows out an item beyond the overscan band when scaled", async () => {
    // 500 laid-out units below the bottom > one screen of overscan: out either
    // way, so the fix is not "always render".
    expect(await dataState(900, 2)).toBe("placeholder");
  });

  it("is unchanged for an unscaled root", async () => {
    expect(await dataState(750, 1)).toBe("real");
    expect(await dataState(900, 1)).toBe("placeholder");
  });
});
