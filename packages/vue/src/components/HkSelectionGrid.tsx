import { Check } from "lucide-vue-next";
import { defineComponent, type PropType } from "vue";

import "./HkSelectionGrid.scss";

/**
 * One trailing icon button on an item (e.g. a row's remove / dismiss
 * affordance). Actions never select the item: their clicks stop the
 * propagation the item's own handler rides on.
 */
export interface SelectionGridAction {
  id: string;
  /** Lucide component rendered inside the button. */
  icon?: ReturnType<typeof defineComponent>;
  /** Accessible name — becomes the button's `title` (the house tooltip
   *  bridge upgrades it) and its aria-label. */
  label: string;
  disabled?: boolean;
}

export interface SelectionGridItem {
  id: string;
  title: string;
  description?: string;
  badge?: string;
  badgeVariant?: string;
  icon?: ReturnType<typeof defineComponent>;
  /** Trailing icon buttons (right edge), rendered before the check cell. */
  actions?: SelectionGridAction[];
}

export type SelectionGridCols = 2 | 3 | 4;

export default defineComponent({
  name: "HkSelectionGrid",
  props: {
    items: { type: Array as PropType<SelectionGridItem[]>, required: true },
    selectedId: { type: String, default: undefined },
    selectedIds: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
    multi: { type: Boolean, default: false },
    columns: { type: Number as PropType<SelectionGridCols>, default: 2 },
    /** Adaptive floor mode: when set (px), the column count is DERIVED from
     *  the available width instead of the fixed `columns` number — every
     *  track is at least this wide, so a wide host (e.g. an 896px modal)
     *  lays three 240px options per row while narrow hosts step down to
     *  two, then one, without a horizontal overflow at any width. Takes
     *  precedence over `columns` (which stays the contract for hosts that
     *  want an exact count). Values that cannot form a floor (non-finite
     *  or ≤ 0) are ignored and fall back to fixed `columns`. */
    minItemWidth: { type: Number, default: undefined },
    groupTitle: { type: String, default: undefined },
    hint: { type: String, default: undefined },
    dense: { type: Boolean, default: false },
    /** `list` lays the same options as full-width rows in one column (a
     *  picker list rather than a card grid): the check cell centers on the
     *  row's trailing edge instead of parking at the top corner. */
    layout: { type: String as PropType<"grid" | "list">, default: "grid" },
    /** Optional emphasis for the selected item: a thickened primary edge
     *  bar on the item's leading side (drawn inside the border box, so the
     *  geometry never shifts). */
    selectedEdge: { type: Boolean, default: false },
  },
  emits: {
    select: (_item: SelectionGridItem) => true,
    action: (_item: SelectionGridItem, _action: SelectionGridAction) => true,
  },
  setup(props, { emit }) {
    return () => {
      if (!props.items.length) return null;

      // A floor must be a usable track minimum: non-finite or non-positive
      // values fall back to the fixed `columns` contract instead of
      // producing a degenerate (0px → dozens of tracks) or invalid grid.
      const fluid =
        props.minItemWidth != null &&
        Number.isFinite(props.minItemWidth) &&
        props.minItemWidth > 0;

      return (
        <div
          class="hk-selection-grid"
          data-layout={props.layout}
          data-edge={props.selectedEdge || undefined}
        >
          {props.groupTitle && (
            <h4 class="hk-selection-grid-title">{props.groupTitle}</h4>
          )}
          <div
            class="hk-selection-grid-grid"
            // Fluid mode owns the track template (auto-fill with the floor),
            // so the data-cols hooks — and their narrow-viewport overrides —
            // stay out of its way entirely.
            data-cols={fluid ? undefined : props.columns}
            data-fluid={fluid || undefined}
            data-dense={props.dense || undefined}
            style={fluid
              ? ({ "--hk-selection-grid-item-min": `${props.minItemWidth}px` })
              : undefined}
          >
            {props.items.map((item) => {
              const isSelected = props.multi
                ? props.selectedIds.includes(item.id)
                : props.selectedId === item.id;
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
                  {item.actions?.length ? (
                    <div class="hk-selection-grid-actions">
                      {item.actions.map((action) => {
                        const ActionIcon = action.icon;
                        return (
                          <button
                            key={action.id}
                            type="button"
                            class="hk-selection-grid-action"
                            title={action.label}
                            aria-label={action.label}
                            disabled={action.disabled || undefined}
                            onClick={(e: MouseEvent) => {
                              // An action is not a selection: without this
                              // the row's own handler fires too.
                              e.stopPropagation();
                              if (!action.disabled) emit("action", item, action);
                            }}
                          >
                            {ActionIcon && <ActionIcon size={14} />}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {props.hint && (
            <p class="hk-selection-grid-hint">{props.hint}</p>
          )}
        </div>
      );
    };
  },
});
