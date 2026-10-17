import { computed, defineComponent, ref, type PropType } from "vue";
import { MoreHorizontal } from "lucide-vue-next";

import { useI18n } from "../i18n/context";
import HkIconButton from "./HkIconButton";
import HkMenu, { type HkMenuItem } from "./HkMenu";

/**
 * HkRowActions — the house standard for the rightmost ⋯ trigger on a
 * data row (2026-10-18 user direction: call sites stop hand-rolling an
 * HkIconButton + MoreHorizontal in every view).
 *
 * Two modes, one component:
 * - Trigger mode (default): a ghost kebab button that emits `open` with
 *   ITSELF as the opener element — the anchor a row manage window
 *   (chest's useRowManageWindow pattern) restores focus to on close.
 *   The consumer decides what opens; this component only standardizes
 *   the affordance (glyph, size step, aria label, click isolation).
 * - Menu mode (`items`): the same button hosts an HkMenu popup
 *   (desktop popout / mobile sheet via the shared HkSelectPanel
 *   surface) and emits `select(item)`; the menu closes on selection.
 *
 * The click is stopped from reaching ancestors — a trigger inside a
 * clickable cell opens only itself, exactly like HkCopyBadge's tag
 * contract, and HkTable's cell copy layer additionally ignores presses
 * that land on interactive controls.
 */
export default defineComponent({
  name: "HkRowActions",
  props: {
    /** Accessible name / tooltip for the trigger. Defaults to the
     *  localized "Row actions" (hikari::table.rowActions). */
    label: { type: String, default: undefined },
    /** Button size step (HkIconButton's ladder). 28 is the roster step
     *  the row manage pattern standardized on (2026-10-12 ruling). */
    size: {
      type: Number as PropType<16 | 24 | 28 | 32 | 36 | 40>,
      default: 28,
    },
    disabled: { type: Boolean, default: false },
    /** Menu mode: data-driven HkMenu items. Providing items swaps the
     *  click behavior from `open` to hosting the popup. */
    items: { type: Array as PropType<HkMenuItem[]>, default: undefined },
    /** Desktop popout placement (menu mode). Rows sit at the table's
     *  trailing edge, so bottom-end keeps the panel on the screen. */
    placement: {
      type: String as PropType<
        "bottom-start" | "bottom-end" | "top-start" | "top-end" | "right-start" | "left-start"
      >,
      default: "bottom-end",
    },
  },
  emits: {
    /** Trigger mode: the opener element (this button) for focus-restore
     *  anchoring. */
    open: (_opener: HTMLElement) => true,
    /** Menu mode: the chosen item; the popup closes itself first. */
    select: (_item: HkMenuItem) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const open = ref(false);
    const triggerRef = ref<InstanceType<typeof HkIconButton> | null>(null);

    const label = computed(
      () => props.label ?? t("hikari::table.rowActions", "Row actions"),
    );

    /** The trigger's real <button> (HkIconButton renders a single
     *  button root, so the instance's $el is the element). */
    function openerEl(): HTMLElement | null {
      const el = triggerRef.value?.$el as HTMLElement | undefined;
      return el && el.nodeType === 1 ? el : null;
    }

    function onTrigger(e: MouseEvent) {
      // A row-action press never reaches the surrounding cell or row
      // handlers — the trigger owns its click outright.
      e.stopPropagation();
      if (props.disabled) return;
      if (props.items) {
        // A second press on the ⋯ toggles the menu shut — the hand-rolled
        // kebab+menu pairs this component replaces closed on re-click
        // (rowMenu.toggle), and that habit carries over. The anchor hit
        // containment in HkSelectPanel would otherwise swallow the press.
        open.value = !open.value;
        return;
      }
      emit("open", openerEl() ?? (e.currentTarget as HTMLElement));
    }

    function onSelect(key: string, item: HkMenuItem) {
      // HkMenu's select emit is (key, item) — the key FIRST, matching the
      // HkMenu contract; the consumer-facing select carries the item.
      // The popup is already closed by HkMenu's leaf path (closeAll runs
      // before the emit), so `open` only needs to follow on paper.
      open.value = false;
      emit("select", item);
    }

    return () => (
      <>
        <HkIconButton
          ref={triggerRef}
          variant="ghost"
          size={props.size}
          disabled={props.disabled}
          aria-label={label.value}
          aria-haspopup={props.items ? "menu" : undefined}
          aria-expanded={props.items ? open.value : undefined}
          onClick={onTrigger}
        >
          <MoreHorizontal size={props.size >= 32 ? 16 : 14} />
        </HkIconButton>
        {props.items && (
          <HkMenu
            variant="popup"
            items={props.items}
            open={open.value}
            anchorRef={openerEl()}
            placement={props.placement}
            title={label.value}
            onUpdate:open={(v: boolean) => {
              open.value = v;
            }}
            onSelect={onSelect}
          />
        )}
      </>
    );
  },
});
