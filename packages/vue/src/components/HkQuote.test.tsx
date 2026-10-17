import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, type VNode } from "vue";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import HkQuote from "./HkQuote";

const here = dirname(fileURLToPath(import.meta.url));

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(renderNode: () => VNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: renderNode });
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

/**
 * HkQuote is the Markdown-blockquote grammar as a component: an accent
 * bar on the inline-start edge (tone-colored), quiet prose, NO card
 * chrome — no icon, no background, no boxed surface (user direction
 * 2026-10-18: the no-content/error states must read as a quoted info
 * block with a primary-color left bar, not an icon card).
 */
describe("HkQuote", () => {
  it("renders the quoted title and description inside a note region", () => {
    const c = mount(() =>
      h(HkQuote, {
        title: "This panel has no content yet",
        description: "Configure the data source, or let the agent generate content.",
      }),
    );
    const root = c.querySelector(".hk-quote")!;
    expect(root.getAttribute("role")).toBe("note");
    expect(c.querySelector(".hk-quote-title")!.textContent).toBe("This panel has no content yet");
    expect(c.querySelector(".hk-quote-desc")!.textContent).toContain("Configure the data source");
  });

  it("defaults to the primary tone and fill fit; every tone has a class", () => {
    const c = mount(() => h(HkQuote, { title: "t" }));
    const root = c.querySelector(".hk-quote")!;
    expect(root.classList.contains("hk-quote--primary")).toBe(true);
    expect(root.classList.contains("hk-quote--fill")).toBe(true);

    for (const tone of ["neutral", "danger", "warning", "success"] as const) {
      const toneRoot = mount(() => h(HkQuote, { title: "t", tone })).querySelector(".hk-quote")!;
      expect(toneRoot.classList.contains(`hk-quote--${tone}`)).toBe(true);
    }
  });

  it("centers itself for fill and renders a width-capped page block for page", () => {
    const fill = mount(() => h(HkQuote, { title: "t" })).querySelector(".hk-quote")!;
    expect(fill.classList.contains("hk-quote--fill")).toBe(true);
    const page = mount(() => h(HkQuote, { title: "t", fit: "page" })).querySelector(".hk-quote")!;
    expect(page.classList.contains("hk-quote--page")).toBe(true);
  });

  it("renders the action row and the default body slot", () => {
    const c = mount(() =>
      h(HkQuote, { title: "t" }, {
        default: () => h("p", { class: "extra" }, "extra line"),
        action: () => h("button", { type: "button" }, "Edit panel"),
      }),
    );
    expect(c.querySelector(".hk-quote-body .extra")!.textContent).toBe("extra line");
    const action = c.querySelector<HTMLButtonElement>(".hk-quote-action button")!;
    expect(action.textContent).toBe("Edit panel");
    // The action row is a SIBLING of the body inside the mark (pinned:
    // nesting it would halve the desc→action gap to the body's --space-4).
    expect(action.closest(".hk-quote-body")).toBeNull();
    expect(action.closest(".hk-quote-mark")).not.toBeNull();
  });

  it("passes call-site classes onto the root (no card chrome of its own)", () => {
    const c = mount(() => h(HkQuote, { title: "t", class: "host-skin" }));
    const root = c.querySelector(".hk-quote")!;
    expect(root.classList.contains("host-skin")).toBe(true);
    // The mark is the blockquote itself — the component adds no icon,
    // no boxed surface of its own (see the styles contract below).
    expect(c.querySelector(".hk-empty-icon")).toBeNull();
    expect(c.querySelector("svg")).toBeNull();
  });

  it("lets the call site override the role (error tones announce as alert)", () => {
    // Consumers rendering an error quote pass role="alert" — Vue's attr
    // fallthrough must win over the rendered default (pinned because the
    // chest error-state story depends on it).
    const c = mount(() => h(HkQuote, { title: "Couldn't load", role: "alert" }));
    expect(c.querySelector(".hk-quote")!.getAttribute("role")).toBe("alert");
  });
});

/** The visual grammar contract: the bar IS the visual. The mark carries
 *  the accent bar (border-inline-start, tone variable); it must NOT
 *  paint a background, border-radius, or shadow — anything card-like
 *  would turn the quote back into the placeholder card the component
 *  exists to replace. */
describe("HkQuote styles contract", () => {
  const scss = readFileSync(join(here, "HkQuote.scss"), "utf8");

  it("draws the accent bar with the tone variable on the mark", () => {
    expect(scss).toMatch(/\.hk-quote-mark[\s\S]*?border-inline-start:\s*3px solid var\(--hk-quote-bar\)/);
    expect(scss).toMatch(/--hk-quote-bar:\s*var\(--hi-color-primary/);
  });

  it("maps every tone class onto a house color token", () => {
    expect(scss).toMatch(/hk-quote--neutral[\s\S]*?--hi-color-text-tertiary/);
    expect(scss).toMatch(/hk-quote--danger[\s\S]*?--hi-color-danger/);
    expect(scss).toMatch(/hk-quote--warning[\s\S]*?--hi-color-warning/);
    expect(scss).toMatch(/hk-quote--success[\s\S]*?--hi-color-success/);
  });

  it("ships no card chrome on the mark (no background / radius / shadow)", () => {
    const markBlock = scss.match(/\.hk-quote-mark \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(markBlock, "the .hk-quote-mark rule exists").toMatch(/^\./);
    expect(markBlock).not.toMatch(/background/);
    expect(markBlock).not.toMatch(/border-radius/);
    expect(markBlock).not.toMatch(/box-shadow/);
  });
});
