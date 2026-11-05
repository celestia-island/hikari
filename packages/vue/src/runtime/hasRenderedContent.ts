import { Comment, Fragment, type VNode } from "vue";

/**
 * Whether a slot actually rendered any content. Testing the slot
 * function (or its return) for truthiness is not enough, three shapes
 * all read as "rendered" while carrying nothing:
 *
 *  - a consumer's `v-if` slot renders a comment placeholder vnode;
 *  - a consumer's `<>{cond && …}</>` compiles to a Fragment vnode whose
 *    children are those same dead comments (or `false` entries);
 *  - a `v-for` over an empty array renders an empty children array.
 *
 * All three must read as EMPTY so empty-state lanes collapse instead of
 * rendering an invisible row (HkCardList's empty-state and
 * HkModelCard's caption/footer share this guard — one implementation,
 * the house "same family, one path" rule).
 */
export function hasRenderedContent(nodes: unknown): boolean {
  if (nodes == null || nodes === false || nodes === "") return false;
  if (Array.isArray(nodes)) return nodes.some((n) => hasRenderedContent(n));
  if (typeof nodes === "object") {
    const node = nodes as VNode;
    if (node.type === Fragment) return hasRenderedContent(node.children);
    return node.type !== Comment;
  }
  return true; // non-empty text content
}
