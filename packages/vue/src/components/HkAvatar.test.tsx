import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkAvatar from "./HkAvatar";

/**
 * HkAvatar — the shared avatar primitive.
 *
 * The 2026-11-20 report: a member row whose stored `/static/avatars/…` URL
 * had gone stale rendered the browser's broken-picture glyph instead of the
 * default letter avatar. The primitive must treat "the URL 404s" exactly like
 * "no URL was ever stored": same letter chip, same centred glyph. The latch
 * is per-URL, so an account switch / fresh upload gets a real retry.
 *
 * (Repo test convention: raw createApp + container queries, no
 * @vue/test-utils dependency.)
 */

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

describe("HkAvatar", () => {
  it("renders the letter fallback when no src is given", () => {
    const c = mount(h(HkAvatar, { name: "yuzu" }));
    expect(c.querySelector(".hk-avatar-fallback")?.textContent).toBe("Y");
    expect(c.querySelector("img")).toBeNull();
  });

  it("renders the image with the name as alt", () => {
    const c = mount(h(HkAvatar, { name: "yuzu", src: "/static/avatars/y.webp" }));
    const img = c.querySelector("img") as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img!.getAttribute("src")).toBe("/static/avatars/y.webp");
    expect(img!.getAttribute("alt")).toBe("yuzu");
  });

  it("swaps a broken image for the SAME letter fallback instead of the broken-picture glyph", async () => {
    const c = mount(h(HkAvatar, { name: "demiurge", src: "/static/avatars/gone.webp" }));
    const img = c.querySelector("img") as HTMLImageElement;
    expect(img).toBeTruthy();
    img.dispatchEvent(new Event("error"));
    await nextTick();
    expect(c.querySelector("img"), "a 404 must not leave a broken <img>").toBeNull();
    expect(c.querySelector(".hk-avatar-fallback")?.textContent).toBe("D");
  });

  it("retries on the same instance when the src changes", async () => {
    // A remount proves nothing (a fresh instance starts unlatched): the host
    // re-renders the avatar with a new URL while it stays mounted, which is
    // the account-switch / avatar-upload path.
    const src = ref("/a.webp");
    const Host = defineComponent({
      setup: () => () => h(HkAvatar, { name: "yuzu", src: src.value }),
    });
    const c = mount(h(Host));
    (c.querySelector("img") as HTMLImageElement).dispatchEvent(new Event("error"));
    await nextTick();
    expect(c.querySelector("img")).toBeNull();

    src.value = "/b.webp";
    await nextTick();
    await nextTick();
    const retry = c.querySelector("img") as HTMLImageElement | null;
    expect(retry, "the latch reset — the new URL gets a fresh attempt").toBeTruthy();
    expect(retry!.getAttribute("src")).toBe("/b.webp");
  });

  it("renders the NORMALIZED src, not the raw prop", () => {
    // Pins the BINDING (mirrors the other two call sites): a padded URL
    // must reach the <img> trimmed. A revert to the raw prop renders the
    // padded value and fails this test — a whitespace-ONLY input cannot
    // discriminate, because the guard hides the <img> in both
    // implementations.
    const c = mount(h(HkAvatar, { name: "yuzu", src: "  /a.webp  " }));
    const img = c.querySelector("img") as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img!.getAttribute("src")).toBe("/a.webp");
  });

  it("treats a whitespace-only src as absent", () => {
    // The shared latch normalizes the URL; master rendered `<img src=" ">`
    // (a broken glyph) for a padded value.
    const c = mount(h(HkAvatar, { name: "yuzu", src: "   " }));
    expect(c.querySelector("img")).toBeNull();
    expect(c.querySelector(".hk-avatar-fallback")?.textContent).toBe("Y");
  });

  it("falls back to ? when the name is absent", () => {
    const c = mount(h(HkAvatar, {}));
    expect(c.querySelector(".hk-avatar-fallback")?.textContent).toBe("?");
  });
});
