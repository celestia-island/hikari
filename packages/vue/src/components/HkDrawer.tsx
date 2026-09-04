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

import { useI18n } from "../i18n/context";
import "./HkDrawer.scss";
import { focusFirst, trapFocus } from "../utils/dom";
import { useOverlay } from "../runtime/useOverlay";
import { usePopupManager } from "../runtime/usePopupManager";
import { createBackGuard } from "../runtime/backStack";
import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";
import { useSurfaceTransition } from "../composables/useSurfaceTransition";
import HIconButton from "./HkIconButton";
import HIcon from "./HkIcon";
import "./window-close.scss";

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
    /** Extra classes for the floating panel — lets consumers scope
     *  body/footer padding overrides (attrs fallthrough cannot reach a
     *  Teleported panel). */
    panelClass: { type: String, default: undefined },
    /**
     * Consume the browser/system back gesture while open (window-first
     * back priority): a marked history entry is pushed on open so back
     * closes the drawer instead of leaving the page. Only meaningful
     * together with `closable`; disable for surfaces that manage their
     * own history entries.
     */
    backGuard: { type: Boolean, default: true },
  },
  emits: {
    "update:modelValue": (_value: boolean) => true,
    // Mirrors HkModal.afterLeave so adaptive shells (HkAdaptiveDialog)
    // can forward a uniform "the panel finished leaving" signal.
    afterLeave: () => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const manager = usePopupManager();
    // Open/close motion reported into the unified animation context
    // (animationBus) — scrim and sliding panel on separate tracks.
    const surf = useSurfaceTransition(320);
    const scrimHooks = surf.hooks("scrim");
    const panelHooks = surf.hooks("panel");
    const overlayHook = useOverlay({
      name: "hk-drawer",
      // A global closeAll() must be able to actually close this drawer
      // (not just untrack it) — route it through the same closable
      // guard as the user-initiated paths.
      onCloseRequested: () => { if (props.closable) close(); },
    });

    const handle = ref<{ id: string; zIndex: number } | null>(null);
    const panelRef = ref<HTMLElement>();
    const bodyRef = ref<HTMLElement>();
    // Positioned wrapper that contains ONLY the scrolling body — the
    // overlay rail's host (see the attach call below).
    const bodyWrapRef = ref<HTMLElement>();
    let unmounted = false;
    let previouslyFocused: HTMLElement | null = null;

    // Overlay scrollbar on the scrolling body (shared chrome). The body
    // mounts with the panel and survives the leave transition; attach
    // after the DOM lands, detach on close/unmount so nothing leaks in
    // the Teleport portal.
    let bodyScrollbar: OverlayScrollbarHandle | null = null;

    function detachBodyScrollbar(): void {
      bodyScrollbar?.detach();
      bodyScrollbar = null;
    }

    watch(() => props.modelValue, (open) => {
      if (unmounted) return;
      if (open) {
        void nextTick(() => {
          if (!props.modelValue || !bodyRef.value) return;
          detachBodyScrollbar();
          // The wrapper (not the panel) is the track host: the panel also
          // contains the header/footer bands, and rails spanning those
          // would light up in the wrong place.
          bodyScrollbar = attachOverlayScrollbars(bodyRef.value, {
            axis: "vertical",
            host: bodyWrapRef.value,
          });
        });
      } else {
        detachBodyScrollbar();
      }
    });

    /**
     * Window-first back priority: while this drawer is the topmost open
     * window, the back gesture closes it instead of navigating the
     * page. Disabled for non-closable drawers — back must not be
     * swallowed by a surface it cannot close.
     */
    const backGuardEnabled = () => props.closable && props.backGuard;
    const backGuard = createBackGuard({
      onBack: () => {
        if (backGuardEnabled()) close();
      },
    });

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

    function onDrawerAfterEnter() {
      const el = panelRef.value;
      if (el) focusFirst(el);
    }

    function onDrawerAfterLeave() {
      cleanup();
      if (previouslyFocused) {
        previouslyFocused.focus();
        previouslyFocused = null;
      }
      emit("afterLeave");
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
          // Register with the drawer title so the modal-stack breadcrumb
          // labels this layer by name — a drawer is a window on every
          // form factor and must never fall back to a generic label.
          handle.value = manager.register("drawer", true, props.title);
          overlayHook.open();
          previouslyFocused = document.activeElement as HTMLElement | null;
          if (backGuardEnabled() && backGuard.entries === 0) {
            backGuard.push();
          }
        } else {
          // Register/unregister WITH the open state so a closed-but-mounted
          // drawer does not linger in the overlay registry (isOverlayOpen
          // must reflect reality). The popup manager handle is torn down by
          // the leave transition or by cleanup() on unmount.
          overlayHook.close();
          backGuard.release();
        }
      },
      { immediate: true },
    );

    // closable/backGuard may flip while open (submit flows disable
    // closing): keep the owned entry in lockstep so back is never a
    // dead gesture on a surface it can no longer close.
    watch(
      backGuardEnabled,
      (enabled) => {
        if (unmounted || !props.modelValue) return;
        if (enabled && backGuard.entries === 0) backGuard.push();
        else if (!enabled && backGuard.entries > 0) backGuard.release();
      },
    );

    // A retitled open drawer must re-label its breadcrumb layer (same
    // contract as HkModal's title watch).
    watch(
      () => props.title,
      (newTitle) => {
        if (handle.value && newTitle) {
          manager.setTitle(handle.value.id, newTitle);
        }
      },
    );

    onMounted(() => {
      unmounted = false;
    });

    onBeforeUnmount(() => {
      unmounted = true;
      detachBodyScrollbar();
      backGuard.destroy();
      cleanup();
    });

    return () => (
      <Teleport to="body">
        <Transition
          name="hk-drawer-overlay"
          appear
          onBeforeEnter={scrimHooks.onBeforeEnter}
          onAfterEnter={scrimHooks.onAfterEnter}
          onBeforeLeave={scrimHooks.onBeforeLeave}
          onAfterLeave={scrimHooks.onAfterLeave}
        >
          {props.modelValue && props.overlay ? (
            <div
              class="hk-drawer-overlay"
              style={{ zIndex: overlayZ.value }}
              onClick={onOverlayClick}
            />
          ) : null}
        </Transition>
        <Transition
          name={`hk-drawer-${props.side}`}
          appear
          onBeforeEnter={panelHooks.onBeforeEnter}
          onAfterEnter={() => {
            panelHooks.onAfterEnter();
            onDrawerAfterEnter();
          }}
          onBeforeLeave={panelHooks.onBeforeLeave}
          onAfterLeave={() => {
            panelHooks.onAfterLeave();
            onDrawerAfterLeave();
          }}
        >
          {props.modelValue ? (
            <div
              ref={panelRef}
              class={["hk-drawer-panel", `hk-drawer-${props.side}`, props.panelClass]}
              style={panelStyle.value}
              role="dialog"
              aria-label={props.title}
              aria-modal={props.overlay}
              tabindex={-1}
              onKeydown={(e: KeyboardEvent) => {
                if (e.key === "Escape") onEscape();
                else if (e.key === "Tab" && panelRef.value) trapFocus(panelRef.value, e);
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
                    <HIconButton
                      class="hk-window-close hk-drawer-close"
                      size={32}
                      variant="ghost"
                      aria-label={t("hikari::drawer.close", "Close")}
                      onClick={close}
                    >
                      <HIcon name="X" size={16} />
                    </HIconButton>
                  ) : null}
                </div>
              ) : null}
              <div ref={bodyWrapRef} class="hk-drawer-body-wrap">
                <div ref={bodyRef} class="hk-drawer-body">{slots.default?.()}</div>
              </div>
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
