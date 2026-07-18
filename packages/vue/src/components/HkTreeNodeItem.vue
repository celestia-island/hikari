<script setup lang="ts">
interface TreeNode {
  key: string | number;
  label: string;
  icon?: string;
  disabled?: boolean;
  children?: TreeNode[];
}

defineProps<{
  node: TreeNode;
  expanded: boolean;
  selected: boolean;
  expandable?: boolean;
  selectable?: boolean;
  size?: "compact" | "default" | "spacious";
}>();

defineEmits<{
  toggle: [node: TreeNode];
  select: [node: TreeNode];
}>();
</script>

<template>
  <li class="hi-tree-node" :class="{ 'hi-tree-node-expanded': expanded, 'hi-tree-node-disabled': node.disabled }">
    <div
      class="hi-tree-node-content"
      :class="{ 'hi-tree-node-selected': selected }"
      @click="selectable ? $emit('select', node) : $emit('toggle', node)"
    >
      <span
        v-if="expandable !== false && node.children && node.children.length > 0"
        class="hi-tree-node-expand-icon"
        @click.stop="$emit('toggle', node)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </span>
      <span v-else-if="expandable !== false && (!node.children || node.children.length === 0)" class="hi-tree-node-expand-icon" style="visibility: hidden;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </span>
      <span v-if="node.icon" class="hi-tree-node-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      </span>
      <span class="hi-tree-node-label">{{ node.label }}</span>
    </div>
    <ul v-if="node.children && expanded" class="hi-tree-node-children">
      <HkTreeNodeItem
        v-for="child in node.children"
        :key="child.key"
        :node="child"
        :expanded="false"
        :selected="false"
        :expandable="expandable"
        :selectable="selectable"
        :size="size"
        @toggle="$emit('toggle', $event)"
        @select="$emit('select', $event)"
      />
    </ul>
  </li>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/tree.scss";

.hi-tree-node-children {
  list-style: none;
  margin: 0;
  padding: 0 0 0 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}
</style>
