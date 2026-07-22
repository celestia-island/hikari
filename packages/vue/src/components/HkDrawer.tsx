import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  Teleport,
  Transition,
  watch,
  type PropType,
} from "vue";

import { useHikariI18n } from "../i18n/context";
import "./HkDrawer.scss";
import { useOverlay } from "../runtime/useOverlay";
import { usePopupManager } from "../runtime/usePopupManager";

type DrawerSide = "left" | "right" | "top" | "bottom";

export default defineComponent({
  name: "HkDrawer",
  props: {
    modelValue: { type: Boolean, required: true },
    side: { type: String as PropType<DrawerSide>, default: "right" },
    title: { type: String, default: undefined },
    closable: { type: Boolean, default: true },
    overlay: { type: Boolean, default: true },
    size: { type: String, default: "320px" },
  },
  emits: {
    "update:modelValue": (_value: boolean) => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useHikariI18n();
    const manager = usePopupManager();
    const overlayHook = useOverlay({ name: "hk-drawer" });

    const handle = ref<{ id: string; zIndex: number } | null>(null);
    const panelRef = ref<HTMLElement>();
    let unmounted = false;

    const isVertical = computed(
      () => props.side === "left" || props.side === "right",
    );

    const overlayZ = computed(() => handle.value?.zIndex ?? 0);
    const panelZ = computed(() => (handle.value?.zIndex ?? 0) + 1);

    const panelStyle = computed(() => {
      const base: Record<string, string | number> =
        isVertical.value
          ? { width: props.size, maxWidth: "85vw" }
          : { height: props.size, maxHeight: "70vh" };
      base.zIndex = panelZ.value;
      return base;
    });

    function close() {
      emit("update:modelValue", false);
    }

    function onOverlayClick() {
      if (props.closable && props.overlay) close();
    }

    function onEscape() {
      if (props.closable) close();
    }

    function onDrawerAfterLeave() {
      cleanup();
    }

    function cleanup() {
      if (handle.value) {
        manager.unregister(handle.value.id);
        handle.value = null;
      }
    }

    watch(
      () => props.modelValue,
      (val) => {
        if (unmounted) return;
        if (val) {
          cleanup();
          handle.value = manager.register("drawer", true);
          overlayHook.open();
          nextTick(() => {
            panelRef.value?.focus();
          });
        }
      },
      { immediate: true },
    );

    onMounted(() => {
      unmounted = false;
    });

    onBeforeUnmount(() => {
      unmounted = true;
      cleanup();
    });

    return () => (
      <Teleport to="body">
        <Transition name="hk-drawer-overlay" appear>
          {props.modelValue && props.overlay ? (
            <div
              class="hk-drawer-overlay"
              style={{ zIndex: overlayZ.value }}
              onClick={onOverlayClick}
            />
          ) : null}
        </Transition>
        <Transition name={`hk-drawer-${props.side}`} appear onAfterLeave={onDrawerAfterLeave}>
          {props.modelValue ? (
            <div
              ref={panelRef}
              class={["hk-drawer-panel", `hk-drawer-${props.side}`]}
              style={panelStyle.value}
              role="dialog"
              aria-label={props.title}
              aria-modal={props.overlay}
              tabindex={-1}
              onKeydown={(e: KeyboardEvent) => {
                if (e.key === "Escape") onEscape();
              }}
            >
              {props.title || slots.header ? (
                <div class="hk-drawer-header">
                  {slots.header ? (
                    slots.header()
                  ) : (
                    <span class="hk-drawer-title">{props.title}</span>
                  )}
                  {props.closable ? (
                    <button
                      class="hk-drawer-close"
                      aria-label={t("hk.drawer.close", "Close")}
                      onClick={close}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        width="16"
                        height="16"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div class="hk-drawer-body">{slots.default?.()}</div>
              {slots.footer ? (
                <div class="hk-drawer-footer">{slots.footer()}</div>
              ) : null}
            </div>
          ) : null}
        </Transition>
      </Teleport>
    );
  },
});
