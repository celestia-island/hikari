import { Comment, defineComponent, type PropType, type SlotsType, type VNode } from "vue";

import "./HkPersistentToastGroup.scss";

/**
 * HkPersistentToastGroup — a chrome-bar row of HkPersistentToast chips
 * with a "+N" overflow: renders the first `maxVisible` children and
 * collapses the rest into a passive counter. The wowsp title bar's
 * loading chip ("newest label + +N") is the reference consumer.
 *
 * ```tsx
 * <HPersistentToastGroup maxVisible={1}>
 *   {tasks.map((t) => (
 *     <HPersistentToast key={t.id} tone="loading" label={t.label} />
 *   ))}
 * </HPersistentToastGroup>
 * ```
 *
 * Hidden children are UNMOUNTED, not merely hidden — their hover cards
 * and timers are their own state and die with the vnode; a chip that
 * re-enters the visible window starts fresh (a persistent toast has no
 * meaningful state to preserve across an overflow eviction).
 */
export default defineComponent({
  name: "HkPersistentToastGroup",
  props: {
    maxVisible: { type: Number as PropType<number>, default: 3 },
  },
  slots: Object as SlotsType<{
    default?: () => unknown;
  }>,
  setup(props, { slots }) {
    return () => {
      const children = ((slots.default?.() ?? []) as VNode[]).filter((v) => v.type !== Comment);
      const visible = children.slice(0, Math.max(0, props.maxVisible));
      const extra = children.length - visible.length;
      return (
        <span class="hk-persistent-toast-group">
          {visible}
          {extra > 0 && <span class="hk-persistent-toast-group__extra">+{extra}</span>}
        </span>
      );
    };
  },
});
