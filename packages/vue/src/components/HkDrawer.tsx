import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  Teleport,
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
import { useSurfaceMachine } from "../composables/useSurfaceMachine";
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
    // (animationBus) — one track for the whole surface, armed on the
    // machine's animation-phase edges.
    const surfTrack = useSurfaceTransition(320).track("surface");
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

    // ── Surface lifecycle machine ─────────────────────────────────────
    // One machine drives the overlay scrim and the sliding panel — the
    // layers are outputs of the shared phase, so the divergent-layer
    // states of the two-<Transition> era are unrepresentable (see
    // runtime/surfaceMachine.ts). The panel prefix follows the side
    // prop; all four sides share the same 0.3s CSS timing.
    const overlayEl = ref<HTMLElement>();
    const machine = useSurfaceMachine({
      layers: [
        // Budgets are the starvation-era bounds over the SCSS truths
        // (overlay 0.3s/0.3s, panel slides 0.3s/0.3s); the driver probes
        // the live CSS durations and tightens them.
        { prefix: "hk-drawer-overlay", el: () => overlayEl.value, enterMs: () => 320, leaveMs: () => 320 },
        { prefix: "hk-drawer-left", el: () => panelRef.value, enterMs: () => 320, leaveMs: () => 320 },
        { prefix: "hk-drawer-right", el: () => panelRef.value, enterMs: () => 320, leaveMs: () => 320 },
        { prefix: "hk-drawer-top", el: () => panelRef.value, enterMs: () => 320, leaveMs: () => 320 },
        { prefix: "hk-drawer-bottom", el: () => panelRef.value, enterMs: () => 320, leaveMs: () => 320 },
      ],
      onPhase: (from, to, event) => {
        if (to === "openingFrom") {
          surfTrack.run();
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
          // Scrollbar chrome mounts with the panel (was the modelValue
          // watcher's open arm, nextTick after the DOM lands).
          void nextTick(() => {
            // props.modelValue (not machine.mounted): a same-tick
            // open→close flap is already in closingFrom — still mounted —
            // and must not attach a scrollbar onto the dying surface.
            if (!props.modelValue || !bodyRef.value) return;
            detachBodyScrollbar();
            // The wrapper (not the panel) is the track host: the panel
            // also contains the header/footer bands, and rails spanning
            // those would light up in the wrong place.
            bodyScrollbar = attachOverlayScrollbars(bodyRef.value, {
              axis: "vertical",
              host: bodyWrapRef.value,
            });
          });
        } else if (to === "open") {
          surfTrack.cancel();
          const el = panelRef.value;
          if (el) focusFirst(el);
        } else if (to === "closingFrom") {
          surfTrack.run();
          // Register/unregister WITH the open state so a closed-but-
          // mounted drawer does not linger in the overlay registry
          // (isOverlayOpen must reflect reality). The popup manager
          // handle is torn down by the finalize edge below or by
          // cleanup() on unmount.
          overlayHook.close();
          backGuard.release();
          detachBodyScrollbar();
        } else if (
          to === "closed" &&
          (from === "closingFrom" || from === "closingTo") &&
          // UNMOUNT mid-close is a teardown, not a finalized leave —
          // afterLeave/focus-restore belong to the close lifecycle only.
          event !== "UNMOUNT"
        ) {
          surfTrack.cancel();
          onDrawerAfterLeave();
        }
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
        // The machine owns every visual/registry consequence on its
        // phase edges; this watcher is purely the event feed.
        machine.send(val ? "OPEN" : "CLOSE");
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

    return () => {
      if (!machine.mounted.value) return null;
      const panelPrefix = `hk-drawer-${props.side}`;
      return (
      <Teleport to="body">
        {props.overlay ? (
          <div
            ref={overlayEl}
            class={["hk-drawer-overlay", ...machine.classesFor("hk-drawer-overlay")]}
            style={{ zIndex: overlayZ.value }}
            onClick={onOverlayClick}
          />
        ) : null}
        <div
              ref={panelRef}
              class={["hk-drawer-panel", `hk-drawer-${props.side}`, props.panelClass, ...machine.classesFor(panelPrefix)]}
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
                      <HIcon name="close" size={16} />
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
      </Teleport>
      );
    };
  },
});
