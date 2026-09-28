import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import { HkThirdPartySignInCard } from "./HkThirdPartySignInCard";

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
  for (const popup of [...document.querySelectorAll(".hk-tooltip-popup")]) popup.remove();
});

const methods = [
  { key: "feishu", label: "Feishu" },
  { key: "github", label: "GitHub" },
];

describe("HkThirdPartySignInCard", () => {
  it("renders the auth-card shell with the tiles as the only body content", () => {
    const c = mount(h(HkThirdPartySignInCard, { title: "Sign in", subtitle: "Welcome back", methods }));
    expect(c.querySelector(".s-auth-card")).toBeTruthy();
    expect(c.querySelector(".s-auth-title")?.textContent).toBe("Sign in");
    expect(c.querySelector(".s-auth-subtitle")?.textContent).toBe("Welcome back");
    const tiles = c.querySelectorAll<HTMLButtonElement>(".s-auth-methods-tile");
    expect(tiles.length).toBe(2);
    // Primary and ONLY content: no credentials form, no submit button.
    expect(c.querySelector("form")).toBeNull();
    expect(c.querySelector("button[type='submit']")).toBeNull();
    expect(c.querySelector(".hk-btn")).toBeNull();
    // The methods block renders as the card BODY (inside the form-body
    // container), not as the under-a-form `methods` slot block.
    const blocks = c.querySelectorAll(".s-auth-methods");
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.closest(".s-auth-form")).toBeTruthy();
  });

  it("forwards the divider text to the method list", () => {
    const c = mount(
      h(HkThirdPartySignInCard, { title: "T", divider: "选择登录方式", methods }),
    );
    expect(c.querySelector(".s-auth-methods-divider")?.textContent).toContain("选择登录方式");
  });

  it("emits select with the method key on click", async () => {
    const picked: string[] = [];
    const c = mount(
      h(HkThirdPartySignInCard, {
        title: "T",
        methods,
        onSelect: (key: string) => {
          picked.push(key);
        },
      }),
    );
    const tiles = c.querySelectorAll<HTMLButtonElement>(".s-auth-methods-tile");
    tiles[1]!.click();
    await nextTick();
    // Both tiles are asserted so a constant-literal emit cannot ride an
    // accidental fixture coincidence.
    tiles[0]!.click();
    await nextTick();
    expect(picked).toEqual(["github", "feishu"]);
  });

  it("disables every tile while loading and swallows clicks", async () => {
    const picked: string[] = [];
    const c = mount(
      h(HkThirdPartySignInCard, {
        title: "T",
        methods,
        loading: true,
        onSelect: (key: string) => {
          picked.push(key);
        },
      }),
    );
    const tiles = c.querySelectorAll<HTMLButtonElement>(".s-auth-methods-tile");
    expect(tiles.length).toBe(2);
    for (const tile of tiles) {
      expect(tile.disabled).toBe(true);
      tile.click();
    }
    await nextTick();
    expect(picked).toEqual([]);
  });

  it("renders no tiles for an empty methods list without losing the shell", () => {
    const c = mount(h(HkThirdPartySignInCard, { title: "T", methods: [] }));
    expect(c.querySelector(".s-auth-card")).toBeTruthy();
    expect(c.querySelectorAll(".s-auth-methods-tile").length).toBe(0);
  });

  it("renders the header logo from logoSrc", () => {
    const c = mount(h(HkThirdPartySignInCard, { title: "T", logoSrc: "/logo.webp", methods }));
    const img = c.querySelector(".s-auth-header img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("/logo.webp");
  });

  it("forwards the top and footer slots", () => {
    const c = mount(
      h(HkThirdPartySignInCard, { title: "T", methods }, {
        top: () => h("div", { id: "top-slot" }, "tabs"),
        footer: () => h("div", { class: "footer-probe" }, "footer"),
      }),
    );
    const top = c.querySelector("#top-slot") as HTMLElement;
    expect(top).toBeTruthy();
    expect(c.querySelector(".s-auth-footer .footer-probe")).toBeTruthy();
    // The top slot sits above the tiles in the card body.
    const tiles = c.querySelector(".s-auth-methods-tiles") as HTMLElement;
    expect(
      top.compareDocumentPosition(tiles) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

// SCSS contract (house pattern, cf. the HkAuthCard methods-block spacing
// contract): happy-dom does not lay out, so the body re-positioning and
// the primary-flow tile bump are asserted on the sheet text. Block
// comments are stripped first so a commented-out declaration cannot
// satisfy the guard.
describe("HkThirdPartySignInCard SCSS contract", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const scss = readFileSync(join(here, "./HkThirdPartySignInCard.scss"), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  it("re-positions the reused methods container as the card body", () => {
    const rule = scss.match(/\.s-auth-form \.s-auth-third-party-body\s*{[^}]*}/)?.[0] ?? "";
    expect(rule, "body re-positioning rule must exist").toBeTruthy();
    // The under-a-form banding collapses (the body container owns the
    // padding) and the block centers when the body is taller.
    expect(rule).toContain("margin-top: 0");
    expect(rule).toContain("padding: 0");
    expect(rule).toContain("justify-content: center");
    expect(rule).toContain("gap: var(--space-8, 0.5rem)");
  });

  it("promotes the tiles one size step in the primary-flow context", () => {
    const rule = scss.match(/\.s-auth-third-party-body \.s-auth-methods-tile\s*{[^}]*}/)?.[0] ?? "";
    expect(rule, "tile bump rule must exist").toBeTruthy();
    expect(rule).toContain("width: 3.25rem");
    expect(rule).toContain("height: 3.25rem");
  });
});

describe("HkThirdPartySignInCard public export surface", () => {
  // 2026-09-28 R1 finding: removing either spelling from index.ts passed
  // every gate — nothing guarded the barrel. Importing the full barrel in a
  // test hangs (750+ transitive modules), so the guard is source-pinned:
  // both export lines must exist verbatim. A dropped line goes red here.
  it("exports both the canonical Hk* and legacy H* spellings from the barrel", async () => {
    const { readFile } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    const index = await readFile(resolve(__dirname, "../index.ts"), "utf8");
    expect(index).toContain(
      'export { HkThirdPartySignInCard as HkThirdPartySignInCard } from "./components/HkThirdPartySignInCard";',
    );
    expect(index).toContain(
      'export { HkThirdPartySignInCard as HThirdPartySignInCard } from "./components/HkThirdPartySignInCard";',
    );
  });
});
