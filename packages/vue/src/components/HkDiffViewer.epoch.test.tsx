import { describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";

// Mock the host client's async door at the top level: the composable now loads
// the component through `loadComponent`, so that is where "the wasm module
// lands" happens. The returned surface mimics the real call shape, and its
// `html` is the real ABI record — `HighlightResult = { html?: string }`, NOT a
// bare string (packages/vue/src/wasm/highlight/hikari_wasm_highlight.d.ts). A
// string-returning mock hid the seam that fed the record to `v-html`; the
// adapter test pins that separately.
//
// Mocking the module this test used to mock (`../wasm/highlight/...`) no longer
// works: the composable imports it from `src/composables/`, which resolves to a
// different module id, so the real component loaded and the assertion never
// saw `<wasm>` (measured).
vi.mock("@celestia-island/tairitsu-host-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@celestia-island/tairitsu-host-client")>();
  return {
    ...actual,
    loadComponent: async () =>
      ({
        exports: {},
        call: (_name: string, text: string, lang: string) => ({
          html: `<wasm>${lang}:${text}</wasm>`,
        }),
        stop: async () => {},
        whenIdle: async () => {},
        stopped: false,
      }) as unknown as Awaited<ReturnType<typeof actual.loadComponent>>,
  };
});

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
