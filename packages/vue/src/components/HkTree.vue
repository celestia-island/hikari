<script setup lang="ts">
import { ref } from "vue";
import HkTreeNodeItem from "./HkTreeNodeItem.vue";

interface TreeNode {
  key: string | number;
  label: string;
  icon?: string;
  disabled?: boolean;
  children?: TreeNode[];
}

const props = withDefaults(
  defineProps<{
    nodes: TreeNode[];
    expandable?: boolean;
    selectable?: boolean;
    selectedKeys?: (string | number)[];
    size?: "compact" | "default" | "spacious";
  }>(),
  { size: "default" },
);

const emit = defineEmits<{
  select: [node: TreeNode];
  expand: [node: TreeNode];
  "update:selectedKeys": [keys: (string | number)[]];
}>();

const expandedKeys = ref<Set<string | number>>(new Set());

function toggleExpand(node: TreeNode) {
  if (!node.children || node.children.length === 0) return;
  if (expandedKeys.value.has(node.key)) {
    expandedKeys.value.delete(node.key);
  } else {
    expandedKeys.value.add(node.key);
  }
  expandedKeys.value = new Set(expandedKeys.value);
  emit("expand", node);
}

function isExpanded(node: TreeNode) {
  return expandedKeys.value.has(node.key);
}

function isSelected(node: TreeNode) {
  return props.selectedKeys?.includes(node.key) ?? false;
}

function onSelect(node: TreeNode) {
  emit("select", node);
  const newKeys = [...(props.selectedKeys ?? [])];
  const idx = newKeys.indexOf(node.key);
  if (idx >= 0) newKeys.splice(idx, 1);
  else newKeys.push(node.key);
  emit("update:selectedKeys", newKeys);
}
</script>

<template>
  <div class="hi-tree" :class="[`hi-tree-${size}`]">
    <ul class="hi-tree-list hi-tree-root">
      <HkTreeNodeItem
        v-for="node in nodes"
        :key="node.key"
        :node="node"
        :expanded="isExpanded(node)"
        :selected="isSelected(node)"
        :expandable="expandable"
        :selectable="selectable"
        :size="size"
        @toggle="toggleExpand"
        @select="onSelect"
      />
    </ul>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/tree.scss";
</style>
