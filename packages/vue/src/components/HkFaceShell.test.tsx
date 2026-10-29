import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h } from "vue";

// HDrawer teleports and animates; replace it with an inline passthrough
// (same stub shape as HkAdminShell.test.tsx) so the shell contract is
// testable without the overlay runtime.
vi.mock("@celestia-island/hikari", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@celestia-island/hikari")>();
  const { defineComponent, h } = await import("vue");
  const HDrawerStub = defineComponent({
    name: "HDrawer",
    props: {
      modelValue: { type: Boolean, default: false },
      side: { type: String, default: "left" },
      size: { type: String, default: "280px" },
      title: { type: String, default: undefined },
      panelClass: { type: String, default: undefined },
    },
    setup(props, { slots }) {
      return () =>
        props.modelValue
          ? h("div", { class: ["drawer-stub", props.panelClass] }, [
              h("div", { class: "drawer-stub-body" }, slots.default?.()),
              slots.footer
                ? h("div", { class: "drawer-stub-footer" }, slots.footer())
                : null,
            ])
          : null;
    },
  });
  return { ...actual, HDrawer: HDrawerStub };
});

import { HkFaceShell } from "./HkFaceShell";
import { HkAdminShell } from "./HkAdminShell";

/**
 * HkFaceShell — the generalized face shell extracted from HkAdminShell
 * (2026-10-29). What this file pins:
 *
 * 1. The STAGE content mode: no scroll viewport, no padding wrapper, the
 *    content bare under the main region — a canvas face must never be
 *    wrapped in the document viewport (that is the mode's reason for
 *    existing). `contentPadding` is ignored there.
 * 2. The DOCUMENT mode (default) keeps the admin shell's exact host:
 *    scroll viewport + inner padding wrapper + `data-content-mode`.
 * 3. `contentKey` crossfade stays available in BOTH modes.
 * 4. The footer band + its injection-driven height reservation behave
 *    identically in both modes.
 * 5. The extraction boundary: HkFaceShell's header slot carries NO
 *    `actions` param (the shell provides no action bar); HkAdminShell —
 *    the admin wrapper — still injects it (the legacy channel that
 *    wrapper exists to keep).
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

const CONTENT = () => h("main", null, "CONTENT");
const FOOTER = () => h("div", { class: "footer-mock" }, "FOOTER");

describe("HkFaceShell stage mode", () => {
  it("renders the content bare — no scroll viewport, no padding wrapper", () => {
    const c = mount(h(HkFaceShell, {
      contentMode: "stage",
      contentPadding: "3rem",
      navTitle: "Navigation",
    }, {
      header: () => null,
      content: CONTENT,
    }));
    const main = c.querySelector(".s-admin-shell-main");
    expect(main, "the main region exists").toBeTruthy();
    expect(main!.getAttribute("data-content-mode")).toBe("stage");
    // The document host is GONE — that is the stage contract.
    expect(c.querySelector(".hk-scroll-container")).toBeNull();
    expect(c.querySelector(".hk-scroll-container-viewport")).toBeNull();
    // No padding wrapper anywhere: the content slot's first element IS
    // the main region's child (contentPadding is a document-mode prop).
    expect(main!.firstElementChild?.textContent).toBe("CONTENT");
    expect([...main!.querySelectorAll("*")].every((el) => (el as HTMLElement).style.padding === "")).toBe(true);
  });

  it("still honors the contentKey crossfade in stage mode", () => {
    const c = mount(h(HkFaceShell, {
      contentMode: "stage",
      contentKey: "scene-a",
      navTitle: "Navigation",
    }, {
      header: () => null,
      content: CONTENT,
    }));
    const swap = c.querySelector(".s-admin-shell-swap");
    expect(swap, "the library crossfade wraps the stage content").toBeTruthy();
    expect(swap!.className).toContain("hk-crossfade");
    // …and the crossfade is the main region's DIRECT child (no host
    // wrapper between them).
    expect(swap!.parentElement!.classList.contains("s-admin-shell-main")).toBe(true);
  });

  it("keeps the footer band and its reservation in stage mode", () => {
    const withFooter = mount(h(HkFaceShell, {
      contentMode: "stage",
      navTitle: "Navigation",
    }, {
      header: () => null,
      content: CONTENT,
      footer: FOOTER,
    }));
    expect(withFooter.querySelector("footer.s-status-bar .footer-mock")).toBeTruthy();
    expect((withFooter.querySelector(".s-admin-shell-body") as HTMLElement)!.style.paddingBottom)
      .toBe("var(--s-footer-height)");

    const withoutFooter = mount(h(HkFaceShell, {
      contentMode: "stage",
      navTitle: "Navigation",
    }, {
      header: () => null,
      content: CONTENT,
    }));
    expect(withoutFooter.querySelector("footer.s-status-bar")).toBeNull();
    expect((withoutFooter.querySelector(".s-admin-shell-body") as HTMLElement)!.style.paddingBottom).toBe("0px");
  });
});

describe("HkFaceShell document mode (the default)", () => {
  it("keeps the admin shell's exact content host", () => {
    const c = mount(h(HkFaceShell, {
      contentPadding: "2rem",
      navTitle: "Navigation",
    }, {
      header: () => null,
      content: CONTENT,
    }));
    const main = c.querySelector(".s-admin-shell-main");
    expect(main!.getAttribute("data-content-mode")).toBe("document");
    expect(c.querySelector(".hk-scroll-container")).toBeTruthy();
    const viewport = c.querySelector(".hk-scroll-container-viewport")
      ?? c.querySelector(".hk-scroll-container");
    const inner = viewport!.firstElementChild as HTMLElement;
    expect(inner.style.padding).toBe("2rem");
    expect(inner.textContent).toContain("CONTENT");
  });
});

describe("the extraction boundary: the action-bar channel", () => {
  it("HkFaceShell's header slot carries no actions param (no bar provided)", () => {
    const seen: Array<Record<string, unknown>> = [];
    mount(h(HkFaceShell, { navTitle: "Navigation" }, {
      header: (params: Record<string, unknown>) => {
        seen.push(params);
        return null;
      },
      content: CONTENT,
    }));
    expect(seen.length).toBeGreaterThan(0);
    for (const params of seen) {
      expect("actions" in params).toBe(false);
    }
    // The shell-scoped params the face header relies on are all there.
    expect(seen[0]).toMatchObject({
      isDesktop: true,
      showHamburger: false,
      compact: false,
    });
    expect(typeof seen[0].onOpenDrawer).toBe("function");
  });

  it("HkAdminShell still injects actions into its header slot (the legacy channel)", () => {
    const seen: Array<Record<string, unknown>> = [];
    mount(h(HkAdminShell, { navTitle: "Navigation" }, {
      header: (params: Record<string, unknown>) => {
        seen.push(params);
        return null;
      },
      content: CONTENT,
    }));
    expect(seen.length).toBeGreaterThan(0);
    for (const params of seen) {
      expect("actions" in params).toBe(true);
      expect(Array.isArray(params.actions)).toBe(true);
    }
  });
});
