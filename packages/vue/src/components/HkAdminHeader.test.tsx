import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h } from "vue";

// HPopover teleports to body — stubbing Teleport stringifies its vnode
// children. Replace just HPopover with an inline passthrough that renders
// its default slot while open; the rest of hikari stays real.
vi.mock("@celestia-island/hikari", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@celestia-island/hikari")>();
  const { defineComponent, h } = await import("vue");
  const HPopoverStub = defineComponent({
    name: "HPopover",
    props: {
      modelValue: { type: Boolean, default: false },
      placement: { type: String, default: "bottom" },
    },
    setup(props, { slots }) {
      return () =>
        props.modelValue
          ? h("div", { class: "popover-stub" }, slots.default?.())
          : null;
    },
  });
  return { ...actual, HPopover: HPopoverStub };
});

import { HkAdminHeader } from "./HkAdminHeader";

/**
 * HkAdminHeader contract tests for the generalized avatar/identity
 * behaviors ported from the chest plana-legacy fork:
 * - avatarAction "menu" (default) toggles the user dropdown; "drawer"
 *   emits avatarClick so the shell can open its nav drawer.
 * - the identity block (name/email/groups) leads the menu; an empty
 *   identity renders the signing-in placeholder + force-sign-out escape.
 * - an empty title hides the context-title node entirely (pages carry
 *   their own in-page title in the HPageHeader convention).
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

async function click(el: Element | null) {
  el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await Promise.resolve();
  await Promise.resolve();
}

describe("HkAdminHeader", () => {
  it("toggles the user dropdown on avatar click in menu mode", async () => {
    const c = mount(headerNode({ logoutLabel: "Log out" }));
    const btn = avatarButton(c);
    expect(btn?.getAttribute("aria-haspopup")).toBe("menu");

    await click(btn);
    const menu = c.querySelector(".popover-stub");
    // The dropdown leads with the identity block and ends with logout.
    expect(menu?.textContent).toContain("alice");
    expect(c.querySelector(".s-user-header")).toBeTruthy();
    expect(menu?.textContent).toContain("Log out");

    await click(btn);
    expect(c.querySelector(".s-user-header")).toBeNull();
  });

  it("emits avatarClick instead of the dropdown in drawer mode", async () => {
    const clicks: number[] = [];
    const c = mount(headerNode({
      avatarAction: "drawer",
      logoutLabel: "Log out",
      onAvatarClick: () => clicks.push(1),
    }));
    const btn = avatarButton(c);
    expect(btn?.getAttribute("aria-haspopup")).toBe("dialog");

    await click(btn);
    expect(clicks).toHaveLength(1);
    // The dropdown must NOT open in drawer mode, and the username stays
    // hidden — the identity block lives in the drawer footer.
    expect(c.querySelector(".s-user-header")).toBeNull();
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

    await click(c.querySelector(".s-popup-menu-item"));
    expect(onForceSignOut).toHaveBeenCalledTimes(1);
  });

  it("hides the context title entirely when it is empty", () => {
    const withTitle = mount(headerNode({ title: "Dashboard" }));
    expect(withTitle.querySelector("h2")?.textContent).toBe("Dashboard");

    const withoutTitle = mount(headerNode());
    expect(withoutTitle.querySelector("h2")).toBeNull();
  });

  it("renders no emergency-stop control by default", () => {
    const c = mount(headerNode({ username: "alice" }));
    expect(c.textContent.toLowerCase()).not.toContain("emergency");
  });

  it("renders the goToFrontend row above logout and emits goToFrontend", async () => {
    const onGoToFrontend = vi.fn();
    const c = mount(headerNode({
      logoutLabel: "Log out",
      goToFrontendLabel: "Go to Frontend",
      onGoToFrontend,
    }));
    // Opt-in: absent without the label prop…
    const bare = mount(headerNode({ logoutLabel: "Log out" }));
    await click(avatarButton(bare));
    expect(bare.textContent).not.toContain("Go to Frontend");

    // …and present (directly above logout, mirroring the drawer user
    // panel's row order) with the label prop.
    await click(avatarButton(c));
    const rows = [...c.querySelectorAll(".s-popup-menu-item")];
    const labels = rows.map((r) => r.textContent?.trim());
    expect(labels.indexOf("Go to Frontend")).toBeGreaterThan(-1);
    expect(labels.indexOf("Log out")).toBe(labels.indexOf("Go to Frontend") + 1);

    await click(rows[labels.indexOf("Go to Frontend")]);
    expect(onGoToFrontend).toHaveBeenCalledTimes(1);
  });

  it("passes the locale trigger ref OBJECT through the slot so the picker anchors to the button", async () => {
    let captured: unknown = null;
    const c = mount(headerNode(
      { username: "alice" },
      {
        "locale-picker": (scope: { triggerRef: unknown }) => {
          captured = scope.triggerRef;
          return null;
        },
      },
    ));
    await click(avatarButton(c));
    // The slot must receive the ref object itself (reactive), not its
    // frozen .value snapshot from the first render (null before the
    // ref attached).
    expect(captured).toBeTruthy();
    expect((captured as { value?: unknown }).value).toBeInstanceOf(HTMLElement);
  });
});
