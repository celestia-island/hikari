import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, type VNode } from "vue";

// Same stub shape as HkFaceShell.test.tsx: HDrawer teleports and animates,
// which would make the shell contract untestable without the overlay runtime.
vi.mock("@celestia-island/hikari", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@celestia-island/hikari")>();
  const { defineComponent, h } = await import("vue");
  const HDrawerStub = defineComponent({
    name: "HDrawer",
    props: {
      modelValue: { type: Boolean, default: false },
      side: { type: String, default: "left" },
      size: { type: String, default: "280px" },
      title: { type: String, default: undefined },
      panelClass: { type: String, default: undefined },
    },
    setup(props, { slots }) {
      return () => (props.modelValue ? h("div", slots.default?.()) : null);
    },
  });
  return { ...actual, HDrawer: HDrawerStub };
});

import { HkFaceShell } from "./HkFaceShell";
import { HkAdminShell } from "./HkAdminShell";

/**
 * `headerExtra` — the header sub-row (2026-11-24). What this file pins:
 *
 * 1. GEOMETRY: the band renders directly under the header and ABOVE the
 *    body, so it inherits the header's full width and sits clear of the
 *    document scroll viewport — a scope line must not scroll away with
 *    the page it scopes.
 * 2. NO WRAPPER: the slot's VNodes are the band's boxes. The shell adds
 *    no box of its own, so a host that styles its band keeps its own
 *    geometry, and an empty slot reserves nothing.
 * 3. HkAdminShell RELAYS the slot verbatim: the admin wrapper has no
 *    opinion on the band, and dropping it there would make the admin face
 *    silently narrower than the shell it composes.
 *
 * (Repo test convention: raw createApp + container queries.)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: VNode) {
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

const CONTENT = () => h("main", { class: "content-mock" }, "CONTENT");
const HEADER = () => h("div", { class: "header-mock" }, "HEADER");
const BAND = () => h("div", { class: "band-mock" }, "ACTIVE PANEL");

/** The shell's own boxes in DOM order, named by their first class. */
function ordered(c: HTMLElement, selector: string): string[] {
  return [...c.querySelectorAll(selector)].map((el) => el.className.split(" ")[0]);
}

describe("HkFaceShell headerExtra", () => {
  it("renders the band under the header and above the body, outside the scroll viewport", () => {
    const c = mount(h(HkFaceShell, { navTitle: "Navigation" }, {
      header: HEADER,
      headerExtra: BAND,
      content: CONTENT,
    }));
    const band = c.querySelector(".band-mock");
    expect(band, "the band renders").toBeTruthy();
    expect(band!.textContent).toBe("ACTIVE PANEL");
    // Order: header → band → body (document mode's viewport lives inside body).
    expect(ordered(c, ".header-mock,.band-mock,.s-admin-shell-body")).toEqual([
      "header-mock",
      "band-mock",
      "s-admin-shell-body",
    ]);
    // The whole point: the band is NOT inside the scroll viewport.
    expect(band!.closest(".hk-scroll-container-viewport")).toBeNull();
    expect(band!.closest(".hk-scroll-container")).toBeNull();
    expect(band!.closest(".s-admin-shell-body")).toBeNull();
    // It is also not inside the header: the header's three-zone grid has
    // no free row, and a host scope line must not compete with the page's
    // centre group.
    expect(band!.closest(".header-mock")).toBeNull();
  });

  it("adds no wrapper box of its own — the slot's VNode IS the band", () => {
    const c = mount(h(HkFaceShell, { navTitle: "Navigation" }, {
      header: HEADER,
      headerExtra: BAND,
      content: CONTENT,
    }));
    const band = c.querySelector(".band-mock")!;
    // The band's parent is the shell root itself, not an intermediate
    // container the shell synthesized around the slot.
    expect(band.parentElement!.classList.contains("s-admin-shell")).toBe(true);
    // The header lives in the shell's own flex-shrink wrapper; the band
    // sits beside that wrapper as a sibling, which is what keeps it out
    // of the header's three-zone grid.
    const headerBox = c.querySelector(".header-mock")!.parentElement!;
    expect(headerBox.classList.contains("s-admin-shell")).toBe(false);
    expect(band.previousElementSibling).toBe(headerBox);
  });

  it("reserves nothing when the slot is absent", () => {
    const withBand = mount(h(HkFaceShell, { navTitle: "Navigation" }, {
      header: HEADER, headerExtra: BAND, content: CONTENT,
    }));
    const without = mount(h(HkFaceShell, { navTitle: "Navigation" }, {
      header: HEADER, content: CONTENT,
    }));
    // The only difference the band introduces is the band element itself,
    // as a direct child of the shell root; the main region is untouched.
    expect(withBand.querySelector(".s-admin-shell")!.children.length)
      .toBe(without.querySelector(".s-admin-shell")!.children.length + 1);
    expect(withBand.querySelector(".s-admin-shell-main")!.children.length)
      .toBe(without.querySelector(".s-admin-shell-main")!.children.length);
    expect(without.querySelector(".band-mock")).toBeNull();
  });

  it("keeps the band outside the contentKey crossfade so a page swap leaves it in place", () => {
    const c = mount(h(HkFaceShell, { navTitle: "Navigation", contentKey: "page-a" }, {
      header: HEADER, headerExtra: BAND, content: CONTENT,
    }));
    const band = c.querySelector(".band-mock")!;
    expect(band.closest(".hk-crossfade")).toBeNull();
    expect(band.closest(".s-admin-shell-swap")).toBeNull();
  });
});

describe("HkAdminShell relays headerExtra", () => {
  it("passes the band through to the inner shell unchanged", () => {
    // HkAdminShell provides its own action bar; mount it bare.
    const c = mount(h(HkAdminShell, { navTitle: "Navigation" }, {
      header: () => h("div", { class: "header-mock" }, "HEADER"),
      headerExtra: BAND,
      content: CONTENT,
    }));
    const band = c.querySelector(".band-mock");
    expect(band, "the admin face renders the host's band").toBeTruthy();
    expect(band!.textContent).toBe("ACTIVE PANEL");
    expect(ordered(c, ".header-mock,.band-mock,.s-admin-shell-body")).toEqual([
      "header-mock",
      "band-mock",
      "s-admin-shell-body",
    ]);
    expect(band!.closest(".hk-scroll-container-viewport")).toBeNull();
  });
});
