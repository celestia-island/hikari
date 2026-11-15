import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import { MASK_LEFT, MASK_RIGHT } from "../components/remoteInputTypes";
import { useVirtualPointer } from "./useVirtualPointer";

function makeSinks() {
  return {
    pointer: vi.fn(),
    wheel: vi.fn(),
  };
}

describe("useVirtualPointer", () => {
  it("starts centered in the viewport and reports nothing until touched", () => {
    const sinks = makeSinks();
    const vp = useVirtualPointer(ref({ width: 1920, height: 1080 }), sinks);
    expect(vp.state.x).toBe(960);
    expect(vp.state.y).toBe(540);
    expect(vp.state.buttons).toBe(0);
    expect(sinks.pointer).not.toHaveBeenCalled();
  });

  it("nudge rescales display px into remote px and reports", () => {
    const sinks = makeSinks();
    const vp = useVirtualPointer(ref({ width: 1920, height: 1080 }), sinks);
    // A 960px-wide display box: 1 display px = 2 remote px.
    vp.nudge(10, -5, 960);
    expect(vp.state.x).toBe(980);
    expect(vp.state.y).toBe(530);
    expect(sinks.pointer).toHaveBeenLastCalledWith(980, 530, 0);
  });

  it("nudge clamps at the viewport edges (a pinned pointer reports nothing)", () => {
    const sinks = makeSinks();
    const vp = useVirtualPointer(ref({ width: 100, height: 100 }), sinks);
    vp.nudge(-1000, 0, 100); // to x=0
    expect(vp.state.x).toBe(0);
    sinks.pointer.mockClear();
    vp.nudge(-50, 0, 100); // already pinned
    expect(vp.state.x).toBe(0);
    expect(sinks.pointer, "pinned move reports nothing").not.toHaveBeenCalled();
  });

  it("press reports absolute masks; tap is down-then-up in order", () => {
    const sinks = makeSinks();
    const vp = useVirtualPointer(ref({ width: 100, height: 100 }), sinks);
    vp.tap(MASK_LEFT);
    const calls = sinks.pointer.mock.calls.map((c) => c[2]);
    expect(calls).toEqual([1, 0]); // press then release, positionally stable
    vp.press(MASK_RIGHT, true);
    expect(sinks.pointer).toHaveBeenLastCalledWith(50, 50, 4);
    vp.press(MASK_RIGHT, false);
    expect(sinks.pointer).toHaveBeenLastCalledWith(50, 50, 0);
  });

  it("press with an unchanged mask is silent", () => {
    const sinks = makeSinks();
    const vp = useVirtualPointer(ref({ width: 100, height: 100 }), sinks);
    vp.press(MASK_LEFT, false); // releasing a mask never held
    expect(sinks.pointer).not.toHaveBeenCalled();
  });

  it("wheel rides the sink with the live position untouched", () => {
    const sinks = makeSinks();
    const vp = useVirtualPointer(ref({ width: 100, height: 100 }), sinks);
    vp.wheel(2);
    vp.wheel(0); // a no-notch is dropped
    expect(sinks.wheel).toHaveBeenCalledTimes(1);
    expect(sinks.wheel).toHaveBeenLastCalledWith(2);
    expect(sinks.pointer).not.toHaveBeenCalled();
  });

  it("a shrinking viewport re-clamps the stranded pointer", async () => {
    const sinks = makeSinks();
    const vpRef = ref({ width: 1920, height: 1080 });
    const vp = useVirtualPointer(vpRef, sinks);
    vp.nudge(500, 0, 960); // x: 960 -> 1960 clamps to 1919
    expect(vp.state.x).toBe(1919);
    vpRef.value = { width: 800, height: 600 }; // frame shrank
    await Promise.resolve();
    expect(vp.state.x, "pointer pulled inside the new bounds").toBe(799);
  });
});
