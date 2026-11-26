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

  it("a fragment host refuses the props loudly instead of ignoring them silently", () => {
    const { container, warn } = mountDurations("", { duration: "0.5s" });
    expect(container.querySelector("ul")).toBeNull();
    expect(container.textContent).toContain("a");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("--hk-list-duration on an ancestor");
    warn.mockRestore();
  });
});
