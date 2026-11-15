import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, ref } from "vue";

// NO static `import { marked }` here: the delayed factory below must apply
// to the COMPONENT's lazy dynamic import, not to this file's load.
vi.mock("marked", async (importOriginal) => {
  await new Promise((r) => setTimeout(r, 150));
  return importOriginal<typeof import("marked")>();
});

describe("HkMarkdownRenderer stale-parse overlap (R2 S1-B)", () => {
  it("a parse left behind by a newer body never overwrites it", async () => {
    vi.resetModules();
    const { default: Renderer } = await import("./HkMarkdownRenderer");

    const holder = ref("A-markdown-body");
    const plain = ref(false);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(Renderer, { content: holder.value, plain: plain.value }),
    });
    app.mount(container);

    // The A parse is in flight, hung on the delayed marked import; flip to
    // plain with a new body — renderPlain is synchronous, so B lands at
    // once. When the import resolves, A's parse is stale and must NOT own
    // the body (the parseToken guard is what rejects it).
    await new Promise((r) => setTimeout(r, 30));
    plain.value = true;
    holder.value = "B-plain-body";
    await new Promise((r) => setTimeout(r, 350));

    const text = container.textContent ?? "";
    expect(text).toContain("B-plain-body");
    expect(text).not.toContain("A-markdown-body");
    app.unmount();
    container.remove();
  }, 15000);
});
