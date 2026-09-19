import { CircleX as XCircle, X } from "lucide-vue-next";
import { computed, defineComponent, onBeforeUpdate, onMounted, onUnmounted, ref, Teleport, Transition, TransitionGroup, watch } from "vue";
import { AlertTriangle, CheckCircle, Copy, Info } from "lucide-vue-next";


import { useToast, type ToastItem, type ToastMessage, type ToastType } from "../runtime/useToast";
import { useClipboard } from "../runtime/useClipboard";
import { usePopupManager, type PopupHandle } from "../runtime/usePopupManager";
import { useI18n } from "../i18n/context";
import { clearLeaveGeometry, pinLeaveGeometry, type LeaveBoxSnapshot } from "../utils/dom";
import { useSurfaceTransition } from "../composables/useSurfaceTransition";
import "./HkToast.scss";

const LONG_THRESHOLD = 50;

function isLong(msg: string) {
  return msg.length > LONG_THRESHOLD;
}

function LoadingSpinner({ size }: { size: number }) {
  return (
    <div
      class="hk-toast-loading-spinner"
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}

function renderIcon(type: ToastType, size = 18) {
  if (type === "error") return <XCircle size={size} />;
  if (type === "success") return <CheckCircle size={size} />;
  if (type === "warning") return <AlertTriangle size={size} />;
  if (type === "loading") return <LoadingSpinner size={size} />;
  return <Info size={size} />;
}

function renderCountLabel(count: number, unit: string) {
  return `${count} ${unit}`;
}

const ACTION_ICON_SIZE = 18;

const HkToastItem = defineComponent({
  name: "HkToastItem",
  props: {
    toast: { type: Object as () => ToastItem, required: true },
  },
  emits: {
    remove: (_id: number) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const clipboard = useClipboard();
    const displayedMsgId = ref<number | null>(null);
    const animating = ref(false);

    watch(
      () => props.toast.id,
      () => {
        const msgs = props.toast.messages;
        displayedMsgId.value = msgs.length > 0 ? msgs[msgs.length - 1].id : null;
        animating.value = false;
      },
      { immediate: true },
    );

    function latestMsgId(): number | null {
      const msgs = props.toast.messages;
      return msgs.length > 0 ? msgs[msgs.length - 1].id : null;
    }

    function tryAdvance() {
      if (animating.value) return;
      const latest = latestMsgId();
      if (latest === null || latest === displayedMsgId.value) return;
      animating.value = true;
      displayedMsgId.value = latest;
    }

    watch(() => props.toast.messages.length, () => tryAdvance());

    function onMsgAfterEnter() {
      animating.value = false;
      tryAdvance();
    }

    const displayedMessage = computed<ToastMessage | null>(() => {
      const id = displayedMsgId.value;
      if (id === null) return null;
      return props.toast.messages.find((m) => m.id === id) ?? null;
    });

    function handleCopy() {
      const text = props.toast.messages.map((m) => m.text).join("\n\n");
      clipboard.copy(text);
    }

    function handleClose() {
      emit("remove", props.toast.id);
    }

    return () => {
      const msg = displayedMessage.value;
      const text = msg?.text ?? "";
      const long = isLong(text);
      const count = props.toast.messages.length;

      return (
        <div class={["hk-toast-item", `hk-toast-${props.toast.type}`]}>
          <span class="hk-toast-icon">{renderIcon(props.toast.type)}</span>
          <div class="hk-toast-body">
            <Transition
              name="hk-toast-msg"
              mode="out-in"
              onAfterEnter={onMsgAfterEnter}
            >
              <span
                key={msg?.id ?? 0}
                class="hk-toast-message"
                title={text}
              >
                {text}
              </span>
            </Transition>
            {count > 1 && (
              <span class="hk-toast-count">{renderCountLabel(count, t("hikari::toast.msgs", "msgs"))}</span>
            )}
          </div>
          {props.toast.copyable && (
            <button
              class="hk-toast-copy-btn"
              title={t("hikari::toast.copy", "Copy")}
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
            >
              <Copy size={ACTION_ICON_SIZE} />
            </button>
          )}
          <button
            class="hk-toast-close"
            aria-label={t("hikari::toast.close", "Close")}
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
          >
            <X size={ACTION_ICON_SIZE} />
          </button>
        </div>
      );
    };
  },
});

export default defineComponent({
  name: "HkToast",
  setup() {
    const { toasts, remove } = useToast();
    // The toast stack registers with the popup manager (kind "toast") so
    // it holds the topmost z band (POPUP_Z_BANDS.toast): toasts stay
    // above every modal/drawer sheet no matter which opened first.
    const manager = usePopupManager();
    // Toast enter/leave motion reported into the unified animation
    // context. The TransitionGroup hooks fire per item onto ONE shared
    // track: interleaved enters/leaves re-arm/cancel it, so the bus may
    // briefly under- or over-report while several toasts swap — the
    // duration cron in useReportedTransition self-heals within one
    // window; this is cadence reporting, not exact per-item tracking.
    const surf = useSurfaceTransition(320);
    const itemHooks = surf.hooks();
    let popupHandle: PopupHandle | null = null;
    const containerZ = ref<number | null>(null);

    // Pre-patch geometry of every toast, refreshed on each update (the
    // DOM is still the pre-patch tree at onBeforeUpdate — same pattern
    // as HkListTransition / HkTabs). During a multi-toast removal the
    // first leaving sibling gets its leave-active class (position:
    // absolute) synchronously inside the patch pass, so by the time the
    // NEXT sibling's beforeLeave runs, the shrink-to-fit stack column
    // has already re-fit: a live offset read there would freeze the
    // reflowed box — toasts teleport onto the top slot, a narrow toast's
    // bar collapses to its own max-content, and the overlapped fading
    // texts read as one squashed multi-line blob. The wrapper itself may
    // also have re-fit when the pin runs, so the right anchor is snapped
    // at snapshot time too (see LeaveBoxSnapshot.right).
    //
    // Sizes come from getBoundingClientRect, NOT the offset* family:
    // offsetWidth/Height round to integers, and the pinned box shrinks
    // whenever the real box rounds down — a toast whose text sits within
    // that sub-pixel distance of the wrap boundary loses its last
    // character to the next line the instant the leave pins it. Rect
    // width/height are exact and translation-invariant (enter/move only
    // ever translate these surfaces, and translation does not change a
    // box's size), so the pin reproduces the visible box to the pixel.
    // Positions stay on offsetTop/offsetLeft — the transform-immune
    // layout slot, where the ±0.5px integer error is invisible.
    const hostRef = ref<{ $el?: Element } | null>(null);
    const preLeaveBoxes = new WeakMap<Element, LeaveBoxSnapshot>();
    onBeforeUpdate(() => {
      const host = hostRef.value?.$el;
      if (host == null || host.nodeType !== 1) return;
      const hostEl = host as HTMLElement;
      const hostWidth = hostEl.getBoundingClientRect().width;
      for (const child of Array.from(host.children)) {
        const e = child as HTMLElement;
        const rect = e.getBoundingClientRect();
        preLeaveBoxes.set(e, {
          top: e.offsetTop,
          left: e.offsetLeft,
          width: rect.width,
          height: rect.height,
          right: hostWidth - (e.offsetLeft + rect.width),
        });
      }
    });

    onMounted(() => {
      popupHandle = manager.register("toast", false);
      containerZ.value = popupHandle.zIndex;
    });

    onUnmounted(() => {
      if (popupHandle) {
        manager.unregister(popupHandle.id);
        popupHandle = null;
      }
    });

    const containerStyle = computed<Record<string, string> | undefined>(() =>
      containerZ.value != null
        ? { "--hk-z-toast": String(containerZ.value) }
        : undefined,
    );

    return () => (
      <Teleport to="body">
        <div class="hk-toast-container" style={containerStyle.value}>
          <TransitionGroup
            ref={hostRef}
            tag="div"
            name="hk-toast"
            onBeforeEnter={itemHooks.onBeforeEnter}
            onAfterEnter={itemHooks.onAfterEnter}
            onBeforeLeave={(el: Element) => {
              itemHooks.onBeforeLeave();
              pinLeaveGeometry(el, { box: preLeaveBoxes.get(el) });
            }}
            onAfterLeave={itemHooks.onAfterLeave}
            onLeaveCancelled={(el: Element) => {
              itemHooks.onLeaveCancelled();
              clearLeaveGeometry(el);
            }}
          >
            {toasts.map((item) => (
              <HkToastItem
                key={item.id}
                toast={item}
                onRemove={(id: number) => remove(id)}
              />
            ))}
          </TransitionGroup>
        </div>
      </Teleport>
    );
  },
});
