import { afterEach, describe, expect, it, vitest } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import HkVirtualCursor from "./HkVirtualCursor";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

interface Harness {
  root: HTMLElement;
  glyph: HTMLElement;
  lobes: HTMLButtonElement[];
  presses: [number, boolean][];
}

interface CursorProps {
  x: number;
  y: number;
  viewport: { width: number; height: number };
  buttons?: number;
  label?: string;
}

/** Mount an HkVirtualCursor through a wrapper app and collect press
 *  events (the HkFab.test.tsx mount pattern). */
function mountCursor(props: CursorProps): Harness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const harness: Harness = {
    root: document.createElement("div"),
    glyph: document.createElement("div"),
    lobes: [],
    presses: [],
  };

  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkVirtualCursor, {
          "onPress": (mask: number, down: boolean) => { harness.presses.push([mask, down]); },
          ...props,
        });
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);

  const root = container.querySelector<HTMLElement>(".hk-virtual-cursor");
  const glyph = container.querySelector<HTMLElement>(".hk-virtual-cursor__glyph");
  const lobes = [...container.querySelectorAll<HTMLButtonElement>(".hk-virtual-cursor__lobe")];
  if (!root || !glyph || lobes.length !== 2) throw new Error("HkVirtualCursor did not render its shell");
  harness.root = root;
  harness.glyph = glyph;
  harness.lobes = lobes;
  return harness;
}

afterEach(() => {
  while (mounts.length) mounts.pop()?.unmount();
  while (containers.length) containers.pop()?.remove();
});

/** Percentage mapping: x/width*100 positions the glyph inside the
 * inset-0 overlay, so the letterbox/fill transform of the underlying
 * canvas carries the pointer with the pixels. */
describe("HkVirtualCursor", () => {
  it("maps remote coordinates to percentage positions", () => {
    const { glyph } = mountCursor({ x: 960, y: 270, viewport: { width: 1920, height: 1080 } });
    const style = glyph.getAttribute("style") ?? "";
    expect(style).toContain("left: 50%");
    expect(style).toContain("top: 25%");
  });

  it("survives a degenerate viewport without NaN", () => {
    const { glyph } = mountCursor({ x: 5, y: 5, viewport: { width: 0, height: 0 } });
    const style = glyph.getAttribute("style") ?? "";
    expect(style).not.toContain("NaN");
  });

  it("lobes emit press down/up with their masks", async () => {
    const { lobes, presses } = mountCursor({ x: 10, y: 10, viewport: { width: 100, height: 100 } });
    const [left, right] = lobes;
    left!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    left!.dispatchEvent(new Event("pointerup", { bubbles: true }));
    right!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    right!.dispatchEvent(new Event("pointerup", { bubbles: true }));
    await nextTick();
    expect(presses).toEqual([
      [0b001, true],
      [0b001, false],
      [0b100, true],
      [0b100, false],
    ]);
  });

  it("a held mask renders the matching lobe held; leave releases only held lobes", async () => {
    const { lobes, presses } = mountCursor({
      x: 10, y: 10, viewport: { width: 100, height: 100 }, buttons: 0b001,
    });
    const [left, right] = lobes;
    expect(left!.hasAttribute("data-held")).toBe(true);
    expect(right!.hasAttribute("data-held")).toBe(false);
    left!.dispatchEvent(new Event("pointerleave", { bubbles: true }));
    right!.dispatchEvent(new Event("pointerleave", { bubbles: true }));
    await nextTick();
    expect(presses, "only the held lobe releases").toEqual([[0b001, false]]);
  });
});
