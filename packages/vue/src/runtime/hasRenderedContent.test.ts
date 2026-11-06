import { createCommentVNode, createVNode, defineComponent, Fragment, h } from "vue";
import { describe, expect, it } from "vitest";

import { hasRenderedContent } from "./hasRenderedContent";

/** The slot-empty guard's decision table, pinned against the exact
 *  vnode shapes the JSX/template compilers emit (raw createVNode, no
 *  mounting needed — the guard is a pure function). */
describe("hasRenderedContent", () => {
  it("reads plain emptiness as empty", () => {
    expect(hasRenderedContent(null)).toBe(false);
    expect(hasRenderedContent(undefined)).toBe(false);
    expect(hasRenderedContent(false)).toBe(false);
    expect(hasRenderedContent("")).toBe(false);
    expect(hasRenderedContent([])).toBe(false);
  });

  it("reads plain content as content", () => {
    expect(hasRenderedContent("x")).toBe(true);
    expect(hasRenderedContent(createVNode("span", null, "x"))).toBe(true);
    expect(hasRenderedContent([createVNode("span")])).toBe(true);
  });

  it("reads a comment placeholder (template v-if) as empty", () => {
    expect(hasRenderedContent(createCommentVNode("v-if"))).toBe(false);
    expect(hasRenderedContent([createCommentVNode("v-if")])).toBe(false);
  });

  it("recurses into fragments carrying only dead comments (JSX <>{cond && …}</>)", () => {
    const dead = createVNode(
      Fragment,
      null,
      [false, createCommentVNode("v-if")] as never,
    );
    expect(hasRenderedContent(dead)).toBe(false);
    // Nested fragments too.
    expect(hasRenderedContent(createVNode(Fragment, null, [dead] as never))).toBe(false);
  });

  it("keeps a fragment with live content", () => {
    const live = createVNode(Fragment, null, [createVNode("span", null, "x")] as never);
    expect(hasRenderedContent(live)).toBe(true);
    // Mixed: one dead comment + one live node.
    expect(
      hasRenderedContent(createVNode(Fragment, null, [createCommentVNode("v-if"), live] as never)),
    ).toBe(true);
  });

  it("stays usable from a component's slot render (the HkCardList idiom)", () => {
    const Row = defineComponent({
      name: "Row",
      render: () => h("div", "r"),
    });
    const empty = () => null;
    expect(hasRenderedContent([h(Row)])).toBe(true);
    expect(hasRenderedContent(empty())).toBe(false);
  });
});
