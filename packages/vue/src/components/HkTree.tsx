import { defineComponent, ref, watch, h, type Component, type PropType, type VNodeChild } from "vue";

import "./HkTree.scss";

export type TreeSize = "xs" | "sm" | "md";

export interface TreeNode {
  id: string;
  label: string;
  icon?: Component;
  iconClass?: string;
  status?: string;
  tag?: boolean;
  tagLabel?: string;
  children?: TreeNode[];
  data?: unknown;
}

export interface TreeRowScope {
  node: TreeNode;
  depth: number;
  indent: number;
}

type RowRenderer = (scope: TreeRowScope) => VNodeChild;

export default defineComponent({
  name: "HkTree",
  props: {
    nodes: { type: Array as PropType<TreeNode[]>, default: () => [] },
    size: { type: String as PropType<TreeSize>, default: "sm" },
    defaultExpandAll: { type: Boolean, default: false },
    indent: { type: Number, default: 16 },
    expandOnClick: { type: Boolean, default: false },
  },
  emits: {
    select: (_node: TreeNode) => true,
    toggle: (_node: TreeNode) => true,
  },
  setup(props, { slots, emit }) {
    const expanded = ref<Set<string>>(new Set());

    function ensureExpanded() {
      if (expanded.value.size > 0) return;
      if (!props.defaultExpandAll) return;
      const ids = new Set<string>();
      function walk(list: TreeNode[]) {
        for (const n of list) {
          if (n.children?.length) {
            ids.add(n.id);
            walk(n.children);
          }
        }
      }
      walk(props.nodes);
      expanded.value = ids;
    }

    watch(
      () => props.nodes,
      () => { if (props.defaultExpandAll) ensureExpanded(); },
      { immediate: true },
    );

    function findNode(id: string): TreeNode | undefined {
      let found: TreeNode | undefined;
      function walk(list: TreeNode[]) {
        for (const n of list) {
          if (n.id === id) { found = n; return; }
          if (n.children?.length) walk(n.children);
          if (found) return;
        }
      }
      walk(props.nodes);
      return found;
    }

    function toggle(id: string) {
      const next = new Set(expanded.value);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      expanded.value = next;
      const node = findNode(id);
      if (node) emit("toggle", node);
    }

    const renderRow: RowRenderer | undefined = slots.row
      ? (scope) => slots.row!(scope)
      : undefined;

    return () => (
      <div class="hk-tree" data-size={props.size}>
        {props.nodes.map((node) => (
          <TreeNodeRow
            key={node.id}
            node={node}
            depth={0}
            indent={props.indent}
            expanded={expanded.value}
            expandOnClick={props.expandOnClick}
            renderRow={renderRow}
            onToggle={toggle}
            onSelect={(n) => emit("select", n)}
          />
        ))}
      </div>
    );
  },
});

interface TreeNodeRowProps {
  node: TreeNode;
  depth: number;
  indent: number;
  expanded: Set<string>;
  expandOnClick: boolean;
  renderRow?: RowRenderer;
  onToggle: (id: string) => void;
  onSelect: (node: TreeNode) => void;
}

const TreeNodeRow = ({
  node,
  depth,
  indent,
  expanded,
  expandOnClick,
  renderRow,
  onToggle,
  onSelect,
}: TreeNodeRowProps) => {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isExpanded = hasChildren && expanded.has(node.id);
  const IconComp = node.icon;

  const guideLeft = depth * indent + 16;

  function handleRowClick() {
    onSelect(node);
    if (expandOnClick && hasChildren) onToggle(node.id);
  }

  return (
    <div class="hk-tree-node">
      <div
        class="hk-tree-row"
        data-status={node.status || undefined}
        onClick={handleRowClick}
      >
        {depth > 0 && (
          <span class="hk-tree-indent" style={{ width: `${depth * indent}px` }} />
        )}

        <span
          class="hk-tree-toggle"
          data-parent={hasChildren || undefined}
          data-open={isExpanded || undefined}
          onClick={(e: MouseEvent) => { e.stopPropagation(); if (hasChildren) onToggle(node.id); }}
        >
          {hasChildren ? (
            <svg viewBox="0 0 16 16" width="12" height="12" class="hk-tree-chevron" data-open={isExpanded || undefined}>
              <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          ) : (
            <span class="hk-tree-leaf" />
          )}
        </span>

        {renderRow
          ? renderRow({ node, depth, indent })
          : (
            <>
              {IconComp ? (
                <span class={["hk-tree-icon", node.iconClass ?? ""]}>
                  {h(IconComp as Component, { size: 13 })}
                </span>
              ) : null}

              <span class="hk-tree-label">
                {node.tagLabel
                  ? [renderTagLabel(node.tagLabel), " ", renderLabel(node.label)]
                  : node.tag
                    ? renderTagLabel(node.label)
                    : renderLabel(node.label)}
              </span>
            </>
          )}
      </div>

      {hasChildren && isExpanded && (
        <div class="hk-tree-children" style={{ "--guide-left": `${guideLeft}px` } as Record<string, string>}>
          {node.children?.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              indent={indent}
              expanded={expanded}
              expandOnClick={expandOnClick}
              renderRow={renderRow}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function renderLabel(label: string) {
  return label;
}

function renderTagLabel(label: string) {
  return <span class="hk-tree-label-tag">{label}</span>;
}
