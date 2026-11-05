import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkMarkdownRenderer from "./HkMarkdownRenderer";
import { applyInlineChipsToBody, inlineChipDisplay, parseInlineChips } from "./inlineChips";

/**
 * Inline chip pass contract tests (the opt-in `inlineChips` mode):
 * - the parser splits `{{ token }}` / `@ref` forms and preserves the
 *   accessible text (tokens canonicalize their spacing, refs stay raw,
 *   plain runs round-trip byte-exactly)
 * - the boundary guards hold: emails, doubled `@`, code spans, code
 *   fences and link text never chip
 * - the component applies the pass only when the prop is on
 *
 * House style: raw createApp mounts torn down after each case; the
 * async marked/DOMPurify settle uses a bounded poll.
 */

const mounts: { app: ReturnType<typeof createApp>; container: HTMLElement }[] = [];

function mount(props: Record<string, unknown>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkMarkdownRenderer, props as never) });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

async function settleFor(root: HTMLElement, selector: string, tries = 100): Promise<void> {
  for (let i = 0; i < tries; i += 1) {
    if (root.querySelector(selector)) return;
    await new Promise((r) => setTimeout(r, 5));
    await nextTick();
  }
}

afterEach(() => {
  for (const { app, container } of mounts) {
    app.unmount();
    container.remove();
  }
  mounts.length = 0;
});

describe("parseInlineChips", () => {
  it("splits tokens, refs and plain runs in source order", () => {
    expect(parseInlineChips("Badge: {{container_badge}} then @system/permission-mode")).toEqual([
      { kind: "text", text: "Badge: " },
      { kind: "token", token: "container_badge" },
      { kind: "text", text: " then " },
      { kind: "ref", raw: "@system/permission-mode" },
    ]);
  });

  it("tokenizes with the shared grammar rules (bare ids only)", () => {
    // Richer engine grammars stay literal — same rule as HkTemplateText.
    expect(parseInlineChips("{{ a.b }} {{ x | filter }} {{ ok }}")).toEqual([
      { kind: "text", text: "{{ a.b }} {{ x | filter }} " },
      { kind: "token", token: "ok" },
    ]);
  });

  it("guards the @ boundary: emails and doubled @ stay text", () => {
    expect(parseInlineChips("mail foo@bar.com now")).toEqual([
      { kind: "text", text: "mail foo@bar.com now" },
    ]);
    expect(parseInlineChips("user@@host")).toEqual([{ kind: "text", text: "user@@host" }]);
    expect(parseInlineChips("word@notachip")).toEqual([{ kind: "text", text: "word@notachip" }]);
  });

  it("refs stop at punctuation and match bare handles", () => {
    expect(parseInlineChips("see @system/x, then @demiurge.")).toEqual([
      { kind: "text", text: "see " },
      { kind: "ref", raw: "@system/x" },
      { kind: "text", text: ", then " },
      { kind: "ref", raw: "@demiurge" },
      { kind: "text", text: "." },
    ]);
  });

  it("chip display canonicalizes tokens and keeps refs raw", () => {
    expect(inlineChipDisplay({ kind: "token", token: "current_datetime" })).toBe("{{ current_datetime }}");
    expect(inlineChipDisplay({ kind: "ref", raw: "@system/related-todos" })).toBe("@system/related-todos");
  });
});

describe("applyInlineChipsToBody", () => {
  it("chips prose but never enters code, pre or links", () => {
    const root = document.createElement("div");
    root.innerHTML =
      "<p>Badge {{container_badge}} ref @system/permission-mode mail a@b.com</p>" +
      "<pre><code>{{ keep_literal }}</code></pre>" +
      "<p><a href=\"https://x/@at/in-url\">link @text</a></p>";
    const chips = applyInlineChipsToBody(root);
    const chipEls = [...root.querySelectorAll("span.hk-tpl-chip")];
    // Two prose chips only: the token and the ref (email, code, link excluded).
    expect(chips).toBe(2);
    expect(chipEls.map((el) => el.textContent)).toEqual(["{{ container_badge }}", "@system/permission-mode"]);
    expect(chipEls[0]!.hasAttribute("data-ref")).toBe(false);
    expect(chipEls[1]!.hasAttribute("data-ref")).toBe(true);
    // Literal surfaces untouched.
    expect(root.querySelector("code")!.textContent).toBe("{{ keep_literal }}");
    expect(root.querySelector("a")!.textContent).toBe("link @text");
    // Idempotent: a second pass finds nothing new to chip.
    expect(applyInlineChipsToBody(root)).toBe(0);
  });
});

describe("HkMarkdownRenderer inlineChips", () => {
  it("chips tokens and refs when the prop is on", async () => {
    const container = mount({
      content: "Badge: {{container_badge}}\n\nRead @system/related-todos first.",
      inlineChips: true,
    });
    await settleFor(container, ".hk-tpl-chip");
    const chips = [...container.querySelectorAll("span.hk-tpl-chip")];
    expect(chips.map((el) => el.textContent)).toEqual(["{{ container_badge }}", "@system/related-todos"]);
  });

  it("renders no chips by default (existing consumers unchanged)", async () => {
    const container = mount({ content: "Badge: {{container_badge}} ref @system/related-todos" });
    await settleFor(container, ".hk-markdown-body p");
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();
    expect(container.querySelectorAll(".hk-tpl-chip").length).toBe(0);
    expect(container.textContent).toContain("{{container_badge}}");
    expect(container.textContent).toContain("@system/related-todos");
  });
});
