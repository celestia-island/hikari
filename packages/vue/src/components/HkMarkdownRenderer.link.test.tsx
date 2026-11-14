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

describe("HkMarkdownRenderer raw-HTML and image sweep (review S1/S2)", () => {
  it("strips the href of a raw-HTML anchor with a script scheme", async () => {
    // renderer.link never sees raw HTML — it rides renderer.html into the
    // sanitize pass, which is unreliable in some environments. The
    // post-sanitize DOM sweep is what must catch this shape.
    const { container } = mount('<a href="javascript:alert(1)">raw</a>');
    await settleFor(container, ".hk-markdown-body a, .hk-markdown-body span");
    const anchors = [...container.querySelectorAll("a")];
    expect(anchors.length).toBe(1);
    expect(anchors[0].getAttribute("href")).toBeNull();
    expect(anchors[0].textContent).toBe("raw");
  });

  it("strips raw-HTML anchors case-insensitively and data: variants", async () => {
    const doc = [
      '<A HREF="JavaScript:alert(1)">up</A>',
      '<a href="data:text/html,<b>x</b>">data</a>',
      "<a href='vbscript:msgbox'>vb</a>",
    ].join("\n");
    const { container } = mount(doc);
    await settleFor(container, ".hk-markdown-body a, .hk-markdown-body span");
    for (const a of [...container.querySelectorAll("a")]) {
      expect(a.getAttribute("href")).toBeNull();
    }
    expect(container.querySelectorAll("a").length).toBe(3);
  });

  it("strips a script-scheme img src (image token AND raw HTML)", async () => {
    const doc = [
      "![x](javascript:alert(1))",
      '<img src="javascript:alert(1)" alt="y">',
      "![ok](https://example.com/i.png)",
    ].join("\n");
    const { container } = mount(doc);
    await settleFor(container, ".hk-markdown-body img");
    const srcs = [...container.querySelectorAll("img")]
      .map((i) => i.getAttribute("src"))
      .filter(Boolean);
    expect(srcs).toEqual(["https://example.com/i.png"]);
  });

  it("strips a script-scheme image-map area href (review follow-up)", async () => {
    // <area href> is the same navigation sink as <a href>, and it is the
    // one shape DOMPurify's unreliable builds let through alongside it.
    const doc = [
      '<map name="m">',
      '<area href="javascript:alert(1)" alt="evil">',
      '<area href="https://ok.example/x" alt="ok">',
      "</map>",
    ].join("");
    const { container } = mount(doc);
    await settleFor(container, ".hk-markdown-body area");
    const hrefs = [...container.querySelectorAll("area")]
      .map((el) => el.getAttribute("href"))
      .filter(Boolean);
    expect(hrefs).toEqual(["https://ok.example/x"]);
  });

  it("keeps a legit raw-HTML anchor untouched", async () => {
    const { container } = mount('<a href="https://ok.example/x">raw-ok</a>');
    await settleFor(container, "a[href]");
    expect(container.querySelector("a[href]")?.getAttribute("href")).toBe(
      "https://ok.example/x",
    );
  });
});
