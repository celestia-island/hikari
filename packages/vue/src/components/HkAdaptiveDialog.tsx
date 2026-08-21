/**
 * HkAdaptiveDialog — one dialog contract, two shells.
 *
 * Renders HkModal on desktop viewports and HkDrawer side="bottom" on
 * mobile (switched by `useBreakpoint().isMobile`, i.e. width < 768), so
 * one `v-model` component gives a centered dialog on wide screens and a
 * slide-up sheet on phones. The shell only picks which inner component
 * renders and normalizes props/slots — overlay, teleport, z-index
 * stacking, body scroll lock, focus handling and Escape-to-close all
 * come from the inner components via usePopupManager and are never
 * re-implemented here.
 *
 * Slot mapping:
 *   default -> body of whichever shell renders
 *   header  -> HkModal sub-header (below the title bar); on mobile the
 *              drawer header is composed so the title stays in the title
 *              bar and the slot content rides under it (visual parity
 *              with the modal)
 *   footer  -> footer slot of either shell; wins over footerActions,
 *              matching HkModal's own precedence
 *
 * footerActions pass straight into HkModal's prop on desktop; HkDrawer
 * has no footerActions prop, so on mobile the shell renders the
 * equivalent HButton row inside the drawer's footer slot (same order,
 * variants, loading, disabled and onClick handlers).
 *
 * Caveat: if the viewport crosses the mobile breakpoint while a leave
 * transition is still in flight, the inner Transition unmounts without
 * firing its after-leave hook — the forwarded `afterLeave` emit and
 * HkModal's focus restore are skipped for that close (no resource leak:
 * popup handle and scroll lock are released on unmount). Consumers
 * relying on afterLeave (e.g. focus hand-off) should not depend on it
 * firing during a live shell flip.
 */
import { defineComponent, type PropType } from "vue";

import { useBreakpoint } from "../runtime/useBreakpoint";
import "./HkAdaptiveDialog.scss";
import HButton from "./HkButton";
import HDrawer from "./HkDrawer";
import HModal, { type ModalAction } from "./HkModal";

export default defineComponent({
  name: "HkAdaptiveDialog",
  props: {
    modelValue: { type: Boolean, required: true },
    title: { type: String, default: undefined },
    closable: { type: Boolean, default: true },
    /** Desktop modal width (HkModal `width`). */
    width: { type: String, default: "32rem" },
    /** Mobile drawer height (HkDrawer `size`). HkDrawer's bottom-side CSS
     *  clamps panels at maxHeight 70vh, so the default equals the cap;
     *  pass `panelClass` with a custom max-height for taller sheets. */
    mobileSize: { type: String, default: "70vh" },
    footerActions: {
      type: Array as PropType<ModalAction[]>,
      default: undefined,
    },
    /** Extra classes for the mobile drawer panel — same escape hatch as
     *  HkDrawer.panelClass (attrs fallthrough cannot reach a teleported
     *  panel). Desktop has no equivalent hook on HkModal. */
    panelClass: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_value: boolean) => true,
    afterLeave: () => true,
  },
  setup(props, { emit, slots }) {
    const { isMobile } = useBreakpoint();

    function onUpdate(v: boolean) {
      emit("update:modelValue", v);
    }

    function onAfterLeave() {
      emit("afterLeave");
    }

    /** Drawer footer: the footer slot wins over footerActions (same
     *  precedence HkModal applies); with no slot, the actions render as
     *  the same HButton row the modal would show. Returns undefined when
     *  there is nothing to render so the drawer skips its footer band. */
    function renderDrawerFooter() {
      if (slots.footer) return slots.footer();
      if (props.footerActions && props.footerActions.length > 0) {
        return (
          <div class="hk-adaptive-dialog-footer">
            {props.footerActions.map((action, i) => (
              <HButton
                key={i}
                variant={action.variant ?? "secondary"}
                size="sm"
                loading={action.loading}
                disabled={action.disabled}
                onClick={action.onClick}
              >
                {action.label}
              </HButton>
            ))}
          </div>
        );
      }
      return undefined;
    }

    /** True when the drawer should render a footer band at all. */
    function hasDrawerFooter() {
      return Boolean(slots.footer) || Boolean(props.footerActions && props.footerActions.length > 0);
    }

    /** HkDrawer's header slot replaces the title span, so on mobile the
     *  shell composes title + slot content itself — keeping the title in
     *  the title bar with the slot under it, like the modal sub-header. */
    function renderDrawerHeader() {
      if (!slots.header) return undefined;
      return () => (
        <div class="hk-adaptive-dialog-drawer-header">
          {props.title ? (
            <span class="hk-drawer-title">{props.title}</span>
          ) : null}
          {slots.header!()}
        </div>
      );
    }

    return () => {
      if (isMobile.value) {
        return (
          <HDrawer
            modelValue={props.modelValue}
            onUpdate:modelValue={onUpdate}
            onAfterLeave={onAfterLeave}
            side="bottom"
            size={props.mobileSize}
            title={props.title}
            closable={props.closable}
            panelClass={props.panelClass}
          >
            {{
              default: () => slots.default?.(),
              header: renderDrawerHeader(),
              footer: hasDrawerFooter() ? () => renderDrawerFooter() : undefined,
            }}
          </HDrawer>
        );
      }

      return (
        <HModal
          modelValue={props.modelValue}
          onUpdate:modelValue={onUpdate}
          onAfterLeave={onAfterLeave}
          title={props.title}
          closable={props.closable}
          width={props.width}
          footerActions={props.footerActions}
        >
          {{
            default: () => slots.default?.(),
            header: slots.header ? () => slots.header!() : undefined,
            footer: slots.footer ? () => slots.footer!() : undefined,
          }}
        </HModal>
      );
    };
  },
});
