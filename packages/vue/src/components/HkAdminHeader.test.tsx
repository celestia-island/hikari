import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h } from "vue";

/** The slice of HkMenu's item shape this stub renders. */
interface MenuItemStub {
  key: string;
  label?: string;
  checked?: boolean;
  danger?: boolean;
  children?: MenuItemStub[];
}

// HkMenu renders its levels through HkSelectPanel, which teleports to
// body — replace just HkMenu (imported by the component from
// ./HkMenu) with an inline passthrough that renders the header slot
// plus one flattened row per item (children included) while open,
// wiring row clicks to the select handler; the rest of hikari stays
// real. The select handler reaches the stub through attrs (it is not
// re-declared as an emit, which would strip it from props).
vi.mock("./HkMenu", async () => {
  const { defineComponent, h } = await import("vue");
  const { asPropType } = await import("../utils/typing");
  const HMenuStub = defineComponent({
    name: "HMenu",
    props: {
      open: { type: Boolean, default: false },
      items: { type: asPropType<MenuItemStub[]>(Array), default: () => [] },
      title: { type: String, default: "" },
    },
    setup(props, { slots, attrs }) {
      return () => {
        if (!props.open) return null;
        const rows: ReturnType<typeof h>[] = [];
        const flatten = (items: MenuItemStub[]) => {
          for (const item of items ?? []) {
            rows.push(
              h(
                "button",
                {
                  class: "menu-stub-row",
                  "data-key": item.key,
                  "data-checked": item.checked || undefined,
                  "data-danger": item.danger || undefined,
                  onClick: () => {
                    const onSelect = attrs.onSelect;
                    if (typeof onSelect === "function") onSelect(item.key);
                  },
                },
                item.label,
              ),
            );
            if (item.children?.length) flatten(item.children);
          }
        };
        flatten(props.items);
        return h("div", { class: "menu-stub" }, [
          ...(slots.header?.() ?? []),
          ...rows,
          ...(slots.footer?.() ?? []),
        ]);
      };
    },
  });
  return { default: HMenuStub };
});

import { CHROME_BAND_DRAG_REGION } from "../runtime/windowChrome";
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

  it("renders no avatar trigger when no identity is injected", () => {
    // 2026-10-24 regression: the trigger rendered unconditionally, so a
    // host with no identity props got a stray "?" button opening an
    // empty "Signing in…" menu with a lone sign-out row. The identity
    // cluster is injection-driven now — no identity, no trigger.
    const anonymous = mount(headerNode({ username: "", title: "Anywhere" }));
    expect(avatarButton(anonymous)).toBeNull();
    // The page title still rides the left wing without the avatar.
    expect(anonymous.querySelector("header > div")?.textContent).toContain("Anywhere");

    // The pending identity flow is EXPLICIT injection: signingInLabel /
    // onForceSignOut keep the "?" trigger alive so the force-sign-out
    // escape stays reachable during a wedged session restore.
    const pending = mount(headerNode({
      username: "",
      signingInLabel: "Signing in…",
      onForceSignOut: () => {},
    }));
    const btn = avatarButton(pending) as HTMLButtonElement;
    expect(btn.querySelector(".s-user-avatar")?.textContent).toBe("?");
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

  it("reserves the workspace-switcher slot in drawer mode only", () => {
    // 2026-10-29 user direction: the frontend header's left wing is
    // avatar + ws-trigger; the console drawer face keeps the SLOT as a
    // deliberate blank so the centre strip can never slide into the
    // space — menu mode carries the page title in that position instead.
    const drawer = mount(headerNode({ avatarAction: "drawer", userEmail: "alice@example.com" }));
    const slot = drawer.querySelector(".s-admin-header-ws-slot");
    expect(slot, "drawer face must render the reserved ws slot").toBeTruthy();
    expect(slot?.getAttribute("aria-hidden")).toBe("true");

    const menu = mount(headerNode({ title: "Providers", logoutLabel: "Log out" }));
    expect(menu.querySelector(".s-admin-header-ws-slot")).toBeNull();
    expect(menu.querySelector(".s-admin-header-title")).toBeTruthy();
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

  it("renders the page centre group between the identity and the actions when provided", () => {
    const c = mount(headerNode({ title: "My tasks" }, {
      center: () => h("nav", { class: "centre-stub" }, "filter group"),
    }));
    const centre = c.querySelector(".s-admin-header-center");
    expect(centre, "the centre wrapper must render when the slot is provided").not.toBeNull();
    expect(centre?.querySelector(".centre-stub")?.textContent).toBe("filter group");
    // Wing order: identity (left) → centre → actions (right). The wings
    // carry their chrome class PLUS the shared balanced-grid wing class,
    // so match per-class instead of whole-className equality.
    const header = c.querySelector("header")!;
    const kids = [...header.children].map((el) => el.className);
    const wingIdx = (cls: string) => kids.findIndex((c) => c.split(/\s+/).includes(cls));
    expect(wingIdx("s-admin-header-user")).toBeLessThan(wingIdx("s-admin-header-center"));
    expect(wingIdx("s-admin-header-center")).toBeLessThan(wingIdx("s-admin-header-actions"));
    // The header hangs the shared balanced-grid contract — the same
    // geometry the chat frontend's header uses (user report 2026-10-15:
    // the console strip sat left of centre on phones).
    expect(header.className).toContain("s-balanced-header");
    expect(kids.find((c) => c.includes("s-admin-header-user"))).toContain("s-header-wing-start");
    expect(kids.find((c) => c.includes("s-admin-header-center"))).toContain("s-header-wing-center");
    expect(kids.find((c) => c.includes("s-admin-header-actions"))).toContain("s-header-wing-end");
  });

  it("renders no centre wrapper without the slot (DOM unchanged for hosts that skip it)", () => {
    const c = mount(headerNode({ title: "Providers" }));
    expect(c.querySelector(".s-admin-header-center")).toBeNull();
    // Centre-less hosts are the MAJORITY of admin pages: the actions wing
    // must still carry its explicit grid-column class, or auto-placement
    // drops it into the empty middle track and it drifts to the viewport
    // centre (R2, 2026-10-15 — the class IS the column).
    const actions = c.querySelector(".s-admin-header-actions");
    expect(actions?.className).toContain("s-header-wing-end");
  });

  it("leaves the left wing shape untouched when no brand is provided (additive gate)", () => {
    // THE zero-change pin for the brand slot: hosts that never pass
    // brandSrc / brand (chest today) must get the exact wing they always
    // had — avatar trigger then title, no brand node anywhere. Pinned as
    // a structural shape so a future left-wing refactor that disturbs
    // non-branded hosts trips HERE, not in a downstream repo.
    const c = mount(headerNode({ title: "Providers", userEmail: "alice@example.com" }));
    const wing = c.querySelector(".s-admin-header-user")!;
    const shape = [...wing.children].map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
    expect(shape).toEqual([
      "button.s-admin-header-avatar",
      "span.s-admin-header-title",
    ]);
    expect(c.querySelector(".s-admin-header-brand")).toBeNull();
  });
});

describe("HkAdminHeader brand slot (opt-in site mark)", () => {
  it("renders the static brand mark in place of the identity trigger on the desktop face", () => {
    // Identity props are PRESENT on purpose: the mark REPLACES the
    // trigger, it does not wait for an absent identity.
    const c = mount(headerNode({
      title: "Providers",
      userEmail: "alice@example.com",
      brandSrc: "https://example.invalid/logo.png",
      brandAlt: "Lagrange",
    }));
    const brand = c.querySelector(".s-admin-header-brand");
    expect(brand, "the brand mark must render").not.toBeNull();
    const img = brand?.querySelector("img.hk-logo-img") as HTMLImageElement | null;
    expect(img?.getAttribute("src")).toBe("https://example.invalid/logo.png");
    expect(img?.getAttribute("alt")).toBe("Lagrange");
    expect(avatarButton(c), "the identity trigger must be replaced").toBeNull();
    // The WHERE title keeps its node — the mark replaces the identity,
    // not the page title beside it.
    expect(c.querySelector(".s-admin-header-title")?.textContent).toBe("Providers");
  });

  it("keeps the mark free of button semantics (an identity, not a control)", () => {
    // No hamburger on this mount: the branded wing must hold NO button
    // at all — the account entry moved to the host's own surface, and
    // the mark itself is a span around a div/img, not a control.
    const c = mount(headerNode({ brandSrc: "https://example.invalid/logo.png" }));
    expect(c.querySelector(".s-admin-header-user button")).toBeNull();
    expect(c.querySelector(".s-admin-header-brand button")).toBeNull();
  });

  it("prefers the brand slot over brandSrc when both are supplied", () => {
    const c = mount(headerNode(
      { brandSrc: "https://example.invalid/logo.png" },
      { brand: () => h("span", { class: "host-brand-mark" }, "host mark") },
    ));
    expect(c.querySelector(".host-brand-mark")?.textContent).toBe("host mark");
    expect(c.querySelector(".hk-logo")).toBeNull();
    expect(avatarButton(c)).toBeNull();
  });

  it("never renders the brand on the drawer face and keeps the drawer path alive", async () => {
    const clicks: number[] = [];
    const c = mount(headerNode({
      avatarAction: "drawer",
      userEmail: "alice@example.com",
      brandSrc: "https://example.invalid/logo.png",
      onAvatarClick: () => clicks.push(1),
    }));
    // The mark is absent AND the avatar trigger still opens the drawer —
    // that trigger is the drawer's only opener, so the mobile path is
    // invariant under the brand props.
    expect(c.querySelector(".s-admin-header-brand")).toBeNull();
    const btn = avatarButton(c);
    expect(btn?.getAttribute("aria-haspopup")).toBe("dialog");
    await click(btn);
    expect(clicks).toHaveLength(1);
  });
});

describe("HkAdminHeader chrome face drag region (2026-11-12)", () => {
  // WHY: with chrome on, this header IS the desktop window's caption band (Tauri
  // decorations:false). A bare drag attribute only matches the exact event
  // target, so the wings that tile the header shadowed it — dragging and the
  // double-click maximize never fired. The chrome face must carry hikari's deep
  // contract on the header root; the content face (chrome off) must not.
  it("carries the shared deep drag region when it is the caption band", () => {
    const c = mount(headerNode({ chrome: true }));
    const header = c.querySelector("header")!;
    expect(header.getAttribute("data-tauri-drag-region")).toBe(CHROME_BAND_DRAG_REGION);
    // The LITERAL as well — the constant comparison alone follows a wrong value
    // (mutation evidence: "true" kept this suite green before this pin).
    expect(header.getAttribute("data-tauri-drag-region")).toBe("deep");
    expect(header.classList.contains("hk-chrome-band")).toBe(true);
  });

  it("leaves the content-face header out of the drag contract", () => {
    const c = mount(headerNode({}));
    expect(c.querySelector("header")!.hasAttribute("data-tauri-drag-region")).toBe(false);
  });
});

describe("HkAdminHeader host slots (L39 ruling-a revival)", () => {
  const LOCALES = [
    { code: "en", label: "English" },
    { code: "zh-Hans", label: "简体中文" },
  ];

  async function openMenu(c: HTMLElement) {
    await click(avatarButton(c));
    return c.querySelector(".menu-stub") as HTMLElement | null;
  }

  it("renders user-menu-extra rows in the dropdown tail and close() dismisses the menu", async () => {
    const c = mount(
      headerNode({ logoutLabel: "Log out" }, {
        "user-menu-extra": ({ close }: { close?: () => void }) =>
          h("button", { class: "menu-stub-row extra-row", onClick: () => close?.() }, "Account center"),
      }),
    );
    const menu = await openMenu(c);
    // The host row rides AFTER the built-in rows (tail), inside the menu.
    const rows = menuRows(c);
    expect(rows[rows.length - 1].textContent).toBe("Account center");
    // close() dismisses the dropdown — a navigating entry leaves no
    // orphaned menu behind.
    await click(rows[rows.length - 1]);
    expect(c.querySelector(".menu-stub")).toBeNull();
  });

  it("renders the locale-picker popup when the Language row is selected", async () => {
    const c = mount(
      headerNode(
        { localeOptions: LOCALES, localeMenuLabel: "Language" },
        {
          "locale-picker": ({ open }: { open: boolean }) =>
            h("div", { class: "locale-popup", "data-open": String(open) }, "picker"),
        },
      ),
    );
    // Popup starts closed.
    expect(c.querySelector(".locale-popup")?.getAttribute("data-open")).toBe("false");
    const menu = await openMenu(c);
    // Slot mode: the Language row is a leaf (no built-in cascade rows).
    expect(menu!.querySelector('[data-key="locale:en"]')).toBeNull();
    expect(menu!.querySelector('[data-key="locale:zh-Hans"]')).toBeNull();
    await click(menu!.querySelector('[data-key="locale"]'));
    // Selecting the Language row opens the host popup (the payload's
    // open flips true; the real assertion is the rendered data-open).
    expect(c.querySelector(".locale-popup")?.getAttribute("data-open")).toBe("true");
  });

  it("keeps the built-in cascade when no locale-picker slot is supplied", async () => {
    // NEGATIVE CONTROL (hosts like chest pass localeOptions and nothing
    // else): the Language row keeps its built-in children exactly as
    // before the revival.
    const c = mount(headerNode({ localeOptions: LOCALES, localeMenuLabel: "Language" }));
    const menu = await openMenu(c);
    expect(menu!.querySelector('[data-key="locale:en"]')).not.toBeNull();
    expect(menu!.querySelector('[data-key="locale:zh-Hans"]')).not.toBeNull();
    expect(menu!.querySelector('[data-key="locale"]')).not.toBeNull();
  });

  it("renders neither host surface when neither slot is supplied", () => {
    // NEGATIVE CONTROL: existing hosts (chest-shaped) see zero change —
    // no tail rows, no popup mount, the exact DOM they always had.
    const c = mount(headerNode({ localeOptions: LOCALES }));
    expect(c.querySelector(".menu-stub")).toBeNull();
    expect(c.querySelector(".locale-popup")).toBeNull();
    expect(c.textContent).not.toContain("Account center");
  });
});
