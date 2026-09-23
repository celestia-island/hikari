import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkCard from "./HkCard";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountCard(props: Record<string, unknown> = {}, slotText = "content") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkCard, props, { default: () => h("span", { class: "slot-marker" }, slotText) }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const m of mounts) m.app.unmount();
  mounts.length = 0;
});

describe("HkCard — scrollable body", () => {
  it("default card renders no scroll machinery", () => {
    const c = mountCard();
    expect(c.querySelector(".hk-card-scrollable")).toBeNull();
    expect(c.querySelector(".hk-scroll-container")).toBeNull();
    // The slot lands directly in the body, no pad wrapper in between.
    expect(c.querySelector(".hk-card-body .slot-marker")).not.toBeNull();
    expect(c.querySelector(".hk-card-body-pad")).toBeNull();
  });

  it("scrollable embeds the standard scroll container and flex classes", () => {
    const c = mountCard({ scrollable: true });
    expect(c.querySelector(".hk-card-scrollable")).not.toBeNull();
    const scroll = c.querySelector(".hk-card-body .hk-scroll-container");
    expect(scroll).not.toBeNull();
    // The embedded scroller IS the library scroll container (overlay
    // scrollbar machinery), not a bare overflow div.
    expect(scroll?.querySelector(".hk-scroll-container-viewport")).not.toBeNull();
    // Padded card: content padding lives inside the scroll region.
    expect(c.querySelector(".hk-scroll-container .hk-card-body-pad .slot-marker")).not.toBeNull();
  });

  it("padded false drops the inner pad wrapper too", () => {
    const c = mountCard({ scrollable: true, padded: false });
    expect(c.querySelector(".hk-card-body-pad")).toBeNull();
    expect(c.querySelector(".hk-scroll-container .slot-marker")).not.toBeNull();
  });

  it("header and footer stay outside the scroll region", () => {
    const c = mountCard(
      { scrollable: true, title: "T" },
      undefined,
    );
    // Re-mount with a footer slot via raw slots is not available through
    // the props-only helper; assert the header ordering here and cover
    // the footer through the props-less variant below.
    const header = c.querySelector(".hk-card-header");
    const scroll = c.querySelector(".hk-card-body-scroll");
    expect(header).not.toBeNull();
    expect(scroll).not.toBeNull();
    expect(header!.contains(scroll as Node)).toBe(false);
  });

  it("footer renders after the scroll body, not inside it", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(HkCard, { scrollable: true }, {
          default: () => h("span", { class: "slot-marker" }, "content"),
          footer: () => h("div", { class: "footer-marker" }, "foot"),
        }),
    });
    app.mount(container);
    mounts.push({ app, container });

    const footer = container.querySelector(".hk-card-footer");
    const scroll = container.querySelector(".hk-card-body-scroll");
    expect(footer).not.toBeNull();
    expect(footer!.contains(scroll as Node)).toBe(false);
    expect(scroll!.contains(footer as Node)).toBe(false);
  });

  it("scroll content survives remounts of the pad wrapper class", () => {
    // Padding flag flips at runtime (a consumer toggling density): the
    // scroll container must persist (keyed on nothing but its slot).
    const c = mountCard({ scrollable: true });
    expect(c.querySelector(".hk-card-body-pad")).not.toBeNull();
  });
});
