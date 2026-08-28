/**
 * HkBlockingToast — renderer/host for the blocking-toast gate
 * (`useBlockingToast` / `showBlockingToast`).
 *
 * Toast-shaped but flow-blocking consent prompts: a compact floating
 * card in the toast stack area (not a centered modal, no scroll lock)
 * with explicit Confirm/Cancel buttons — e.g. "joining this group lets
 * its admins view your personal workspace usage — confirm?". Unlike a
 * normal toast it never auto-dismisses; the caller's promise settles
 * only when the user answers (or an optional timeoutMs expires).
 *
 * Mount once at the shell level, next to `<HToast />`. Self-contained
 * Teleport-to-body host: cards sit in the same fixed top-right column
 * HkToast uses (`--hk-z-toast`), so transient toasts and blocking cards
 * share one visual stack; mount it after `<HToast />` (the established
 * shell convention) so the blocking host paints above the transient
 * stack when both are visible — the two containers share the toast band
 * base, so DOM order breaks the tie. While a card is visible it
 * registers with usePopupManager (kind "toast", no scroll lock, with
 * its title) so z-index ordering and popup introspection stay coherent
 * with modals/drawers; the popup handle also fixes card-vs-card
 * stacking (newer cards paint above older ones), and the explicit card
 * z keeps cards clickable under the pointer-transparent toast column.
 */
import { AlertTriangle, CircleX as XCircle, Info } from "lucide-vue-next";
import {
  defineComponent,
  onBeforeUnmount,
  Teleport,
  TransitionGroup,
  watchEffect,
} from "vue";

import { useI18n } from "../i18n/context";
import { usePopupManager, type PopupHandle } from "../runtime/usePopupManager";
import { clearLeaveGeometry, pinLeaveGeometry } from "../utils/dom";
import {
  resolveBlockingToast,
  useBlockingToast,
  type BlockingToastItem,
  type BlockingToastVariant,
} from "../runtime/useBlockingToast";
import "./HkBlockingToast.scss";
import HButton from "./HkButton";

const ICON_SIZE = 18;

function renderIcon(variant: BlockingToastVariant) {
  if (variant === "danger") return <XCircle size={ICON_SIZE} />;
  if (variant === "warning") return <AlertTriangle size={ICON_SIZE} />;
  return <Info size={ICON_SIZE} />;
}

const HkBlockingToastCard = defineComponent({
  name: "HkBlockingToastCard",
  props: {
    item: { type: Object as () => BlockingToastItem, required: true },
  },
  emits: {
    confirm: () => true,
    cancel: () => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();

    return () => {
      const item = props.item;
      return (
        <div
          class={["hk-blocking-toast-card", `hk-blocking-toast-${item.variant}`]}
          role="alertdialog"
          aria-label={item.title ?? item.message}
        >
          <span class="hk-blocking-toast-icon">{renderIcon(item.variant)}</span>
          <div class="hk-blocking-toast-body">
            {item.title ? (
              <strong class="hk-blocking-toast-title">{item.title}</strong>
            ) : null}
            <p class="hk-blocking-toast-message">{item.message}</p>
            <div class="hk-blocking-toast-actions">
              <HButton
                variant="secondary"
                size="sm"
                onClick={() => emit("cancel")}
              >
                {item.cancelLabel ?? t("hikari::blockingToast.cancel", "Cancel")}
              </HButton>
              <HButton
                variant={item.variant === "danger" ? "danger" : "primary"}
                size="sm"
                onClick={() => emit("confirm")}
              >
                {item.confirmLabel ?? t("hikari::blockingToast.confirm", "Confirm")}
              </HButton>
            </div>
          </div>
        </div>
      );
    };
  },
});

export default defineComponent({
  name: "HkBlockingToast",
  setup() {
    const { queue } = useBlockingToast();
    const manager = usePopupManager();
    const handles = new Map<number, PopupHandle>();

    // Keep one popup-manager entry (kind "toast") per visible card so
    // registry introspection and stacking stay coherent; unregister on
    // removal. Cards register in queue order, so newer prompts get the
    // higher z-index and paint above older ones.
    watchEffect(() => {
      const live = new Set(queue.map((item) => item.id));
      for (const [id, handle] of [...handles]) {
        if (!live.has(id)) {
          manager.unregister(handle.id);
          handles.delete(id);
        }
      }
      for (const item of queue) {
        if (!handles.has(item.id)) {
          handles.set(
            item.id,
            manager.register("toast", false, item.title ?? item.message),
          );
        }
      }
    });

    onBeforeUnmount(() => {
      for (const [, handle] of handles) manager.unregister(handle.id);
      handles.clear();
    });

    function zIndexOf(item: BlockingToastItem): number {
      return handles.get(item.id)?.zIndex ?? 0;
    }

    return () => (
      <Teleport to="body">
        <div class="hk-blocking-toast-container">
          <TransitionGroup
            tag="div"
            name="hk-blocking-toast"
            onBeforeLeave={pinLeaveGeometry}
            onLeaveCancelled={clearLeaveGeometry}
          >
            {queue.map((item) => (
              <div
                key={item.id}
                class="hk-blocking-toast-slot"
                style={{ zIndex: zIndexOf(item) }}
              >
                <HkBlockingToastCard
                  item={item}
                  onConfirm={() => resolveBlockingToast(item.id, true)}
                  onCancel={() => resolveBlockingToast(item.id, false)}
                />
              </div>
            ))}
          </TransitionGroup>
        </div>
      </Teleport>
    );
  },
});
