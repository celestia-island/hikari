import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkTemplateText from "./HkTemplateText";
import { parseTemplate, serializeTemplate } from "./templateGrammar";

/**
 * HkTemplateText contract tests:
 * - chips render for tokens with the canonical display spelling, raw
 *   text stays as runs — the accessible text content equals the exact
 *   template (a renderer must not rewrite the value it renders)
 * - vocabulary membership drives data-unknown (and only that); a
 *   description becomes the chip title
 * - multiline only swaps the wrapper attribute
 *
 * House style: raw createApp mounts torn down after each case.
 */

const mounts: { app: ReturnType<typeof createApp>; container: HTMLElement }[] = [];

function mount(props: Record<string, unknown>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkTemplateText, props as never) });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts) {
    app.unmount();
    container.remove();
  }
  mounts.length = 0;
});

const VOCAB = [
  { name: "md5_email", description: "MD5 of the account email" },
  { name: "username", description: "The account name" },
];

describe("HkTemplateText", () => {
  it("chips tokens and keeps literal text", () => {
    const el = mount({ content: "https://g.com/{{username}}.png", tokens: VOCAB });
    const chips = el.querySelectorAll(".hk-tpl-chip");
    expect(chips).toHaveLength(1);
    expect(chips[0]!.textContent).toBe("{{ username }}");
    expect(chips[0]!.hasAttribute("data-unknown")).toBe(false);
    expect(chips[0]!.getAttribute("title")).toBe("The account name");
    expect(el.textContent).toContain("https://g.com/");
    expect(el.textContent).toContain(".png");
  });

  it("chip display normalizes the spelling; text runs stay byte-exact", () => {
    const raw = "a {{  md5_email  }} b";
    const el = mount({ content: raw, tokens: VOCAB });
    // Chips spell the canonical form; the exact stored value is what
    // round-trips through the shared grammar, not what the chip shows.
    expect(el.querySelector(".hk-tpl-chip")!.textContent).toBe("{{ md5_email }}");
    expect(el.querySelector(".hk-template-text-run")!.textContent).toBe("a ");
    expect(serializeTemplate(parseTemplate(raw))).toBe(raw);
  });

  it("marks off-vocabulary tokens unknown instead of hiding them", () => {
    const el = mount({ content: "{{ nope }}{{ username }}", tokens: VOCAB });
    const chips = el.querySelectorAll(".hk-tpl-chip");
    expect(chips).toHaveLength(2);
    expect(chips[0]!.hasAttribute("data-unknown")).toBe(true);
    expect(chips[1]!.hasAttribute("data-unknown")).toBe(false);
  });

  it("multiline only flips the wrapper attribute", () => {
    const el = mount({ content: "{{ username }}", tokens: VOCAB, multiline: true });
    expect(el.querySelector(".hk-template-text")!.hasAttribute("data-multiline")).toBe(true);
  });
});
