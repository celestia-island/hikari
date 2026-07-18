import { defineComponent, type PropType } from "vue";
import "../../../components/src/styles/components/tree.scss";

interface TreeNode {
  key: string | number;
  label: string;
  icon?: string;
  disabled?: boolean;
  children?: TreeNode[];
}

export default defineComponent({
  name: "HkTree",
  props: {
    nodes: { type: Array as PropType<TreeNode[]>, required: true },
    expandable: { type: Boolean, default: true },
    selectable: { type: Boolean, default: false },
    selectedKeys: { type: Array as PropType<(string | number)[]>, default: () => [] },
    size: { type: String as PropType<"compact" | "default" | "spacious">, default: "default" },
  },
  emits: {
    select: (_node: TreeNode) => true,
    expand: (_node: TreeNode) => true,
    "update:selectedKeys": (_keys: (string | number)[]) => true,
  },
  setup(props, { emit }) {
    const expandedKeys = new Map<string | number, { value: boolean }>();
    const expandedKeySet = new Map<string | number, boolean>();

    function initKeys() {
      props.nodes.forEach((n) => traverseKeys(n));
    }

    function traverseKeys(node: TreeNode) {
      if (!expandedKeySet.has(node.key)) {
        expandedKeySet.set(node.key, false);
      }
      node.children?.forEach(traverseKeys);
    }

    initKeys();

    function isExpanded(key: string | number) {
      return expandedKeySet.get(key) ?? false;
    }

    function isSelected(key: string | number) {
      return props.selectedKeys?.includes(key) ?? false;
    }

    function toggleExpand(node: TreeNode) {
      if (!node.children || node.children.length === 0) return;
      expandedKeySet.set(node.key, !isExpanded(node.key));
      emit("expand", node);
      expandedKeys.set(node.key, { value: isExpanded(node.key) });
    }

    function onSelect(node: TreeNode) {
      emit("select", node);
      const newKeys = [...(props.selectedKeys ?? [])];
      const idx = newKeys.indexOf(node.key);
      if (idx >= 0) newKeys.splice(idx, 1);
      else newKeys.push(node.key);
      emit("update:selectedKeys", newKeys);
    }

    function renderNode(node: TreeNode): JSX.Element {
      const expanded = isExpanded(node.key);
      const selected = isSelected(node.key);
      const hasChildren = node.children && node.children.length > 0;

      return (
        <li class={["hi-tree-node", expanded ? "hi-tree-node-expanded" : "", node.disabled ? "hi-tree-node-disabled" : ""]}>
          <div
            class={["hi-tree-node-content", selected ? "hi-tree-node-selected" : ""]}
            onClick={() => (props.selectable ? onSelect(node) : toggleExpand(node))}
          >
            {props.expandable !== false && (
              <span
                class="hi-tree-node-expand-icon"
                style={{ visibility: hasChildren ? "visible" : "hidden" }}
                onClick={(e: MouseEvent) => { e.stopPropagation(); toggleExpand(node); }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            )}
            {node.icon && (
              <span class="hi-tree-node-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              </span>
            )}
            <span class="hi-tree-node-label">{node.label}</span>
          </div>
          {hasChildren && expanded && (
            <ul class="hi-tree-node-children">
              {node.children!.map((child) => renderNode(child))}
            </ul>
          )}
        </li>
      );
    }

    return () => (
      <div class={["hi-tree", `hi-tree-${props.size}`]}>
        <ul class="hi-tree-list hi-tree-root">
          {props.nodes.map((node) => renderNode(node))}
        </ul>
      </div>
    );
  },
});
