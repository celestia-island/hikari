import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import { useSurfaceMachine } from "./useSurfaceMachine";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

interface Rig {
  phase: () => string;
  mounted: () => boolean;
  classesFor: (prefix: string) => string[];
  send: (e: "OPEN" | "CLOSE" | "FLIP" | "DEADLINE" | "TEND" | "UNMOUNT") => void;
  edges: Array<[string, string, string]>;
  unmount: () => void;
}

/** Mount a machine with two test layers (like a modal's scrim+panel)
 *  and capture every phase edge it walks. */
function mountRig(): Rig {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const edges: Array<[string, string, string]> = [];
  const machineRef: { current: ReturnType<typeof useSurfaceMachine> | null } = { current: null };
  const app = createApp(defineComponent({
    setup() {
      machineRef.current = useSurfaceMachine({
        layers: [
          { prefix: "rig-scrim", enterMs: () => 300, leaveMs: () => 300 },
          { prefix: "rig-panel", enterMs: () => 300, leaveMs: () => 250 },
        ],
        onPhase: (from, to, event) => { edges.push([from, to, event]); },
      });
      const m = machineRef.current;
      return () =>
        h("div", [
          m.mounted.value ? h("div", { class: ["scrim", ...m.classesFor("rig-scrim")] }) : null,
          m.mounted.value ? h("div", { class: ["panel", ...m.classesFor("rig-panel")] }) : null,
        ]);
    },
  }));
  app.mount(container);
  const m = machineRef.current!;
  return {
    phase: () => m.phase.value,
    mounted: () => m.mounted.value,
    classesFor: m.classesFor,
    send: m.send,
    edges,
    unmount: () => app.unmount(),
  };
}

function scrimClasses(rig: Rig): string[] {
  return Array.from(document.querySelector<HTMLElement>(".scrim")?.classList ?? [])
    .filter((c) => c.startsWith("rig-scrim-"));
}

async function flush(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

describe("useSurfaceMachine driver", () => {
  it("renders mounted with enter-from classes on OPEN, flips on rAF, rests on deadline", async () => {
    vi.useFakeTimers();
    const rig = mountRig();
    rig.send("OPEN");
    await nextTick();
    expect(rig.mounted()).toBe(true);
    expect(rig.phase()).toBe("openingFrom");
    expect(scrimClasses(rig)).toEqual(["rig-scrim-enter-from", "rig-scrim-enter-active"]);

    // Frame flip: the clock drives the (faked) rAF frames — well before
    // the flip timer's own budget, so this exercises the frame path.
    await vi.advanceTimersByTimeAsync(40);
    expect(rig.phase()).toBe("openingTo");
    expect(scrimClasses(rig)).toEqual(["rig-scrim-enter-to", "rig-scrim-enter-active"]);

    // Deadline settles the surface at rest with no transition classes.
    await vi.advanceTimersByTimeAsync(600);
    expect(rig.phase()).toBe("open");
    expect(scrimClasses(rig)).toEqual([]);
    // No late events: nothing fires into the resting surface.
    const edgesAtRest = rig.edges.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(rig.phase()).toBe("open");
    expect(scrimClasses(rig)).toEqual([]);
    expect(rig.edges.length).toBe(edgesAtRest);
  });

  it("settles open under total rAF starvation (flip timer + deadline only)", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", () => 0 as unknown as number);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const rig = mountRig();
    rig.send("OPEN");
    await nextTick();
    expect(rig.phase()).toBe("openingFrom");
    // No frames ever arrive; the flip timer forces FLIP…
    await vi.advanceTimersByTimeAsync(120);
    expect(rig.phase()).toBe("openingTo");
    // …and the deadline walks to rest. Bounded, no watchdogs.
    await vi.advanceTimersByTimeAsync(600);
    expect(rig.phase()).toBe("open");
    expect(scrimClasses(rig)).toEqual([]);
  });

  it("close → deadline finalizes to closed and unmounts the DOM", async () => {
    vi.useFakeTimers();
    const rig = mountRig();
    rig.send("OPEN");
    await vi.advanceTimersByTimeAsync(800);
    expect(rig.phase()).toBe("open");

    rig.send("CLOSE");
    await nextTick();
    expect(rig.phase()).toBe("closingFrom");
    rig.send("FLIP");
    await nextTick();
    expect(rig.phase()).toBe("closingTo");
    expect(scrimClasses(rig)).toEqual(["rig-scrim-leave-to", "rig-scrim-leave-active"]);

    await vi.advanceTimersByTimeAsync(600);
    expect(rig.phase()).toBe("closed");
    expect(rig.mounted()).toBe(false);
    expect(document.querySelector(".panel")).toBeNull();
    // No late events resurrect anything.
    const edgesAtRest = rig.edges.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(rig.phase()).toBe("closed");
    expect(rig.edges.length).toBe(edgesAtRest);
  });

  it("a reopen during the closing window reverses on the same element", async () => {
    vi.useFakeTimers();
    const rig = mountRig();
    rig.send("OPEN");
    await vi.advanceTimersByTimeAsync(800);
    rig.send("CLOSE");
    await vi.advanceTimersByTimeAsync(50); // mid-flight (still *.from window)
    expect(["closingFrom", "closingTo"]).toContain(rig.phase());

    rig.send("OPEN");
    await nextTick();
    expect(rig.phase()).toBe("openingFrom");
    // Element identity preserved across the reversal.
    const panel = document.querySelector(".panel")!;
    expect(panel).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(rig.phase()).toBe("open");
    expect(document.querySelector(".panel")).toBe(panel);
    // The close never finalized — exactly one open edge, no ghost edges.
    const closes = rig.edges.filter(([, to]) => to === "closed");
    expect(closes).toHaveLength(0);
  });

  it("honors a measured CSS duration: settles only after duration+slack", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", () => 0 as unknown as number);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    // Real-browser shape: computed transition-duration of 0.3s. The
    // probe tightens the deadline to flip(120)+300+slack(80)=500 for the
    // from-phase and 300+slack for the to-phase — never the configured
    // fallback, never the zero-duration fast path.
    const realGCS = window.getComputedStyle.bind(window);
    vi.stubGlobal("getComputedStyle", (el: Element, ...rest: unknown[]) => {
      const style = realGCS(el as Element, ...(rest as []));
      return { ...style, transitionDuration: "0.3s" } as CSSStyleDeclaration;
    });
    const rig = mountRig();
    rig.send("OPEN");
    await nextTick();
    await vi.advanceTimersByTimeAsync(130); // flip timer forced the FLIP
    expect(rig.phase()).toBe("openingTo");
    // Inside duration+slack (380ms from the flip) nothing settles…
    await vi.advanceTimersByTimeAsync(300);
    expect(rig.phase()).toBe("openingTo");
    // …past it, the deadline completes the open.
    await vi.advanceTimersByTimeAsync(120);
    expect(rig.phase()).toBe("open");
    expect(scrimClasses(rig)).toEqual([]);
  });

  it("UNMOUNT from any phase clears every clock and walks to closed", async () => {
    vi.useFakeTimers();
    const rig = mountRig();
    rig.send("OPEN");
    await vi.advanceTimersByTimeAsync(50); // mid opening
    expect(rig.phase()).not.toBe("closed");
    rig.unmount();
    expect(vi.getTimerCount()).toBe(0);
    // Nothing fires after teardown (no late timers).
    await vi.advanceTimersByTimeAsync(5000);
    expect(rig.edges.at(-1)).toEqual([
      expect.any(String),
      "closed",
      "UNMOUNT",
    ]);
  });
});
