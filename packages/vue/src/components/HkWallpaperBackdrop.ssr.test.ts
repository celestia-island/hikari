// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "@vue/server-renderer";

import HkWallpaperBackdrop from "./HkWallpaperBackdrop";

/**
 * SSR gate for the backdrop component.
 *
 * The wallpaper LOGIC layer already pins its own import-time safety
 * (theme/wallpaperSsr.test.ts: no module-scope storage read). This is the
 * other half: the component that renders the stack must survive a server
 * pass too, because a host that server-renders its shell mounts it there
 * first. A `document`/`window` reference in setup or in the render function
 * (a direct `getContext`, a `matchMedia` call, an element lookup) would make
 * every server-rendered page that opts into the backdrop throw — the failure
 * mode the ported renderer only avoided by never running on a server at all.
 *
 * The node environment here means `window`, `document` and `localStorage`
 * do not exist: the assertions below cannot pass by accident.
 */
describe("HkWallpaperBackdrop on a server", () => {
  it("renders its root without a DOM", async () => {
    expect(typeof globalThis.document).toBe("undefined");

    const html = await renderToString(
      createSSRApp({ render: () => h(HkWallpaperBackdrop) }),
    );

    expect(html).toContain('class="hk-wallpaper-backdrop');
    expect(html).toContain('data-hk-wallpaper-mode="solid"');
    expect(html).toContain('data-hk-wallpaper-art="false"');
    expect(html).toContain('aria-hidden="true"');
  });

  it("renders no layer at all on the server (no art is resolvable there)", async () => {
    const html = await renderToString(
      createSSRApp({ render: () => h(HkWallpaperBackdrop) }),
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<video");
    expect(html).not.toContain("<canvas");
  });
});
