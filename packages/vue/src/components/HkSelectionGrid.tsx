import { defineComponent, type PropType } from "vue";
import { Check } from "lucide-vue-next";
import "./HkSelectionGrid.scss";

export interface SelectionGridItem {
  id: string;
  title: string;
  description?: string;
  badge?: string;
  badgeVariant?: string;
  icon?: ReturnType<typeof defineComponent>;
}

export type SelectionGridCols = 2 | 3 | 4;

export default defineComponent({
  name: "HkSelectionGrid",
  props: {
    items: { type: Array as PropType<SelectionGridItem[]>, required: true },
    selectedId: { type: String, default: undefined },
    columns: { type: Number as PropType<SelectionGridCols>, default: 2 },
    groupTitle: { type: String, default: undefined },
    dense: { type: Boolean, default: false },
  },
  emits: {
    select: (_item: SelectionGridItem) => true,
  },
  setup(props, { emit }) {
    return () => {
      if (!props.items.length) return null;

      return (
        <div class="hk-selection-grid">
          {props.groupTitle && (
            <h4 class="hk-selection-grid-title">{props.groupTitle}</h4>
          )}
          <div
            class="hk-selection-grid-grid"
            data-cols={props.columns}
            data-dense={props.dense || undefined}
          >
            {props.items.map((item) => {
              const isSelected = props.selectedId === item.id;
              const ItemIcon = item.icon;

              return (
                <div
                  key={item.id}
                  role="button"
                  tabindex={0}
                  class="hk-selection-grid-item"
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
                  <div class="hk-selection-grid-check">
                    {isSelected && <Check size={14} />}
                  </div>
                  <div class="hk-selection-grid-content">
                    <div class="hk-selection-grid-header">
                      {ItemIcon && (
                        <ItemIcon
                          size={16}
                          class="hk-selection-grid-icon"
                        />
                      )}
                      <span class="hk-selection-grid-name">
                        {item.title}
                      </span>
                      {item.badge && (
                        <span
                          class="hk-selection-grid-badge"
                          data-variant={item.badgeVariant || undefined}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p class="hk-selection-grid-desc">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };
  },
});
