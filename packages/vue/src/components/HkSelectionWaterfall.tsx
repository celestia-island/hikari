import { defineComponent, type PropType } from "vue";
import { Check } from "lucide-vue-next";
import HkListTransition from "./HkListTransition";
import "./HkSelectionWaterfall.scss";

/** HkSelectionWaterfall — the selectable chip waterfall (a group of
 *  pickable tiles with the leading check). Its items are a KEYED list on
 *  the library's base list container (HkListTransition, 2026-11-27 user
 *  direction: every list-shaped surface runs its add / remove / reorder
 *  through that one primitive): a tile added, removed or re-ranked GLIDES
 *  into place with the family's default choreography (move 0.3s, enter /
 *  leave 0.15s, concurrent) instead of snapping — the same motion the
 *  affix picker's rows, the tag editor's catalog and the report
 *  waterfall share. */

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
          <HkListTransition
            tag="div"
            class="hk-selection-waterfall-flow"
            variant="fade"
            move
          >
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
          </HkListTransition>
        </div>
      );
    };
  },
});
