import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

describe("HkAvatarButton sheet contract", () => {
  // happy-dom has no layout engine, so the geometry is pinned at the
  // source level — the same approach the downstream chest tripwire
  // (headerAvatarGeometry.test.ts) takes against the INSTALLED sheet.
  const sheet = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "styles", "admin-tokens.scss"),
    "utf8",
  );

  /** Declarations of the rule whose whole prelude IS `selector`
   *  (a compound/descendant spelling is a different rule and does not
   *  match), comments stripped; null when no such rule exists — every
   *  assertion treats null as a failure, never as "no objection". */
  function ruleDeclarations(selector: string): Array<[string, string]> | null {
    const code = sheet
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/gm, "$1");
    for (let at = code.indexOf(selector); at >= 0; at = code.indexOf(selector, at + 1)) {
      const open = code.indexOf("{", at + selector.length);
      if (open < 0) continue;
      if (code.slice(at + selector.length, open).trim() !== "") continue;
      let boundary = at - 1;
      while (boundary >= 0 && !"}{;".includes(code[boundary])) boundary -= 1;
      if (code.slice(boundary + 1, at).replace(/\s+/g, " ").trim() !== "") continue;
      const body = code.slice(open + 1, code.indexOf("}", open));
      const out: Array<[string, string]> = [];
      for (const part of body.split(";")) {
        const m = /^\s*([-a-zA-Z]+)\s*:\s*([\s\S]+?)\s*$/.exec(part);
        if (m) out.push([m[1], m[2].replace(/\s+/g, " ")]);
      }
      return out;
    }
    return null;
  }

  it("the trigger is a BLOCK — hosts may nest it in a plain wrapper div", () => {
    // The chat face wraps HeaderLeft's trigger in a menu-anchor <div>:
    // an inline-block button there joins a line box and the strut's
    // descender space lands BELOW it, riding the avatar ~4px high inside
    // a perfectly centred wrapper (2026-10-30 user report). Removing
    // this declaration is the mutation this test must catch.
    const rule = ruleDeclarations(".s-admin-header-avatar");
    expect(rule, "admin-tokens must declare .s-admin-header-avatar").not.toBeNull();
    // Positive control for the extractor itself: the geometry pair the
    // downstream tripwire also reads. If these stop matching, the parser
    // above is broken — fix it, not the assertion below.
    expect(rule).toContainEqual(["width", "var(--space-28)"]);
    expect(rule).toContainEqual(["height", "var(--space-28)"]);
    expect(rule, "the trigger must not re-enter inline formatting").toContainEqual([
      "display",
      "block",
    ]);
  });
});

describe("HkAdminHeader × HkAvatarButton / identity slot", () => {
  it("never renders aria-expanded when no expanded prop is given (drawer-mode contract)", () => {
    // R2 S3-2: menu engines read this pair; a drawer-mode trigger has no
    // open state, so the attribute must be ABSENT (not "false").
    const c = mount(h(HkAvatarButton, { username: "y", label: "Open drawer", popup: "dialog" }));
    expect(trigger(c).hasAttribute("aria-expanded")).toBe(false);
  });

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
