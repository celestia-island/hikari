import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import HkMarkdownRenderer from "./HkMarkdownRenderer";

/**
 * SECURITY (perfsec follow-up, 2026-11-15): the renderer's link override
 * neutralizes script-scheme hrefs at RENDER time — no `href` attribute is
 * emitted at all, so the guard holds even where the DOMPurify build
 * misbehaves (happy-dom strips odd shapes; real browsers rely on it as the
 * primary pass). Middle-click / "open in new tab" reads the raw attribute:
 * this is the face that must stay clean. Legit links — https, mailto,
 * relative, and custom protocols the coordinator adjudicates — keep their
 * attribute and their delegated-click path.
 */

const mounts: { app: ReturnType<typeof createApp>; container: HTMLElement }[] = [];

function mount(content: string): { container: HTMLElement; set: (v: string) => void } {
  const holder = ref(content);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(HkMarkdownRenderer, { content: holder.value }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { container, set: (v: string) => void (holder.value = v) };
}

async function settleFor(root: HTMLElement, selector: string, tries = 120): Promise<void> {
  for (let i = 0; i < tries; i += 1) {
    if (root.querySelector(selector)) return;
    await new Promise((r) => setTimeout(r, 5));
    await nextTick();
  }
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkMarkdownRenderer link scheme guard", () => {
  it("renders a javascript: link as an inert span with no href at all", async () => {
    const { container } = mount("click [me](javascript:alert(1)) now");
    await settleFor(container, ".hk-md-link-neutralized");
    const neutral = container.querySelector(".hk-md-link-neutralized");
    expect(neutral?.textContent).toBe("me");
    // The face that matters: NO anchor carrying a script scheme exists —
    // middle-click and "open in new tab" have nothing to read.
    expect(container.querySelector("a")).toBeNull();
  });

  it("also neutralizes data:, vbscript: and blob: in one document", async () => {
    const doc = [
      "[a](data:text/html,<b>x</b>)",
      "[b](vbscript:msgbox)",
      "[c](blob:https://x/uuid)",
    ].join(" and ");
    const { container } = mount(doc);
    await settleFor(container, ".hk-md-link-neutralized");
    expect(container.querySelectorAll(".hk-md-link-neutralized").length).toBe(3);
    expect(container.querySelector("a")).toBeNull();
  });

  it("renders the tab-obfuscated javascript: shape as plain text, not a link", async () => {
    // marked's own lexer refuses `java<TAB>script:` as a URL at all, so the
    // construct never becomes an anchor — stronger than neutralizing: there
    // is nothing to click, copy or open. Pinned so a future marked upgrade
    // that starts accepting the shape trips THIS test (and then the guard
    // above catches it).
    const { container } = mount("[d](java\tscript:alert(1))");
    await settleFor(container, ".hk-markdown-body span, .hk-markdown-body a, .hk-markdown-body p");
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector(".hk-md-link-neutralized")).toBeNull();
    expect(container.textContent).toContain("[d]");
  });

  it("keeps legit links intact — https, mailto, relative, custom protocol", async () => {
    const doc = [
      "[docs](https://docs.celestia.world/meta/cla.html)",
      "[mail](mailto:security@celestia.world)",
      "[rel](cla.md)",
      "[frag](#section)",
      "[vscode](vscode://file/x)",
    ].join(" · ");
    const { container } = mount(doc);
    await settleFor(container, "a[href]");
    const hrefs = [...container.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("https://docs.celestia.world/meta/cla.html");
    expect(hrefs).toContain("mailto:security@celestia.world");
    expect(hrefs).toContain("cla.md");
    expect(hrefs).toContain("#section");
    // Custom protocols keep their attribute: the coordinator (not the
    // renderer) adjudicates them on click — #1321's contract.
    expect(hrefs).toContain("vscode://file/x");
    expect(container.querySelector(".hk-md-link-neutralized")).toBeNull();
  });

  it("re-render swaps a neutralized link for a good one and back", async () => {
    const { container, set } = mount("[x](javascript:alert(1))");
    await settleFor(container, ".hk-md-link-neutralized");
    expect(container.querySelector("a")).toBeNull();
    set("[x](https://ok.example/)");
    await settleFor(container, "a[href='https://ok.example/']");
    expect(container.querySelector(".hk-md-link-neutralized")).toBeNull();
  });
});
