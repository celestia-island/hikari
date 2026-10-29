import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import { HkAvatarButton } from "./HkAvatarButton";
import { HkAdminHeader } from "./HkAdminHeader";

/**
 * HkAvatarButton — the extracted avatar trigger (shell-unify wave 7).
 *
 * What this file pins:
 * 1. The shared grammar: --space-28 round trigger class, the image with
 *    letter fallback, and the failed-load latch that RESETS when the URL
 *    changes (an account switch deserves a fresh attempt).
 * 2. Attr fallthrough: a host's data-* attribute lands on the button so
 *    host CSS keyed on it keeps working.
 * 3. The aria bindings the menu engines read (haspopup/expanded).
 * 4. HkAdminHeader renders it internally — and its new `identity` slot
 *    replaces the built-in dropdown identity block while the pending
 *    branch stays built-in.
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

function trigger(c: HTMLElement): HTMLButtonElement {
  return c.querySelector("button.s-admin-header-avatar") as HTMLButtonElement;
}

describe("HkAvatarButton", () => {
  it("renders the letter fallback when no URL is given", () => {
    const c = mount(h(HkAvatarButton, { username: "yuzu", label: "Account menu" }));
    const btn = trigger(c);
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-label")).toBe("Account menu");
    expect(btn.querySelector(".s-user-avatar")?.textContent).toBe("Y");
    expect(btn.querySelector("img")).toBeNull();
  });

  it("renders the image when a URL is given, with the username as alt", () => {
    const c = mount(h(HkAvatarButton, { username: "yuzu", avatarUrl: "/a.png" }));
    const img = trigger(c).querySelector("img.s-admin-header-avatar-img") as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe("/a.png");
    expect(img.getAttribute("alt")).toBe("yuzu");
  });

  it("falls back to the letter when the image fails, and a URL change on the SAME instance retries", async () => {
    // Same-instance reactive update (R3 M1 on #909): remounting proves
    // nothing (a fresh instance starts unlatched), so the host re-renders
    // the button with a new URL while it stays mounted — the reset watch
    // is what must bring the image back.
    const url = ref("/a.png");
    const Host = defineComponent({
      setup: () => () => h(HkAvatarButton, { username: "yuzu", avatarUrl: url.value }),
    });
    const c = mount(h(Host));
    const firstImg = trigger(c).querySelector("img") as HTMLImageElement;
    firstImg.dispatchEvent(new Event("error"));
    await nextTick();
    expect(trigger(c).querySelector(".s-user-avatar")?.textContent).toBe("Y");
    url.value = "/b.png";
    await nextTick();
    await nextTick();
    const retryImg = trigger(c).querySelector("img") as HTMLImageElement | null;
    expect(retryImg, "the latch reset — the new URL gets a fresh attempt").toBeTruthy();
    expect(retryImg!.getAttribute("src")).toBe("/b.png");
  });

  it("forwards extra attrs onto the button (host data-* keys keep working)", () => {
    const c = mount(h(HkAvatarButton, { username: "y", "data-image": "/a.png" } as never));
    expect(trigger(c).getAttribute("data-image")).toBe("/a.png");
  });

  it("emits click and binds the menu aria pair", async () => {
    let fired = 0;
    const c = mount(h(HkAvatarButton, {
      username: "yuzu",
      label: "Account menu",
      popup: "menu",
      expanded: false,
      onClick: () => { fired += 1; },
    }));
    const btn = trigger(c);
    expect(btn.getAttribute("aria-haspopup")).toBe("menu");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(fired).toBe(1);
  });
});

describe("HkAdminHeader × HkAvatarButton / identity slot", () => {
  it("renders the shared trigger internally (behavior parity with the inline past)", () => {
    const c = mount(h(HkAdminHeader, { username: "yuzu", title: "Dashboard" }));
    const btn = trigger(c);
    expect(btn).toBeTruthy();
    expect(btn.querySelector(".s-user-avatar")?.textContent).toBe("Y");
    // The wing keeps the ws-slot reservation contract on the drawer face.
    expect(c.querySelector(".s-admin-header-user")).toBeTruthy();
  });

  it("an identity slot replaces the built-in dropdown block; the pending branch stays built-in", async () => {
    const opened = h(HkAdminHeader, {
      username: "yuzu",
      userEmail: "y@zu",
      title: "D",
    }, {
      identity: () => h("div", { class: "host-identity" }, "HOST-IDENTITY"),
    });
    // Open the dropdown by clicking the trigger.
    const c = mount(opened);
    trigger(c).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    await nextTick();
    const host = document.body.querySelector(".host-identity");
    expect(host, "the host identity block renders in the open menu").toBeTruthy();
    expect(document.body.querySelector(".s-user-header--profile")).toBeNull();

    // Pending identity (no username/email): built-in spinner branch —
    // the host slot is for identity PRESENTATION, not the fetch race.
    const c2 = mount(h(HkAdminHeader, {
      signingInLabel: "Signing in…",
      onForceSignOut: () => {},
    }));
    trigger(c2).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    await nextTick();
    expect(document.body.querySelector(".s-user-header--pending")).toBeTruthy();
  });
});
