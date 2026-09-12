import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h } from "vue";

// HkMenu renders its levels through HkSelectPanel, which teleports to
// body — replace just HkMenu (imported by the component from
// ./HkMenu) with an inline passthrough that renders the header slot
// plus one flattened row per item (children included) while open,
// wiring row clicks to the select handler; the rest of hikari stays
// real. The select handler reaches the stub through attrs (it is not
// re-declared as an emit, which would strip it from props).
vi.mock("./HkMenu", async () => {
  const { defineComponent, h } = await import("vue");
  const HMenuStub = defineComponent({
    name: "HMenu",
    props: {
      open: { type: Boolean, default: false },
      items: { type: Array, default: () => [] },
      title: { type: String, default: "" },
    },
    setup(props, { slots, attrs }) {
      return () => {
        if (!props.open) return null;
        const rows: ReturnType<typeof h>[] = [];
        const flatten = (items: any[]) => {
          for (const item of items ?? []) {
            rows.push(
              h(
                "button",
                {
                  class: "menu-stub-row",
                  "data-key": item.key,
                  "data-checked": item.checked || undefined,
                  "data-danger": item.danger || undefined,
                  onClick: () => (attrs as any).onSelect?.(item.key),
                },
                item.label,
              ),
            );
            if (item.children?.length) flatten(item.children);
          }
        };
        flatten(props.items as any[]);
        return h("div", { class: "menu-stub" }, [...(slots.header?.() ?? []), ...rows]);
      };
    },
  });
  return { default: HMenuStub };
});

import { HkAdminHeader } from "./HkAdminHeader";

/**
 * HkAdminHeader contract tests for the unified user dropdown:
 * - the bar beside the avatar carries the PAGE TITLE, never the
 *   nickname;
 * - the avatar trigger toggles an HkMenu dropdown whose header slot is
 *   the profile identity block (avatar chip + nickname + email) and
 *   whose rows end in a danger logout;
 * - avatarAction "drawer" emits avatarClick instead (bar text hidden);
 * - an empty identity renders the signing-in placeholder + the
 *   force-sign-out escape row;
 * - Language children carry checked state and emit localeSelect;
 * - the goToFrontend row sits directly above logout.
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

type HeaderProps = Record<string, unknown>;

function headerNode(props: HeaderProps = {}, slots?: Record<string, unknown>) {
  return h(HkAdminHeader, { username: "alice", ...props } as never, slots as never);
}

const avatarButton = (c: HTMLElement) =>
  c.querySelector('button[aria-haspopup]') as HTMLButtonElement | null;

const menuRows = (c: HTMLElement) =>
  [...c.querySelectorAll(".menu-stub-row")] as HTMLButtonElement[];

async function click(el: Element | null) {
  el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await Promise.resolve();
  await Promise.resolve();
}

describe("HkAdminHeader", () => {
  it("shows the page title beside the avatar, never the nickname", () => {
    const c = mount(headerNode({ title: "Providers", logoutLabel: "Log out" }));
    const barText = c.querySelector("header > div")?.textContent ?? "";
    expect(barText).toContain("Providers");
    // The nickname must not render as bar text — identity lives in the
    // dropdown's identity block only.
    expect(barText).not.toContain("alice");
  });

  it("renders the letter fallback on the shared avatar primitive, no outline ring", () => {
    const c = mount(headerNode({ title: "Providers" }));
    const btn = avatarButton(c) as HTMLButtonElement;
    // The old border-2 ring made the console avatar read as a different
    // control from the chat frontend's (user report 2026-09-12).
    expect(btn.className).not.toContain("border-2");
    expect(btn.querySelector(".s-user-avatar")?.textContent).toBe("A");
  });

  it("hides the title node entirely when it is empty", () => {
    const withTitle = mount(headerNode({ title: "Dashboard" }));
    expect(withTitle.textContent).toContain("Dashboard");

    const withoutTitle = mount(headerNode());
    expect(withoutTitle.querySelector("header > div")?.textContent).not.toContain("Dashboard");
  });

  it("toggles the user dropdown with the profile identity header in menu mode", async () => {
    const c = mount(headerNode({
      userEmail: "alice@example.com",
      logoutLabel: "Log out",
    }));
    const btn = avatarButton(c);
    expect(btn?.getAttribute("aria-haspopup")).toBe("menu");

    await click(btn);
    const menu = c.querySelector(".menu-stub");
    // The dropdown leads with the identity block — avatar chip,
    // nickname, email — and ends with a danger logout row.
    expect(menu?.querySelector(".s-user-header--profile")).toBeTruthy();
    expect(menu?.querySelector(".s-user-avatar-chip")).toBeTruthy();
    expect(menu?.textContent).toContain("alice");
    expect(menu?.textContent).toContain("alice@example.com");
    expect(c.querySelector(".menu-stub-row[data-key='logout'][data-danger]")).toBeTruthy();

    await click(btn);
    expect(c.querySelector(".menu-stub")).toBeNull();
  });

  it("emits avatarClick instead of the dropdown in drawer mode", async () => {
    const clicks: number[] = [];
    const c = mount(headerNode({
      avatarAction: "drawer",
      title: "Providers",
      userEmail: "alice@example.com",
      onAvatarClick: () => clicks.push(1),
    }));
    const btn = avatarButton(c);
    expect(btn?.getAttribute("aria-haspopup")).toBe("dialog");

    await click(btn);
    expect(clicks).toHaveLength(1);
    // The dropdown must NOT open in drawer mode, and neither the title
    // nor the nickname renders — both live in the drawer footer.
    expect(c.querySelector(".menu-stub")).toBeNull();
    expect(c.textContent).not.toContain("Providers");
    expect(c.textContent).not.toContain("alice");
  });

  it("renders the signing-in placeholder with the force-sign-out escape when the identity is empty", async () => {
    const onForceSignOut = vi.fn();
    const c = mount(headerNode({
      username: "",
      userEmail: "",
      signingInLabel: "Signing in…",
      forceSignOutLabel: "Sign out now",
      onForceSignOut,
    }));
    await click(avatarButton(c));

    expect(c.querySelector(".s-user-header--pending")).toBeTruthy();
    expect(c.textContent).toContain("Signing in…");
    // No action items above an absent identity.
    expect(c.textContent).not.toContain("Avatar");

    await click(c.querySelector(".menu-stub-row"));
    expect(onForceSignOut).toHaveBeenCalledTimes(1);
  });

  it("renders the goToFrontend row above logout and emits goToFrontend", async () => {
    const onGoToFrontend = vi.fn();
    const c = mount(headerNode({
      userEmail: "alice@example.com",
      logoutLabel: "Log out",
      goToFrontendLabel: "Go to Frontend",
      onGoToFrontend,
    }));
    // Opt-in: absent without the label prop…
    const bare = mount(headerNode({ userEmail: "alice@example.com", logoutLabel: "Log out" }));
    await click(avatarButton(bare));
    expect(bare.querySelector(".menu-stub-row[data-key='go-to-frontend']")).toBeNull();

    // …and present (directly above logout, mirroring the drawer user
    // panel's row order) with the label prop.
    await click(avatarButton(c));
    const keys = menuRows(c).map((r) => r.dataset.key);
    expect(keys.indexOf("go-to-frontend")).toBeGreaterThan(-1);
    expect(keys.indexOf("logout")).toBe(keys.indexOf("go-to-frontend") + 1);

    await click(menuRows(c)[keys.indexOf("go-to-frontend")]);
    expect(onGoToFrontend).toHaveBeenCalledTimes(1);
  });

  it("offers locales as a checked cascade and emits localeSelect with the code", async () => {
    const onLocaleSelect = vi.fn();
    const c = mount(headerNode({
      userEmail: "alice@example.com",
      localeOptions: [
        { code: "en", label: "English" },
        { code: "zh-Hans", label: "简体中文" },
      ],
      currentLocale: "zh-Hans",
      onLocaleSelect,
    }));
    await click(avatarButton(c));

    // Children flatten after the parent row with checked state on the
    // active locale only.
    const rows = menuRows(c);
    const localeIdx = rows.findIndex((r) => r.dataset.key === "locale");
    const en = rows[localeIdx + 1];
    const zh = rows[localeIdx + 2];
    expect(en.dataset.key).toBe("locale:en");
    expect(zh.dataset.key).toBe("locale:zh-Hans");
    expect(zh.dataset.checked).toBe("true");
    expect(en.dataset.checked).toBeUndefined();

    await click(en);
    expect(onLocaleSelect).toHaveBeenCalledWith("en");
  });

  it("renders no emergency-stop control by default", () => {
    const c = mount(headerNode({ username: "alice" }));
    expect(c.textContent.toLowerCase()).not.toContain("emergency");
  });
});
