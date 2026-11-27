import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import HkListTransition from "./HkListTransition";

/**
 * HkListTransition leave-geometry contract:
 * - a leaving row in an absolute-leave variant (pop/slide/fade/grow) is
 *   pinned to its measured in-flow box by the before-leave hook
 *   (pinLeaveGeometry), so it cannot flash to `width: 100%` of a
 *   collapsed containing block when the host is not position:relative
 * - the `reveal` variant animates its own height and must NOT be pinned
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils dependency; happy-dom has no layout engine, so
 * offset* metrics are stubbed.)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

type Variant = "pop" | "slide" | "fade" | "grow" | "reveal";

function mountRows(variant: Variant, keys: () => string[]) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(
        HkListTransition,
        { tag: "ul", variant },
        { default: () => keys().map((k) => h("li", { key: k }, k)) },
      ),
  });
  mounts.push({ app, container });
  app.mount(container);
  return container;
}

function stubLayout(el: HTMLElement, over: Partial<{
  offsetTop: number;
  offsetLeft: number;
  offsetWidth: number;
  offsetHeight: number;
}> = {}): void {
  const wrapper = el.parentElement as HTMLElement;
  Object.defineProperty(wrapper, "clientWidth", { value: 300, configurable: true });
  Object.defineProperty(el, "offsetParent", { value: wrapper, configurable: true });
  Object.defineProperty(el, "offsetTop", { value: over.offsetTop ?? 0, configurable: true });
  Object.defineProperty(el, "offsetLeft", { value: over.offsetLeft ?? 0, configurable: true });
  Object.defineProperty(el, "offsetWidth", { value: over.offsetWidth ?? 300, configurable: true });
  Object.defineProperty(el, "offsetHeight", { value: over.offsetHeight ?? 40, configurable: true });
}

function rows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("ul > li"));
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkListTransition leave geometry", () => {
  it("pins the leaving grow row to its in-flow box instead of width:100%", async () => {
    const keys = ref(["a", "b", "c"]);
    mountRows("grow", () => keys.value);
    await nextTick();

    stubLayout(rows()[1]!, { offsetTop: 40, offsetLeft: 0, offsetWidth: 300, offsetHeight: 40 });

    keys.value = ["a", "c"];
    await nextTick();
    await nextTick();

    const leaving = document.querySelector<HTMLElement>(".hk-list-grow-leave-active");
    expect(leaving).not.toBeNull();
    // The pin mirrors the measured in-flow box exactly; a percentage
    // width would resolve against a possibly-collapsed containing block.
    expect(leaving!.style.left).toBe("0px");
    expect(leaving!.style.top).toBe("40px");
    expect(leaving!.style.width).toBe("300px");
    expect(leaving!.style.height).toBe("40px");
    expect(leaving!.style.boxSizing).toBe("border-box");
    expect(leaving!.style.width).not.toBe("100%");
  });

  it("does not pin the reveal variant (its own height drives the squeeze)", async () => {
    const keys = ref(["a", "b"]);
    mountRows("reveal", () => keys.value);
    await nextTick();

    stubLayout(rows()[0]!);

    keys.value = ["b"];
    await nextTick();
    await nextTick();

    const leaving = document.querySelector<HTMLElement>(".hk-list-reveal-leave-active");
    expect(leaving).not.toBeNull();
    expect(leaving!.style.height).toBe("");
    expect(leaving!.style.width).toBe("");
  });
});

/** The family's duration contract (2026-11-27): customizable per host,
 *  one default for everything. The props publish custom properties on the
 *  HOST ELEMENT; a fragment host (`tag=""`) has none and refuses loudly. */
describe("HkListTransition duration props", () => {
  function mountDurations(tag: string, props: Record<string, string>) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const app = createApp({
      render: () =>
        h(
          HkListTransition,
          { tag, variant: "pop", move: true, ...props },
          { default: () => [h("li", { key: "a" }, "a")] },
        ),
    });
    mounts.push({ app, container });
    app.mount(container);
    return { container, warn };
  }

  it("a lone duration publishes the move and derives both halves", () => {
    const { container, warn } = mountDurations("ul", { duration: "0.5s" });
    const host = container.querySelector<HTMLElement>("ul")!;
    expect(host.style.getPropertyValue("--hk-list-duration")).toBe("0.5s");
    expect(host.style.getPropertyValue("--hk-list-enter-duration")).toBe("calc(0.5s / 2)");
    expect(host.style.getPropertyValue("--hk-list-leave-duration")).toBe("calc(0.5s / 2)");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("publishes the enter / leave overrides alongside the move", () => {
    const { container, warn } = mountDurations("ul", {
      duration: "300ms",
      enterDuration: "0.1s",
      leaveDuration: "0.2s",
    });
    const host = container.querySelector<HTMLElement>("ul")!;
    expect(host.style.getPropertyValue("--hk-list-duration")).toBe("300ms");
    expect(host.style.getPropertyValue("--hk-list-enter-duration")).toBe("0.1s");
    expect(host.style.getPropertyValue("--hk-list-leave-duration")).toBe("0.2s");
    warn.mockRestore();
  });

  it("writes no inline style at all when no duration is passed (stylesheet defaults)", () => {
    const { container, warn } = mountDurations("ul", {});
    expect(container.querySelector("ul")!.hasAttribute("style")).toBe(false);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("the animation-bus report window follows a custom duration (a long choreography is not cut short)", async () => {
    // The bus report is what tells JS choreography that a transition is in
    // flight (a sheet re-measuring after a row leaves, a size morph). The
    // static REPORT_MS budget (320 ms) covers the default 0.3 s family, but
    // a host that slows the choreography down must not have its report end
    // early — the window is re-read on every arm.
    //
    // ONE instance only, mounted AFTER the spy is in place, and every
    // recorded arm is asserted: an earlier version mounted an unrelated
    // `duration: "2s"` host first and read `calls.at(-1)`, so a 320 ms arm
    // from the survivor could satisfy the assertion — the test passed while
    // failing to distinguish anything (2026-11-27 R4).
    const bus = await import("../runtime/animationBus");
    const spy = vi.spyOn(bus, "reportTransition");
    const keys = ref<string[]>(["a"]);
    const app = createApp({
      render: () =>
        h(
          HkListTransition,
          { tag: "ul", variant: "pop", move: true, duration: "2s" },
          { default: () => keys.value.map((k) => h("li", { key: k }, k)) },
        ),
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    app.mount(host);
    mounts.push({ app, container: host });
    // Nothing was armed by the mount itself (no `appear`): every call from
    // here on belongs to the batch below.
    expect(spy, "the mount alone arms nothing").not.toHaveBeenCalled();
    keys.value = ["a", "b"];
    await nextTick();
    expect(spy, "the enter batch armed a report").toHaveBeenCalled();
    // 2 s of choreography + the 20 ms settle slack, on EVERY arm — a static
    // 320 ms budget would show up here.
    for (const call of spy.mock.calls) {
      expect(call[0], "every armed window follows the custom duration").toBe(2020);
    }
    spy.mockRestore();
  });

  it("the report window reads the MILLISECOND spelling as milliseconds (2026-11-27 R15)", async () => {
    // `cssTimeToMs` documents `0.3s` / `300ms` alike, and the bus window is
    // the only consumer of its arithmetic. Every other case drives the
    // SECONDS branch (`2s`, `0.5s`), so the `ms` unit had no pin: reading it
    // as seconds (300 ms → 0.3 ms) left the entire suite — and the 2026-11-27
    // R15 mutation actually applied to HkListTransition.tsx — green, while
    // every `300ms` host got its choreography report cut to a rounding
    // error. Assert the ARITHMETIC through the bus window (4000, not 2040).
    // MUT:list-ms-unit
    // so the unit branch cannot drift back.
    const bus = await import("../runtime/animationBus");
    const spy = vi.spyOn(bus, "reportTransition");
    const keys = ref<string[]>(["a"]);
    const app = createApp({
      render: () =>
        h(
          HkListTransition,
          { tag: "ul", variant: "pop", move: true, duration: "4000ms" },
          { default: () => keys.value.map((k) => h("li", { key: k }, k)) },
        ),
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    app.mount(host);
    mounts.push({ app, container: host });
    keys.value = ["a", "b"];
    await nextTick();
    expect(spy, "the enter batch armed a report").toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect(call[0], "`4000ms` is four seconds, not four milliseconds").toBe(4020);
    }
    spy.mockRestore();
  });

  it("the report window reads the enter / leave OVERRIDES too, not just a lone duration (2026-11-27 R16)", async () => {
    // The window is `max(duration, enterDuration, leaveDuration)`, but every
    // other case in this describe drives a single prop, so the two
    // OVERRIDE terms had no pin: reading only `duration` left the whole
    // suite green (2026-11-27 R16 mutation) while a host that passes only
    // `enterDuration="2s"` got its 2 s choreography reported for 320 ms —
    // cut short, the exact failure the window exists to prevent.
    const bus = await import("../runtime/animationBus");
    const spy = vi.spyOn(bus, "reportTransition");
    const keys = ref<string[]>(["a"]);
    const app = createApp({
      render: () =>
        h(
          HkListTransition,
          { tag: "ul", variant: "pop", move: true, enterDuration: "2s" },
          { default: () => keys.value.map((k) => h("li", { key: k }, k)) },
        ),
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    app.mount(host);
    mounts.push({ app, container: host });
    keys.value = ["a", "b"];
    await nextTick();
    expect(spy, "the enter batch armed a report").toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect(
        call[0],
        "a lone enterDuration widens the window (a duration-only read gives 320)",
      ).toBe(2020);
    }
    spy.mockRestore();
  });

  it("a fragment host refuses the props loudly instead of ignoring them silently", () => {
    const { container, warn } = mountDurations("", { duration: "0.5s" });
    expect(container.querySelector("ul")).toBeNull();
    expect(container.textContent).toContain("a");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("--hk-list-duration on an ancestor");
    warn.mockRestore();
  });
});
