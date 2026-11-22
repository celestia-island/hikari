// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "@vue/server-renderer";

import { HkMasterDetail } from "./HkMasterDetail";

/**
 * SSR gate for the master-detail pane.
 *
 * A host that server-renders its shell mounts this pane there first, and the
 * node environment here means `window`, `document` and `matchMedia` do not
 * exist: the assertions below cannot pass by accident.
 *
 * The split has no measurement on a server, so the component renders the WIDE
 * layout (the same desktop assumption `useBreakpoint`'s own server fallback
 * declares) instead of guessing at the drawer form and hydrating into a
 * different tree. What this file pins is that the whole surface — grid, detail
 * card, empty state and the overlay-scrollbar setup — is reachable without a
 * DOM: a `window`/`document` read in setup or in the render function would
 * throw here (the HkWallpaperBackdrop.ssr.test.ts precedent).
 */
describe("HkMasterDetail on a server", () => {
  it("renders the wide layout with the boxed empty state and no DOM globals", async () => {
    expect(typeof globalThis.document).toBe("undefined");
    expect(typeof globalThis.window).toBe("undefined");

    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(
            HkMasterDetail,
            { detailOpen: false, detailTitle: "Message" },
            {
              list: () => h("div", { class: "roster" }, "ROSTER"),
              detail: () => h("div", { class: "detail-payload" }, "DETAIL"),
            },
          ),
      }),
    );

    expect(html).toContain('class="hk-master-detail"');
    // No viewport to measure ⇒ the wide layout, never the drawer form.
    // Dropping the `hasViewport` guard turns this assertion red — the
    // server fallback (1024) sits below the default `splitAt` (1100)
    // [MUT:hasviewport-guard-dropped].
    expect(html).toContain('data-split="two"');
    expect(html).not.toContain("hk-master-detail-drawer");
    expect(html).not.toContain("hk-master-detail-scrim");
    // Closed: the empty state stands in for the detail slot.
    expect(html).toContain("hk-empty-state--boxed");
    expect(html).toContain("Nothing selected");
    expect(html).not.toContain("detail-payload");
    expect(html).toContain("ROSTER");
    // The region keeps its accessible name server-side.
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Message"');
  });

  it("renders a selected detail without the empty state", async () => {
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(
            HkMasterDetail,
            { detailOpen: true, detailTitle: "Message", onClose: () => {} },
            {
              list: () => h("div", { class: "roster" }, "ROSTER"),
              detail: () => h("div", { class: "detail-payload" }, "DETAIL"),
            },
          ),
      }),
    );

    expect(html).toContain("detail-payload");
    expect(html).not.toContain("hk-empty-state");
    // The close affordance renders from the bound listener even on a server
    // pass (the detection reads the vnode props, not a DOM query).
    expect(html).toContain("hk-master-detail-close");
    expect(html).toContain('aria-label="Close"');
  });
});