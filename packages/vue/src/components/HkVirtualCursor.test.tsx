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

  it("unmount releases a lobe still held (teardown honesty)", async () => {
    const { lobes, presses } = mountCursor({ x: 10, y: 10, viewport: { width: 100, height: 100 } });
    lobes[0]!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    lobes[1]!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(presses).toEqual([[0b001, true], [0b100, true]]);
    // Unmount mid-hold (a mode flip / session drop): BOTH held bits
    // must release — a removed button can never stay latched.
    while (mounts.length) mounts.pop()?.unmount();
    expect(presses).toEqual([
      [0b001, true], [0b100, true],
      [0b001, false], [0b100, false],
    ]);
  });

  it("one holder per bit: a lobe refuses to take over a foreign hold", async () => {
    // LEFT is held by the dock pad (flows in through props.buttons):
    // pressing the left lobe must be refused — its release could not
    // know the dock still holds the bit, and an early release would
    // drop an in-flight drag.
    const { lobes, presses } = mountCursor({
      x: 10, y: 10, viewport: { width: 100, height: 100 }, buttons: 0b001,
    });
    lobes[0]!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    lobes[0]!.dispatchEvent(new Event("pointerup", { bubbles: true }));
    await nextTick();
    expect(presses).toEqual([]);
  });

  it("ownership: a leave releases only what THIS lobe pressed", async () => {
    // The left bit is held by ANOTHER surface (the dock pad — it flows
    // in through props.buttons): this surface's leave must NOT release
    // it, and this surface never re-releases what it never pressed.
    const { lobes, presses } = mountCursor({
      x: 10, y: 10, viewport: { width: 100, height: 100 }, buttons: 0b001,
    });
    const [left, right] = lobes;
    expect(left!.hasAttribute("data-held")).toBe(true); // rendered held…
    left!.dispatchEvent(new Event("pointerleave", { bubbles: true })); // …but not pressed here
    right!.dispatchEvent(new Event("pointerleave", { bubbles: true }));
    await nextTick();
    expect(presses, "neither leave releases the foreign hold").toEqual([]);
    // A lobe pressed HERE still releases on leave.
    right!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    right!.dispatchEvent(new Event("pointerleave", { bubbles: true }));
    await nextTick();
    expect(presses).toEqual([[0b100, true], [0b100, false]]);
  });
});
