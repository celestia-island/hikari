import { AlertTriangle, Info, X } from "lucide-vue-next";
import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  ref,
  Teleport,
  type PropType,
  type SlotsType,
} from "vue";

import { usePopupManager, type PopupHandle } from "../runtime/usePopupManager";
import { useI18n } from "../i18n/context";
import "./HkPersistentToast.scss";

export type PersistentToastTone = "loading" | "info" | "warning" | "error";

/** Viewport gutter the detail card clamps into (mirror of
 *  --viewport-gutter's desktop value; the card is chrome-adjacent and
 *  small, so the mobile/desktop split is not worth a runtime read). */
const GUTTER_PX = 8;
/** Vertical gap between the chip's bottom edge and the detail card. */
const CARD_GAP_PX = 6;

let popupSeq = 0;

/**
 * HkPersistentToast — a persistent status chip for chrome bars (title
 * bars, status strips): the third member of the toast family after
 * HkToast (transient corner stack) and HkBlockingToast (window-modal).
 * It never auto-dismisses; the host renders it while a condition holds
 * (a load in flight, an upstream outage) and unmounts it when the
 * condition clears.
 *
 * ```tsx
 * <HPersistentToast tone="loading" label="Loading stats…" />
 * <HPersistentToast tone="error" label="Upstream fault" onDismiss={silence}>
 *   <template #detail>…rich card…</template>
 * </HPersistentToast>
 * ```
 *
 * Behavior contract:
 * - `tone="loading"` renders a spinner, the other tones a static icon;
 *   the label truncates, the chip never wraps.
 * - With a `detail` slot the chip becomes a button: hover (after
 *   `openDelay`) or focus opens the rich card anchored below the chip;
 *   moving the pointer onto the card keeps it open (`closeGrace`), and
 *   a click PINNS it — a pinned card only closes on its own Escape /
 *   outside click / another chip click, so touch users get parity.
 * - `onDismiss` (a dismiss emit) renders the ✕ affordance beside the
 *   chip; the chip itself stays a single interactive surface (the ✕ is
 *   a sibling button, never nested — a button inside a button is dead
 *   markup).
 * - The wrap carries role="status" + aria-live="polite", so label
 *   changes announce without stealing focus — the property the wowsp
 *   title-bar loading chip relies on.
 */
export default defineComponent({
  name: "HkPersistentToast",
  props: {
    tone: { type: String as PropType<PersistentToastTone>, default: "info" },
    /** Text beside the icon; truncates rather than wraps. */
    label: { type: String, default: "" },
    /** Hover/focus card content; providing the slot makes the chip interactive. */
    detailLabel: { type: String, default: "" },
    /** Renders the ✕ affordance beside the chip; clicking it emits `dismiss`.
     *  A sibling button, never a child of the chip — a button inside a
     *  button is invalid markup and would break the chip's click toggle. */
    dismissible: { type: Boolean, default: false },
    openDelay: { type: Number, default: 150 },
    closeGrace: { type: Number, default: 250 },
  },
  emits: {
    dismiss: () => true,
  },
  slots: Object as SlotsType<{
    detail?: () => unknown;
  }>,
  setup(props, { slots, emit }) {
    const { t } = useI18n();
    const manager = usePopupManager();
    const wrapRef = ref<HTMLElement | null>(null);
    const cardRef = ref<HTMLElement | null>(null);
    const open = ref(false);
    const pinned = ref(false);
    const zIndex = ref<number | null>(null);
    const popupId = `hk-persistent-toast-${++popupSeq}`;
    let handle: PopupHandle | null = null;
    let openTimer: ReturnType<typeof setTimeout> | null = null;
    let closeTimer: ReturnType<typeof setTimeout> | null = null;

    const interactive = computed(() => !!slots.detail);

    // The card is LAZY (tooltip-bridge contract): a chip nobody hovers
    // costs no teleported node and no band registration. The handle is
    // held for the whole open window — hover-out only closes, unmount
    // releases.
    function ensureHandle() {
      if (!handle) {
        handle = manager.register("tooltip", false);
        zIndex.value = handle.zIndex;
      }
    }

    function releaseHandle() {
      if (handle) {
        manager.unregister(handle.id);
        handle = null;
      }
      zIndex.value = null;
    }

    function clearTimers() {
      if (openTimer !== null) {
        clearTimeout(openTimer);
        openTimer = null;
      }
      if (closeTimer !== null) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
    }

    /** Anchor the card below the chip, right-aligned to it (chrome bars
     *  hug the window's trailing corner, so an end-aligned card grows
     *  leftward into the roomier side), clamped into the viewport. */
    function positionCard() {
      const chip = wrapRef.value;
      const card = cardRef.value;
      if (!chip || !card) return;
      const rect = chip.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = rect.right - card.offsetWidth;
      left = Math.max(GUTTER_PX, Math.min(left, vw - GUTTER_PX - card.offsetWidth));
      let top = rect.bottom + CARD_GAP_PX;
      top = Math.max(GUTTER_PX, Math.min(top, vh - GUTTER_PX - card.offsetHeight));
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
    }

    function openCard(pin: boolean) {
      clearTimers();
      ensureHandle();
      if (pin) pinned.value = true;
      open.value = true;
      nextTick(() => requestAnimationFrame(positionCard));
    }

    function closeCard(force = false) {
      if (pinned.value && !force) return;
      pinned.value = false;
      open.value = false;
      releaseHandle();
    }

    function scheduleOpen() {
      if (openTimer !== null) clearTimeout(openTimer);
      openTimer = setTimeout(() => {
        openTimer = null;
        openCard(false);
      }, props.openDelay);
    }

    function scheduleClose() {
      if (closeTimer !== null) clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        closeTimer = null;
        closeCard(false);
      }, props.closeGrace);
    }

    function cancelClose() {
      if (closeTimer !== null) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
    }

    function onChipClick() {
      if (pinned.value) {
        closeCard(true);
      } else {
        // A click during the hover-open window promotes to pinned in
        // place — the card must not flicker closed and reopen.
        openCard(true);
      }
    }

    function onChipKeydown(e: KeyboardEvent) {
      if (e.key === "Escape" && open.value) {
        e.preventDefault();
        e.stopPropagation();
        closeCard(true);
      }
    }

    // Outside clicks close a PINNED card (a hover-open card closes on
    // its own grace timer; listening always would fight the chip's own
    // click toggle — hence the contains check).
    function onDocumentPointerdown(e: PointerEvent) {
      if (!open.value || !pinned.value) return;
      const target = e.target as Node;
      if (wrapRef.value?.contains(target)) return;
      if (cardRef.value?.contains(target)) return;
      closeCard(true);
    }

    function onWindowResize() {
      if (open.value) positionCard();
    }

    document.addEventListener("pointerdown", onDocumentPointerdown, true);
    window.addEventListener("resize", onWindowResize);

    onBeforeUnmount(() => {
      clearTimers();
      releaseHandle();
      document.removeEventListener("pointerdown", onDocumentPointerdown, true);
      window.removeEventListener("resize", onWindowResize);
    });

    const cardStyle = computed(() => (zIndex.value != null ? { zIndex: zIndex.value } : {}));

    return () => {
      const Tag = (interactive.value ? "button" : "span") as "button";
      return (
        <span ref={wrapRef} class="hk-persistent-toast-wrap" role="status" aria-live="polite">
          <Tag
            type={interactive.value ? "button" : undefined}
            class={["hk-persistent-toast", `hk-persistent-toast--${props.tone}`]}
            aria-expanded={interactive.value ? open.value : undefined}
            aria-haspopup={interactive.value ? "true" : undefined}
            aria-controls={open.value ? popupId : undefined}
            onMouseenter={interactive.value ? scheduleOpen : undefined}
            onMouseleave={interactive.value ? scheduleClose : undefined}
            onFocusin={interactive.value ? () => openCard(false) : undefined}
            onFocusout={
              interactive.value
                ? () => {
                    if (!pinned.value) closeCard(false);
                  }
                : undefined
            }
            onClick={interactive.value ? onChipClick : undefined}
            onKeydown={interactive.value ? onChipKeydown : undefined}
          >
            {props.tone === "loading" ? (
              <span class="hk-persistent-toast__spinner" aria-hidden="true" />
            ) : props.tone === "error" || props.tone === "warning" ? (
              <AlertTriangle size={12} class="hk-persistent-toast__icon" aria-hidden="true" />
            ) : (
              <Info size={12} class="hk-persistent-toast__icon" aria-hidden="true" />
            )}
            <span class="hk-persistent-toast__label">{props.label}</span>
          </Tag>
          {props.dismissible && (
            <button
              type="button"
              class="hk-persistent-toast__dismiss"
              aria-label={t("hikari::persistentToast.dismiss", "Dismiss")}
              onClick={() => emit("dismiss")}
            >
              <X size={12} aria-hidden="true" />
            </button>
          )}
          {slots.detail && open.value && (
            <Teleport to="body">
              <div
                ref={cardRef}
                id={popupId}
                class="hk-persistent-toast-card hii-dropdown-content"
                role="group"
                aria-label={props.detailLabel || undefined}
                style={cardStyle.value}
                onMouseenter={cancelClose}
                onMouseleave={() => {
                  if (!pinned.value) scheduleClose();
                }}
              >
                {slots.detail()}
              </div>
            </Teleport>
          )}
        </span>
      );
    };
  },
});
