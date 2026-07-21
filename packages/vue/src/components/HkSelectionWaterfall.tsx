import { defineComponent, type PropType } from "vue";
import { Check } from "lucide-vue-next";
import "./HkSelectionWaterfall.scss";

export interface WaterfallItem {
  id: string;
  title: string;
  description?: string;
  tag?: string;
  tagVariant?: string;
  image?: string;
}

export default defineComponent({
  name: "HkSelectionWaterfall",
  props: {
    items: { type: Array as PropType<WaterfallItem[]>, required: true },
    selectedIds: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
    multi: { type: Boolean, default: false },
    groupTitle: { type: String, default: undefined },
    minColWidth: { type: Number, default: 140 },
  },
  emits: {
    select: (_item: WaterfallItem) => true,
  },
  setup(props, { emit }) {
    return () => {
      if (!props.items.length) return null;

      return (
        <div class="hk-selection-waterfall">
          {props.groupTitle && (
            <h4 class="hk-selection-waterfall-title">{props.groupTitle}</h4>
          )}
          <div class="hk-selection-waterfall-flow">
            {props.items.map((item) => {
              const isSelected = props.multi
                ? props.selectedIds.includes(item.id)
                : props.selectedIds.length === 1 &&
                  props.selectedIds[0] === item.id;

              return (
                <div
                  key={item.id}
                  role="button"
                  tabindex={0}
                  class="hk-selection-waterfall-item"
                  data-selected={isSelected || undefined}
                  aria-selected={isSelected}
                  onClick={() => emit("select", item)}
                  onKeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      emit("select", item);
                    }
                  }}
                >
                  {isSelected && (
                    <span class="hk-selection-waterfall-check">
                      <Check size={10} />
                    </span>
                  )}
                  <span class="hk-selection-waterfall-name">
                    {item.title}
                  </span>
                  {item.tag && (
                    <span
                      class="hk-selection-waterfall-tag"
                      data-variant={item.tagVariant || undefined}
                    >
                      {item.tag}
                    </span>
                  )}
                  {item.description && (
                    <span class="hk-selection-waterfall-desc">
                      {item.description}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    };
  },
});
