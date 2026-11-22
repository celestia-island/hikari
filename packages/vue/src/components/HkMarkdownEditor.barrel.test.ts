import { describe, expect, it } from "vitest";

import {
  HkMarkdownEditor,
  applyLinePrefix,
  applyWrap,
  type HkMarkdownEditorMode,
  type MarkdownTextEdit,
} from "../index";

/**
 * Public barrel guard for HkMarkdownEditor (R3 review: deleting the
 * component's export block from src/index.ts kept the entire suite green
 * — every other test reaches the module through the direct
 * "./HkMarkdownEditor" path, so only an external consumer would have
 * noticed). Same shape as HkRangeRibbon.barrel.test.ts.
 */
describe("the public barrel", () => {
  it("re-exports the editor component under its public name", () => {
    expect(HkMarkdownEditor, "HkMarkdownEditor must be re-exported").toBeTruthy();
    expect(HkMarkdownEditor.name).toBe("HkMarkdownEditor");
  });

  it("re-exports the pure toolbar helpers hosts share", () => {
    expect(typeof applyWrap, "applyWrap must be re-exported").toBe("function");
    expect(typeof applyLinePrefix, "applyLinePrefix must be re-exported").toBe("function");
    expect(applyWrap("ab", 0, 2, "**").text).toBe("**ab**");
    expect(applyLinePrefix("x", 0, 1, "- ").text).toBe("- x");
  });

  it("re-exports the editor's public types", () => {
    // Type-only exports vanish at runtime, so each one is CONSUMED here: a
    // dropped `type …` line fails vue-tsc on this file instead of leaving
    // the runtime suite green.
    const mode: HkMarkdownEditorMode = "plain";
    const edit: MarkdownTextEdit = applyWrap("hi", 0, 0, "`");
    expect(edit.text).toBe("``hi");
    expect(edit.selectionStart).toBe(1);
    expect(edit.selectionEnd).toBe(1);
    expect(mode).toBe("plain");
  });
});
