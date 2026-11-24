import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type VNode } from "vue";

// HDrawer teleports and animates. This file never opens the drawer (the
// band sits outside the body that hosts it), so a deliberately MINIMAL
// closed-drawer stub is enough: it renders the slot only when open, with
// none of the `drawer-stub` body/footer classes HkFaceShell.test.tsx needs.
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
    // centre group. The guard is the PARENT (the root), not `closest` — a
    // band moved into the header wrapper becomes a SIBLING of the header
    // mock, so `closest(".header-mock")` would stay null there (review R2).
    expect(band!.parentElement).toBe(c.querySelector(".s-admin-shell"));
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

  it("reserves nothing when the slot is absent or empty, and renders exactly one band when filled", () => {
    // Name each root child by its first class, or by its tag when it carries
    // none (the header wrapper is a bare `<div style="flex-shrink: 0">`).
    const rootChildren = (c: HTMLElement) =>
      [...c.querySelector(".s-admin-shell")!.children]
        .map((el) => el.className.split(" ")[0] || el.tagName.toLowerCase());
    const absent = mount(h(HkFaceShell, { navTitle: "Navigation" }, {
      header: HEADER, content: CONTENT,
    }));
    const empty = mount(h(HkFaceShell, { navTitle: "Navigation" }, {
      header: HEADER, headerExtra: () => [], content: CONTENT,
    }));
    const filled = mount(h(HkFaceShell, { navTitle: "Navigation" }, {
      header: HEADER, headerExtra: BAND, content: CONTENT,
    }));
    // Absent: the root holds the header wrapper and the body, nothing else.
    expect(rootChildren(absent)).toEqual(["div", "s-admin-shell-body"]);
    expect(absent.querySelector(".band-mock")).toBeNull();
    // EMPTY slot ≡ absent: the literal "an empty slot reserves nothing".
    // (The header wrapper is conditional on `slots.header`, so both mounts
    // carry it; the list is identical.)
    expect(rootChildren(empty)).toEqual(rootChildren(absent));
    expect(empty.querySelector(".band-mock")).toBeNull();
    // Filled: exactly ONE band, as the body's immediately preceding sibling.
    // Asserting the full list (not a count delta) is what catches a shell-
    // synthesized wrapper AND a duplicate render (review R2, M2 / M6).
    expect(rootChildren(filled)).toEqual(["div", "band-mock", "s-admin-shell-body"]);
    expect(filled.querySelectorAll(".band-mock").length).toBe(1);
    const band = filled.querySelector(".band-mock")!;
    expect(band.nextElementSibling).toBe(filled.querySelector(".s-admin-shell-body"));
    // The main region is untouched by the band in every case.
    expect(filled.querySelector(".s-admin-shell-main")!.children.length)
      .toBe(absent.querySelector(".s-admin-shell-main")!.children.length);
  });

  it("keeps the band outside the contentKey crossfade so a page swap leaves it in place", async () => {
    // A tiny host whose key is a ref, so the swap is driven for real: the
    // ruling's promise is "a page swap leaves the band in place", and that
    // is only testable by swapping (review R2).
    const page = ref("page-a");
    const Host = defineComponent({
      setup() {
        return () => h(HkFaceShell, { navTitle: "Navigation", contentKey: page.value }, {
          header: HEADER,
          headerExtra: BAND,
          content: () => h("main", { class: "content-mock" }, page.value),
        });
      },
    });
    const c = mount(h(Host));
    const bandBefore = c.querySelector(".band-mock");
    expect(bandBefore, "the band renders").toBeTruthy();
    expect(bandBefore!.closest(".hk-crossfade")).toBeNull();
    expect(bandBefore!.closest(".s-admin-shell-swap")).toBeNull();
    expect(c.querySelector('[data-crossfade-key="page-a"] .content-mock')!.textContent).toBe("page-a");
    page.value = "page-b";
    await nextTick();
    // The page changed: the ENTERING crossfade item carries the new key
    // (the leaving item stays in the DOM for its exit transition, which is
    // why the lookup is by key rather than first-match)…
    expect(c.querySelector('[data-crossfade-key="page-b"] .content-mock')!.textContent).toBe("page-b");
    // …and the band is the SAME DOM node, not a re-mount. (This identity
    // line catches a re-MOUNT; "band inside the crossfade" is caught by
    // the structural `closest(".hk-crossfade")` guard above — Vue re-
    // PARENTS a slot vnode into the entering item without re-mounting it,
    // so identity alone would not notice. Review R3.)
    expect(c.querySelector(".band-mock")).toBe(bandBefore);
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
