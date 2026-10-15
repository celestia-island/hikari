import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkCornerBadge from "./HkCornerBadge";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkCornerBadge — the generic corner mark (2026-10-15)", () => {
  it("anchors the default slot in a relative wrapper with no mark by default", () => {
    const c = mount(h(HkCornerBadge, null, () => h("button", { class: "probe" }, "x")));
    const anchor = c.querySelector(".hk-corner-badge-anchor")!;
    expect(anchor, "anchor wrapper present").toBeTruthy();
    // (The relative/inline-flex anchoring is pinned by the compiled-css
    // contract test — vitest stubs styles, so no computed assertions.)
    expect(c.querySelector(".probe"), "slot content rendered").toBeTruthy();
    expect(c.querySelector(".hk-corner-badge")).toBeNull();
  });

  it("dot form: a variant-colored dot at the requested corner, decorative by default", () => {
    const c = mount(
      h(HkCornerBadge, { dot: true, variant: "success", corner: "bottom-right" }, () => h("i")),
    );
    const badge = c.querySelector(".hk-corner-badge")!;
    expect(badge).toBeTruthy();
    expect(badge.className).toContain("hk-corner-badge--dot");
    expect(badge.className).toContain("hk-corner-badge-success");
    expect(badge.getAttribute("data-corner")).toBe("bottom-right");
    expect(badge.getAttribute("aria-hidden")).toBe("true");
    expect(badge.getAttribute("role")).toBeNull();
  });

  it("count form: renders the number, caps past max, hides zero unless showZero", () => {
    const c = mount(h(HkCornerBadge, { count: 7 }, () => h("i")));
    expect(c.querySelector(".hk-corner-badge")!.textContent).toBe("7");
    const capped = mount(h(HkCornerBadge, { count: 130, max: 99 }, () => h("i")));
    expect(capped.querySelector(".hk-corner-badge")!.textContent).toBe("99+");
    const zero = mount(h(HkCornerBadge, { count: 0 }, () => h("i")));
    expect(zero.querySelector(".hk-corner-badge")).toBeNull();
    const zeroShown = mount(h(HkCornerBadge, { count: 0, showZero: true }, () => h("i")));
    expect(zeroShown.querySelector(".hk-corner-badge")!.textContent).toBe("0");
  });

  it("custom label form: a text pill from the default slot", () => {
    const c = mount(h(HkCornerBadge, { variant: "primary", text: "5h" }, () => h("i")));
    const badge = c.querySelector(".hk-corner-badge")!;
    expect(badge.textContent).toBe("5h");
    expect(badge.className).toContain("hk-corner-badge--pill");
  });

  it("accessible mode: role=img + aria-label instead of aria-hidden", () => {
    const c = mount(h(HkCornerBadge, { dot: true, label: "3 active filters" }, () => h("i")));
    const badge = c.querySelector(".hk-corner-badge")!;
    expect(badge.getAttribute("role")).toBe("img");
    expect(badge.getAttribute("aria-label")).toBe("3 active filters");
    expect(badge.getAttribute("aria-hidden")).toBeNull();
  });

  it("dot wins when both dot and count/text are set", () => {
    const c = mount(h(HkCornerBadge, { dot: true, count: 9 }, () => h("i")));
    const badge = c.querySelector(".hk-corner-badge")!;
    expect(badge.className).toContain("hk-corner-badge--dot");
    expect(badge.textContent).toBe("");
  });

  it("offset writes the clearance custom property", () => {
    const c = mount(h(HkCornerBadge, { dot: true, offset: 2 }, () => h("i")));
    const badge = c.querySelector(".hk-corner-badge") as HTMLElement;
    expect(badge.style.getPropertyValue("--hk-corner-badge-offset")).toBe("2px");
  });
});
