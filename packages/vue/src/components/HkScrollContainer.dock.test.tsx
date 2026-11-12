// Dock-slot contract for HkScrollContainer.
//
// A dock (dockTop / dockBottom named slot) renders as a NON-scrolling
// flex sibling of the viewport: pinned to its edge, occupying layout
// space (the flex: 1 viewport shrinks by the dock's height — content
// can never slide under it). The container measures each mounted dock
// and publishes --hk-scroll-dock-top / --hk-scroll-dock-bottom on the
// host so consumers size their content end-padding against the dock
// without hand-rolled px. The dock-edge fade rides on data-dock-fade.
//
// The FLOATING-dock twin (dockTailClearance) is contract-tested below:
// it spends the shell-published --hk-scroll-tail-bottom as an in-flow
// tail spacer instead of reserving layout space.
//
// House style: raw createApp mounts on shared containers (no
// @vue/test-utils).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, defineComponent, reactive, ref, type VNodeChild } from "vue";

import HkKanban from "./HkKanban";
import HkScrollContainer from "./HkScrollContainer";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

function mountDock(
  slots: Record<string, () => VNodeChild>,
  props: Record<string, unknown> = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const app = createApp(defineComponent({
    setup() {
      return () => h(HkScrollContainer, props, slots);
    },
  }));
  mounts.push(app);
  return app.mount(container);
}

afterEach(() => {
  for (const app of mounts) app.unmount();
  mounts.length = 0;
  for (const el of containers) el.remove();
  containers.length = 0;
});

describe("HkScrollContainer dock slots", () => {
  it("renders a bottom dock as a non-scrolling sibling with the fade marker", () => {
    const vm = mountDock({
      default: () => h("div", { class: "content" }, "rows"),
      dockBottom: () => h("div", { class: "the-dock" }, "dock"),
    });
    const host = vm.$el as HTMLElement;
    const dock = host.querySelector(".hk-scroll-dock[data-side='bottom']");
    expect(dock).toBeTruthy();
    // Sibling of the viewport, not inside it — the dock never scrolls.
    const viewport = host.querySelector(".hk-scroll-container-viewport")!;
    expect(viewport.contains(dock as Node)).toBe(false);
    // The dock-edge fade engages by default for a bottom dock.
    expect(host.getAttribute("data-dock-fade")).toBe("bottom");
    // The measured-height vars are published on the host (0px in
    // happy-dom — no layout; the contract is the vars exist + RO wired).
    expect(host.style.getPropertyValue("--hk-scroll-dock-bottom")).toBe("0px");
    expect(host.style.getPropertyValue("--hk-scroll-dock-top")).toBe("0px");
  });

  it("drops a fade-era data-dir mirror once the gate owns the edges", async () => {
    // The dir mirror belongs to the `fade` band-slot swap (the sheet's RTL
    // rules read it under [data-fade]). When a dock container ALSO had
    // `fade` on for a while and then turns it off, the dock branch takes
    // over - and it must not leave the mirror behind (the cleanup promise
    // is "fade off removes it", which the no-dock tests pin but a dock
    // container exercises through a different branch).
    const instance = ref<{ refresh: () => void } | null>(null);
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const props = reactive({ fade: true, dockFade: true });
    const app = createApp(defineComponent({
      setup() {
        return () =>
          h(
            HkScrollContainer,
            { ref: instance as never, ...props },
            {
              default: () => h("div", { class: "content" }, "rows"),
              dockBottom: () => h("div", { class: "the-dock" }, "dock"),
            },
          );
      },
    }));
    mounts.push(app);
    const host = (app.mount(container) as unknown as { $el: HTMLElement }).$el;
    const viewport = host.querySelector(".hk-scroll-container-viewport") as HTMLElement;
    Object.defineProperty(viewport, "scrollHeight", { value: 400, configurable: true });
    Object.defineProperty(viewport, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(viewport, "scrollTop", { value: 120, configurable: true });
    instance.value?.refresh();
    await Promise.resolve();
    // The fade pass has run, so a mirrored dir exists...
    expect(host.getAttribute("data-dir")).not.toBeNull();

    // ...and turning `fade` off must drop it (the dock branch cleans up)
    // and re-derive the strengths through the binary gate.
    props.fade = false;
    // Let the wrapper re-render first (the spread only re-reads on the
    // wrapper's own render pass); refresh AFTER the child has the new
    // props, or the fade branch runs one last time and re-stamps the dir.
    await Promise.resolve();
    instance.value?.refresh();
    await Promise.resolve();
    expect(host.getAttribute("data-dir")).toBeNull();
    // 280 still hidden below the fold: the dock gate is lit.
    expect(host.style.getPropertyValue("--hk-scroll-fade-strength-bottom")).toBe("1");
  });

  it("retires the dock band at the scroll end instead of covering the last row", async () => {
    // 2026-11-12 user report: the cruise board's band kept painting over
    // its own flush-parked last row at full scroll. Dock bands share the
    // strength vars but are NOT the `fade` ramp, so they used to sit at
    // their designed full depth forever. The dock path now publishes a
    // BINARY gate: lit while content still hides past the edge, retired
    // (0) once nothing does.
    const instance = ref<{ refresh: () => void } | null>(null);
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const app = createApp(defineComponent({
      setup() {
        return () =>
          h(
            HkScrollContainer,
            { ref: instance as never, dockFade: true },
            {
              default: () => h("div", { class: "content" }, "rows"),
              dockBottom: () => h("div", { class: "the-dock" }, "dock"),
            },
          );
      },
    }));
    mounts.push(app);
    const host = (app.mount(container) as unknown as { $el: HTMLElement }).$el;
    const viewport = host.querySelector(".hk-scroll-container-viewport") as HTMLElement;
    const strength = () => host.style.getPropertyValue("--hk-scroll-fade-strength-bottom");

    const stub = (scrollTop: number) => {
      Object.defineProperty(viewport, "scrollHeight", { value: 400, configurable: true });
      Object.defineProperty(viewport, "clientHeight", { value: 100, configurable: true });
      Object.defineProperty(viewport, "scrollTop", { value: scrollTop, configurable: true });
    };

    stub(0);
    instance.value?.refresh();
    await Promise.resolve();
    // 300 hidden below the fold: lit at full depth.
    expect(strength()).toBe("1");

    stub(300);
    viewport.dispatchEvent(new Event("scroll"));
    // The scroll listener re-senses on a scheduled frame; refresh() is the
    // synchronous pass these tests use (the scroll event also proves the
    // listener path does not resurrect the band).
    instance.value?.refresh();
    await Promise.resolve();
    // Parked at the end: nothing left to hide, so the band retires.
    expect(strength()).toBe("0");
  });

  it("keeps the dock gate's 1px deadband, like the overflow sense", async () => {
    // The gate is `depth <= 1`, the same deadband computeOverflow uses, so
    // a band can never retire while a visible sliver is still hidden, and
    // it can never linger one pixel past the end.
    const instance = ref<{ refresh: () => void } | null>(null);
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const app = createApp(defineComponent({
      setup() {
        return () =>
          h(
            HkScrollContainer,
            { ref: instance as never, dockFade: true },
            {
              default: () => h("div", { class: "content" }, "rows"),
              dockBottom: () => h("div", { class: "the-dock" }, "dock"),
            },
          );
      },
    }));
    mounts.push(app);
    const host = (app.mount(container) as unknown as { $el: HTMLElement }).$el;
    const viewport = host.querySelector(".hk-scroll-container-viewport") as HTMLElement;
    const strength = () => host.style.getPropertyValue("--hk-scroll-fade-strength-bottom");
    const stub = (scrollTop: number) => {
      Object.defineProperty(viewport, "scrollHeight", { value: 400, configurable: true });
      Object.defineProperty(viewport, "clientHeight", { value: 100, configurable: true });
      Object.defineProperty(viewport, "scrollTop", { value: scrollTop, configurable: true });
    };

    // vMax = 400 - 100 = 300; scrollTop 298 leaves EXACTLY 2px hidden.
    stub(298); // 2px still hidden: the band stays lit
    instance.value?.refresh();
    await Promise.resolve();
    expect(strength()).toBe("1");

    stub(299); // 1px: inside the shared deadband, the band retires
    instance.value?.refresh();
    await Promise.resolve();
    expect(strength()).toBe("0");
  });

  it("renders a top dock and fades the top edge instead", () => {
    const vm = mountDock({
      default: () => h("div", { class: "content" }, "rows"),
      dockTop: () => h("div", { class: "the-dock" }, "progress"),
    });
    const host = vm.$el as HTMLElement;
    expect(host.querySelector(".hk-scroll-dock[data-side='top']")).toBeTruthy();
    expect(host.getAttribute("data-dock-fade")).toBe("top");
    expect(host.querySelector(".hk-scroll-dock[data-side='bottom']")).toBeNull();
  });

  it("omits the dock fade marker when dockFade is off", () => {
    const vm = mountDock(
      {
        default: () => h("div", { class: "content" }, "rows"),
        dockBottom: () => h("div", { class: "the-dock" }, "dock"),
      },
      { dockFade: false },
    );
    const host = vm.$el as HTMLElement;
    expect(host.querySelector(".hk-scroll-dock[data-side='bottom']")).toBeTruthy();
    expect(host.getAttribute("data-dock-fade")).toBeNull();
  });

  it("publishes no dock marker without dock slots", () => {
    const vm = mountDock({ default: () => h("div", { class: "content" }, "rows") });
    const host = vm.$el as HTMLElement;
    expect(host.querySelector(".hk-scroll-dock")).toBeNull();
    expect(host.getAttribute("data-dock-fade")).toBeNull();
    expect(host.style.getPropertyValue("--hk-scroll-dock-bottom")).toBe("");
  });
});

describe("HkScrollContainer floating-dock tail clearance", () => {
  function mountKanban(props: Record<string, unknown> = {}) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const app = createApp(defineComponent({
      setup() {
        return () => h(HkKanban, {
          lanes: [{ id: "a" }, { id: "b" }],
          laneKeyOf: (lane: unknown) => (lane as { id: string }).id,
          cardsOf: () => [{ id: "c" }],
          axis: "vertical",
          ...props,
        }, { card: () => h("div", { class: "card" }, "card") });
      },
    }));
    mounts.push(app);
    return app.mount(container);
  }

  it("marks the host only while dockTailClearance is on", () => {
    const on = mountDock({ default: () => h("div", "rows") }, { dockTailClearance: true });
    expect((on.$el as HTMLElement).getAttribute("data-dock-tail")).toBe("true");
    const off = mountDock({ default: () => h("div", "rows") });
    expect((off.$el as HTMLElement).getAttribute("data-dock-tail")).toBeNull();
  });

  it("forwards through HkKanban onto the strip host", () => {
    const vm = mountKanban({ dockTailClearance: true });
    const strip = (vm.$el as HTMLElement).querySelector(".hk-kanban-strip")!;
    expect(strip.getAttribute("data-dock-tail")).toBe("true");
    const bare = mountKanban();
    const bareStrip = (bare.$el as HTMLElement).querySelector(".hk-kanban-strip")!;
    expect(bareStrip.getAttribute("data-dock-tail")).toBeNull();
  });

  it("spends the published var on a shrink-safe in-flow spacer (style contract)", () => {
    // happy-dom has no layout, so the geometry half of the contract is
    // pinned as a style contract: the spacer trails the viewport's own
    // content as a `flex: none; display: block` ::after (a column-flex
    // viewport cannot compress it; the explicit display is what makes
    // its height apply in the DEFAULT block viewport, where a bare
    // ::after is an inline box and `height` is inert on it — measured in
    // a real engine: zero clearance without, content+spacer with), and
    // EVERY direct child of the viewport is pinned against main-axis
    // shrinking while the prop is on. The pin is the other load-bearing
    // half: a child that behaves as a shrinkable flex item once the
    // viewport is flex-ified (this library's own `.hk-kanban-lanes` ships
    // only `min-height: 100%`, so the flex-item initial `0 1 auto`
    // applies) collapses to the viewport height and overflows its rows
    // visibly, painting them OVER a spacer that trails the box — zero
    // reachable clearance on any content taller than the viewport while
    // short content measures green (the defect that kept a consumer
    // board's tail under its dock through three padding rounds,
    // root-caused in a real layout engine 2026-10-12). The spacer is
    // additionally gated OFF axis="horizontal" containers: the tail is
    // the cross axis there, and an ungated block spacer leaks onto the
    // hidden vertical axis (measured: scrollHeight +spacer, and a
    // programmatic scrollTop shifts content up behind
    // overflow-y:hidden with no wheel path back).
    // Comments stripped (block + line, house two-step form — see
    // HkScrollContainer.dockRide.test.ts): a rule commented out must go
    // red, not hide in the text the regex matches.
    const scss = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "HkScrollContainer.scss"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    const spacer = scss.match(
      /\.hk-scroll-container\[data-dock-tail="true"\]:not\(\[data-axis="horizontal"\]\) > \.hk-scroll-container-viewport::after\s*\{[^}]*\}/,
    );
    expect(spacer, "tail spacer rule must exist").not.toBeNull();
    expect(spacer![0]).toMatch(/content:\s*""/);
    expect(spacer![0]).toMatch(/display:\s*block/);
    expect(spacer![0]).toMatch(/flex:\s*none/);
    expect(spacer![0]).toMatch(/height:\s*var\(--hk-scroll-tail-bottom,\s*0px\)/);
    const pin = scss.match(
      /\.hk-scroll-container\[data-dock-tail="true"\] > \.hk-scroll-container-viewport > \*\s*\{[^}]*\}/,
    );
    expect(pin, "viewport-child shrink pin must exist").not.toBeNull();
    expect(pin![0]).toMatch(/flex-shrink:\s*0/);
  });
});
