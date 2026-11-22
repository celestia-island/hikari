import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type VNode } from "vue";

import { HkAdminShell } from "./HkAdminShell";
import { HkAdminHeader } from "./HkAdminHeader";
import { useActionBar } from "../composables/useActionBar";
import type { HkFaceShellHeaderSlot } from "../index";

/**
 * The header's CENTRE channel, end to end (2026-11-23).
 *
 * `useActionBar().setCenter` existed with nothing rendering it: a page
 * registered its filter/mode group into a ref no shell ever read, so the
 * zone was dead on every admin face — and the composable's own unit suite
 * (composables/useActionBar.test.ts) could not see that, because it mounts
 * its own probe layout. This file mounts the REAL chain:
 *
 *   page (setCenter) -> HkAdminShell's provide -> HkFaceShell's header
 *   payload (`center`) -> HkAdminHeader's own `center` slot -> DOM
 *
 * so a shell that stops relaying the renderer goes red here.
 *
 * Deliberately NOT mocking "@celestia-island/hikari" (the reason
 * HkFaceShell.barrel.test.ts documents): the package self-reference
 * resolves to the same src/index.ts module as the barrel, and a vi.mock
 * spread here hands HkAdminHeader an incomplete namespace while the barrel
 * is still initializing — the header then renders nothing and this file
 * would be testing the mock instead of the wiring.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function setWidth(w: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: w,
  });
  window.dispatchEvent(new Event("resize"));
}

function mount(node: ReturnType<typeof h>): HTMLElement {
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
  setWidth(1280);
});

/** The payload HkAdminShell hands its header slot: the shell's own params
 *  plus the `actions` flat list it injects. */
type ShellHeaderParams = HkFaceShellHeaderSlot & { actions: VNode[] };

describe("HkAdminShell — the header centre channel", () => {
  it("delivers the page's centre group to the header slot and clears it on unmount", async () => {
    setWidth(1024);
    const showPage = ref(true);
    const Page = defineComponent({
      name: "CentrePage",
      setup() {
        const bar = useActionBar();
        // One page, both zones — the two channels travel together.
        bar.setActions(() => [h("button", { class: "page-action" }, "refresh")], "refresh");
        bar.setCenter(() => [h("span", { class: "page-centre" }, "mid")]);
        return () => h("main", { class: "page-body" }, "PAGE");
      },
    });

    const c = mount(
      h(HkAdminShell, {}, {
        // The host shape this contract exists for: hand the shell-provided
        // renderer straight to HkAdminHeader's own `center` slot.
        header: (params: ShellHeaderParams) =>
          h(
            HkAdminHeader,
            { title: "Page", actions: params.actions },
            params.center ? { center: params.center } : {},
          ),
        content: () =>
          showPage.value ? h(Page) : h("div", { class: "page-filler" }, "NEXT"),
      }),
    );

    await nextTick();
    expect(c.querySelector(".page-body")).toBeTruthy();
    // The centre zone renders the page's registration inside the header's
    // own centre wrapper…
    expect(c.querySelector(".s-admin-header-center .page-centre")?.textContent).toBe("mid");
    // …and the right cluster still arrives through the same payload.
    expect(c.querySelector(".s-admin-header-actions .page-action")).toBeTruthy();

    // The page goes away (a route / view swap): BOTH registrations leave
    // with it — the per-scope disposal contract setActions always had.
    showPage.value = false;
    await nextTick();
    await nextTick();
    expect(c.querySelector(".page-centre")).toBeNull();
    expect(c.querySelector(".s-admin-header-actions .page-action")).toBeNull();
  });

  it("hands a renderer that produces nothing while no page registered a group", async () => {
    // The admin face ALWAYS provides a bar, so the field is always a
    // renderer here — an empty VNode list until a page registers one.
    // (The ABSENT case belongs to HkFaceShell with no bar above it:
    // pinned in HkFaceShell.test.tsx.)
    setWidth(1024);
    const seen: ShellHeaderParams[] = [];
    const c = mount(
      h(HkAdminShell, {}, {
        header: (params: ShellHeaderParams) => {
          seen.push(params);
          return null;
        },
        content: () => h("main", null, "CONTENT"),
      }),
    );
    await nextTick();
    expect(seen.length).toBeGreaterThan(0);
    expect(typeof seen[0].center).toBe("function");
    expect(seen[0].center!()).toEqual([]);
    expect(c.querySelector(".s-admin-header-center")).toBeNull();
  });

  it("keeps a page's centre registration alive across a header repaint", async () => {
    // The renderer is a FUNCTION, not VNodes (the action-bar contract):
    // the header may re-render any number of times and must still get a
    // fresh, live group each time.
    setWidth(1024);
    const Page = defineComponent({
      name: "LiveCentrePage",
      setup() {
        useActionBar().setCenter(() => [h("span", { class: "page-centre" }, "mid")]);
        return () => h("main", null, "PAGE");
      },
    });
    const title = ref("Page");
    const c = mount(
      h(HkAdminShell, {}, {
        header: (params: ShellHeaderParams) =>
          h(
            HkAdminHeader,
            { title: title.value, actions: params.actions },
            params.center ? { center: params.center } : {},
          ),
        content: () => h(Page),
      }),
    );
    await nextTick();
    const first = c.querySelector(".s-admin-header-center .page-centre");
    expect(first?.textContent).toBe("mid");

    // A host-side header repaint (title change) replaces the vnode tree
    // without touching the registration.
    title.value = "Renamed";
    await nextTick();
    expect(c.querySelector(".s-admin-header-center .page-centre")?.textContent).toBe("mid");
  });
});