import { CircleX as XCircle, X } from "lucide-vue-next";
import { computed, defineComponent, onMounted, onUnmounted, ref, Teleport, Transition, TransitionGroup, watch } from "vue";
import { AlertTriangle, CheckCircle, Copy, Info } from "lucide-vue-next";


import { useToast, type ToastItem, type ToastMessage, type ToastType } from "../runtime/useToast";
import { useClipboard } from "../runtime/useClipboard";
import { usePopupManager, type PopupHandle } from "../runtime/usePopupManager";
import { useI18n } from "../i18n/context";
import { clearLeaveGeometry, pinLeaveGeometry } from "../utils/dom";
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
    let popupHandle: PopupHandle | null = null;
    const containerZ = ref<number | null>(null);

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
            tag="div"
            name="hk-toast"
            onBeforeLeave={pinLeaveGeometry}
            onLeaveCancelled={clearLeaveGeometry}
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
