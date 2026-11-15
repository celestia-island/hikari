import { describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";

// Mock the wasm module at the top level: the composable's lazy import()
// resolves to this factory, exactly like the real module landing after
// the first plaintext render.
vi.mock("../wasm/highlight/hikari_wasm_highlight.js", () => ({
  highlight: (text: string, lang: string) => `<wasm>${lang}:${text}</wasm>`,
}));

import HkDiffViewer from "./HkDiffViewer";
import { useHighlight } from "../composables/useHighlight";

const DIFF = `--- a/rs
+++ b/rs
@@ -10,4 +10,5 @@
 ctx-a
-removed
 ctx-b
+added`;

describe("HkDiffViewer wasm-landing recolor (R2 S1-A)", () => {
  it("memoized plaintext rows recolor once the wasm module lands and bumps the epoch", async () => {
    // Advance the epoch first so this file starts with a clean memo
    // (the Map is module-global and shared across files in a worker).
    useHighlight().version.value += 1;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const Root = defineComponent({
      setup() {
        return () => h(HkDiffViewer, { diff: DIFF, language: "rust" } as never);
      },
    });
    const app = createApp(Root);
    app.mount(container);

    // The composable bumps version itself when the (mocked) module lands;
    // the memo must then drop its plaintext entries and serve wasm html.
    await vi.waitFor(() => {
      const html = container.querySelector(".hk-diff-viewer__code")?.innerHTML ?? "";
      expect(html).toContain("<wasm>rust:");
    });
    app.unmount();
    container.remove();
  });
});
