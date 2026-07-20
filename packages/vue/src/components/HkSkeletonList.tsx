import { defineComponent, type PropType } from "vue";
import HkSkeleton from "./HkSkeleton";
import type { SkeletonTone } from "./HkSkeleton";
import "./HkSkeleton.scss";

export default defineComponent({
  name: "HkSkeletonList",
  props: {
    count: { type: Number, default: 3 },
    itemHeight: { type: String, default: "40px" },
    gap: { type: String, default: "8px" },
    tone: { type: String as PropType<SkeletonTone>, default: "primary" },
  },
  setup(props) {
    const items = Array.from({ length: props.count }, (_, i) => i);

    return () => (
      <div
        class="hk-skeleton-list"
        style={{ gap: props.gap }}
        aria-hidden="true"
      >
        {items.map((i) => (
          <HkSkeleton
            key={i}
            width="100%"
            height={props.itemHeight}
            tone={props.tone}
            radius={`var(--hk-radius-sm, 4px)`}
          />
        ))}
      </div>
    );
  },
});
