import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkMenuIdentityItem from "./HkMenuIdentityItem";

/**
 * HkMenuIdentityItem — the standard menu identity row.
 *
 * Same 2026-11-20 rule as HkAvatar: a stored avatar URL that 404s must fall
 * back to the initial-letter chip, never to the browser's broken-picture
 * glyph, and a new URL on the same instance must retry.
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

describe("HkMenuIdentityItem", () => {
  it("renders the initial fallback when no avatar URL is given", () => {
    const c = mount(h(HkMenuIdentityItem, { name: "yuzu", subtitle: "y@zu" }));
    expect(c.querySelector(".hk-menu-identity-item__fallback")?.textContent).toBe("Y");
    expect(c.querySelector("img")).toBeNull();
  });

  it("swaps a broken avatar for the initial fallback", async () => {
    const c = mount(h(HkMenuIdentityItem, {
      name: "yuzu",
      subtitle: "y@zu",
      avatarUrl: "/static/avatars/gone.webp",
    }));
    const img = c.querySelector("img") as HTMLImageElement;
    expect(img).toBeTruthy();
    img.dispatchEvent(new Event("error"));
    await nextTick();
    expect(c.querySelector("img")).toBeNull();
    expect(c.querySelector(".hk-menu-identity-item__fallback")?.textContent).toBe("Y");
  });

  it("retries when the avatar URL changes on the same instance", async () => {
    const url = ref("/a.webp");
    const Host = defineComponent({
      setup: () => () => h(HkMenuIdentityItem, { name: "yuzu", avatarUrl: url.value }),
    });
    const c = mount(h(Host));
    (c.querySelector("img") as HTMLImageElement).dispatchEvent(new Event("error"));
    await nextTick();
    expect(c.querySelector("img")).toBeNull();

    url.value = "/b.webp";
    await nextTick();
    await nextTick();
    const retry = c.querySelector("img") as HTMLImageElement | null;
    expect(retry, "the latch reset — the new URL gets a fresh attempt").toBeTruthy();
    expect(retry!.getAttribute("src")).toBe("/b.webp");
  });
});
