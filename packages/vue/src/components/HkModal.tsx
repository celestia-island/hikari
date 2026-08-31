import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  Teleport,
  Transition,
  watch,
  type PropType,
} from "vue";

import { useI18n } from "../i18n/context";
import "./HkModal.scss";
import { focusFirst, trapFocus } from "../utils/dom";
import { useOverlay } from "../runtime/useOverlay";
import { usePopupManager } from "../runtime/usePopupManager";
import { createBackGuard } from "../runtime/backStack";
import { scheduleFrame, type AnimationHandle } from "../runtime/animationBus";
import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";
import HButton from "./HkButton";
import HFab from "./HkFab";
import HSpinner from "./HkSpinner";

export interface ModalAction {
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';


export default defineComponent({
  name: "HkModal",
  props: {
    modelValue: { type: Boolean, required: true },
    title: { type: String, default: undefined },
    closable: { type: Boolean, default: true },
    width: { type: String, default: "32rem" },
    footerActions: {
      type: Array as PropType<ModalAction[]>,
      default: undefined,
    },
    windowed: { type: Boolean, default: false },
    overscanScreens: { type: Number, default: 1 },
    autoFollow: { type: Boolean, default: false },
    /**
     * Consume the browser/system back gesture while open (window-first
     * back priority): a marked history entry is pushed on open so back
     * closes the modal instead of leaving the page. Only meaningful
     * together with `closable`; disable for surfaces that manage their
     * own history entries.
     */
    backGuard: { type: Boolean, default: true },
  },
  emits: {
    "update:modelValue": (_value: boolean) => true,
    afterLeave: () => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const manager = usePopupManager();
    const overlay = useOverlay({
      name: "hk-modal",
      // A global closeAll() must be able to actually close this modal
      // (not just untrack it) — route it through the same closable
      // guard as the user-initiated paths.
      onCloseRequested: () => { if (props.closable) close(); },
    });

    const handle = ref<{ id: string; zIndex: number } | null>(null);
    const bodyRef = ref<HTMLElement>();
    const contentRef = ref<HTMLElement>();
    const shouldRender = ref(false);
    let previouslyFocused: HTMLElement | null = null;
    let unmounted = false;

    const overlayZ = computed(() => handle.value?.zIndex ?? 0);
    const contentZ = computed(() => (handle.value?.zIndex ?? 0) + 1);
    const resolvedWidth = computed(() => props.width);

    // Windowed mode state
    const visibleIndices = ref(new Set<number>());
    const sentinelMap = ref(new Map<number, HTMLElement>());
    let windowedObserver: IntersectionObserver | null = null;

    // Auto-follow state
    let autoFollowMutationObserver: MutationObserver | null = null;
    const isFollowing = ref(true);
    /** Body actually scrolls (drives the "Auto" tag visibility). */
    const hasOverflow = shallowRef(false);
    /**
     * Sticky user-intent flag. Set by wheel / touch / drag-press /
     * scroll-key gestures and consumed by the scroll handler; cleared
     * by every programmatic movement (which is never user intent).
     * Fling momentum keeps firing scroll events without new touches,
     * which is why the flag stays set until consumed or cleared.
     */
    let gestureDirty = false;
    /** performance.now() of the last gesture that raised the flag —
     *  drives the settle-frame quiet window below. */
    let gestureAt = 0;
    const scrollContainerRef = ref<HTMLElement>();

    /**
     * Window-first back priority: while this modal is the topmost open
     * window, the back gesture (mobile back button/gesture, desktop
     * browser back) closes it instead of navigating the page. Disabled
     * for non-closable modals — back must not be swallowed by a surface
     * it cannot close.
     */
    const backGuardEnabled = () => props.closable && props.backGuard;
    const backGuard = createBackGuard({
      onBack: () => {
        if (backGuardEnabled()) close();
      },
    });

    function close() {
      emit("update:modelValue", false);
    }

    function onOverlayClick() {
      if (!props.closable) return;
      close();
    }

    function onContentClick(e: MouseEvent) {
      e.stopPropagation();
    }

    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (props.closable) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        return;
      }
      if (e.key === "Tab") {
        const el = contentRef.value;
        if (el) trapFocus(el, e);
      }
    }

    function onAfterEnter() {
      const el = contentRef.value;
      if (el) {
        focusFirst(el);
        setupWindowed(el);
        setupAutoFollow();
      }
    }

    function onAfterLeave() {
      if (handle.value) {
        manager.unregister(handle.value.id);
        handle.value = null;
      }
      shouldRender.value = false;
      if (previouslyFocused) {
        previouslyFocused.focus();
        previouslyFocused = null;
      }
      teardownWindowed();
      teardownAutoFollow();
      emit("afterLeave");
    }

    // --- Windowed mode ---

    function setupWindowed(container: HTMLElement) {
      if (!props.windowed) return;
      teardownWindowed();

      const sentinels = container.querySelectorAll<HTMLElement>(
        "[data-hk-windowed]",
      );
      const overscanPx =
        props.overscanScreens * (container.clientHeight || 600);

      windowedObserver = new IntersectionObserver(
        (entries) => {
          const next = new Set(visibleIndices.value);
          let changed = false;
          for (const entry of entries) {
            const sentinel = entry.target as HTMLElement;
            const idxStr = sentinel.dataset.hkWindowed;
            if (idxStr == null) continue;
            const idx = Number(idxStr);
            if (entry.isIntersecting) {
              if (!next.has(idx)) {
                next.add(idx);
                changed = true;
              }
            } else {
              if (next.has(idx)) {
                next.delete(idx);
                changed = true;
              }
            }
          }
          if (changed) {
            visibleIndices.value = next;
          }
        },
        {
          root: container,
          rootMargin: `${overscanPx}px 0px ${overscanPx}px 0px`,
          threshold: 0,
        },
      );

      for (const s of sentinels) {
        windowedObserver.observe(s);
      }
    }

    function teardownWindowed() {
      if (windowedObserver) {
        windowedObserver.disconnect();
        windowedObserver = null;
      }
      visibleIndices.value = new Set();
      sentinelMap.value = new Map();
    }

    // --- Auto-follow ---
    //
    // Follow policy: ONLY real user motion can cancel following.
    // Streaming content is pinned with direct scrollTop assignments
    // drained across a few animation frames (never smooth-scroll
    // chains), and every programmatic movement clears the sticky
    // gesture flag — so mid-flight scroll events cannot flip isFollowing
    // back and forth (the old flicker).

    const FOLLOW_THRESHOLD = 32;
    const SETTLE_FRAMES = 4;
    /** Pending pin frames yield to gestures younger than this. */
    const GESTURE_QUIET_MS = 250;

    let settleRemaining = 0;
    let settleHandle: AnimationHandle | null = null;

    function runSettleFrame() {
      settleHandle = null;
      // A cancelled follow must not be fought by pending pins: drained
      // frames bail out immediately (resumeJumpLatest re-kicks). The
      // reset above must stay first so kickSettle() never sees a stale,
      // already-consumed handle — that would deadlock all future pins.
      if (!isFollowing.value) {
        settleRemaining = 0;
        return;
      }
      if (gestureDirty && performance.now() - gestureAt < GESTURE_QUIET_MS) {
        // A live gesture is in flight: yield this frame to it and let
        // the scroll handler judge the resulting position. Stale flags
        // older than the quiet window fall through and are consumed
        // below — no stale-flag stall, no fight against the finger.
        if (settleRemaining > 0) {
          settleRemaining--;
          settleHandle = scheduleFrame(runSettleFrame);
        }
        return;
      }
      gestureDirty = false;
      pinToBottom();
      updateOverflow();
      if (settleRemaining > 0) {
        settleRemaining--;
        settleHandle = scheduleFrame(runSettleFrame);
      }
    }

    function kickSettle() {
      // hasOverflow gates the "Auto" tag and the jump FAB. It is only
      // recomputed inside settle frames and scroll events; with windowed
      // lists the body can grow late (async chunks, virtualized mounts)
      // without either firing — poll it alongside the settle drain so the
      // affordances appear on the frame the overflow actually exists.
      updateOverflow();
      settleRemaining = SETTLE_FRAMES;
      if (settleHandle) return;
      settleHandle = scheduleFrame(runSettleFrame);
    }

    function cancelSettle() {
      settleHandle?.disconnect();
      settleHandle = null;
      settleRemaining = 0;
    }

    /** Direct assignment — no smooth scrolling, no intermediate events. */
    function pinToBottom() {
      const el = scrollContainerRef.value;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    }

    function updateOverflow() {
      const el = scrollContainerRef.value;
      if (!el) return;
      hasOverflow.value = el.scrollHeight > el.clientHeight + 4;
    }

    function onBodyScroll() {
      if (!props.autoFollow) return;
      const el = scrollContainerRef.value;
      if (!el) return;
      updateOverflow();
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom > FOLLOW_THRESHOLD) {
        // Without a sticky gesture flag nothing cancels here — streaming
        // pins no longer flash anything.
        if (gestureDirty) {
          gestureDirty = false;
          isFollowing.value = false;
        }
      } else if (!isFollowing.value) {
        // User returned near the bottom (or a pin landed): re-arm naturally.
        gestureDirty = false;
        isFollowing.value = true;
      }
      // Sub-threshold events while still following must NOT touch the
      // flag: a slow upward drag emits many <32px scrolls, and eating
      // the flag on any of them would make cancellation impossible.
    }

    const GESTURE_KEYS = new Set([
      "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ",
    ]);

    function markGesture() {
      gestureDirty = true;
      gestureAt = performance.now();
    }

    function onGestureKeydown(e: KeyboardEvent) {
      if (GESTURE_KEYS.has(e.key)) {
        gestureDirty = true;
        gestureAt = performance.now();
      }
    }

    /** Press-and-drag covers mouse/touch before the drag starts; the
     *  flag stays sticky so post-fling momentum still cancels follow. */
    function onGesturePointerdown(e: PointerEvent) {
      if (e.button === 0) {
        gestureDirty = true;
        gestureAt = performance.now();
      }
    }

    /** A press-drag longer than the quiet window would otherwise have
     *  its flag purged mid-gesture (a mutation frame pins under the
     *  finger and the rest of the drag can no longer cancel). Moving
     *  while buttons are held re-stamps freshness; free hovering —
     *  e.buttons === 0 — must NOT keep a stale flag alive forever. */
    function onGesturePointermove(e: PointerEvent) {
      if (e.buttons !== 0) markGesture();
    }

    /** Touch drags emit touchmove without pointermove on some engines
     *  (and happy-dom tests synthesize either); belt and suspenders. */
    function onGestureTouchmove() {
      markGesture();
    }

    function setupAutoFollow() {
      if (!props.autoFollow || !scrollContainerRef.value) return;
      teardownAutoFollow();

      isFollowing.value = true;
      gestureDirty = false;
      pinToBottom();
      updateOverflow();
      kickSettle();

      const el = scrollContainerRef.value!;
      el.addEventListener("wheel", markGesture, { passive: true });
      el.addEventListener("touchstart", markGesture, { passive: true });
      el.addEventListener("touchmove", onGestureTouchmove, { passive: true });
      el.addEventListener("keydown", onGestureKeydown);
      el.addEventListener("pointerdown", onGesturePointerdown);
      el.addEventListener("pointermove", onGesturePointermove, { passive: true });

      autoFollowMutationObserver = new MutationObserver(() => {
        if (isFollowing.value && !unmounted) kickSettle();
      });

      autoFollowMutationObserver.observe(el, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    function teardownAutoFollow() {
      if (autoFollowMutationObserver) {
        autoFollowMutationObserver.disconnect();
        autoFollowMutationObserver = null;
      }
      const el = scrollContainerRef.value;
      if (el) {
        el.removeEventListener("wheel", markGesture);
        el.removeEventListener("touchstart", markGesture);
        el.removeEventListener("touchmove", onGestureTouchmove);
        el.removeEventListener("keydown", onGestureKeydown);
        el.removeEventListener("pointerdown", onGesturePointerdown);
        el.removeEventListener("pointermove", onGesturePointermove);
      }
      cancelSettle();
      isFollowing.value = true;
      hasOverflow.value = false;
      gestureDirty = false;
    }

    function resumeJumpLatest() {
      if (!props.autoFollow) return;
      isFollowing.value = true;
      pinToBottom();
      kickSettle();
    }

    // --- Lifecycle ---

    // Overlay scrollbar on the scrolling body (shared chrome). The body
    // mounts with the modal surface (shouldRender) and survives through
    // the leave transition; attach after the DOM lands, detach on close
    // and unmount so nothing leaks inside the Teleport portal.
    let bodyScrollbar: OverlayScrollbarHandle | null = null;

    function detachBodyScrollbar(): void {
      bodyScrollbar?.detach();
      bodyScrollbar = null;
    }

    watch(shouldRender, (render) => {
      if (render) {
        void nextTick(() => {
          if (!shouldRender.value || !scrollContainerRef.value) return;
          detachBodyScrollbar();
          bodyScrollbar = attachOverlayScrollbars(scrollContainerRef.value, { axis: "vertical" });
        });
      } else {
        detachBodyScrollbar();
      }
    });

    watch(
      () => props.modelValue,
      (val) => {
        if (unmounted) return;
        if (val) {
          previouslyFocused = document.activeElement as HTMLElement | null;
          if (handle.value) {
            manager.unregister(handle.value.id);
          }
          shouldRender.value = true;
          handle.value = manager.register("modal", true, props.title);
          overlay.open();
          if (backGuardEnabled() && backGuard.entries === 0) {
            backGuard.push();
          }
        } else {
          // Close happens via Transition onAfterLeave,
          // but if modelValue flips to false without Transition
          // (e.g. immediate), clean up now.
          overlay.close();
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
      teardownWindowed();
      teardownAutoFollow();
      backGuard.destroy();
      if (handle.value) {
        manager.unregister(handle.value.id);
        handle.value = null;
      }
      shouldRender.value = false;
    });

    // --- Render helpers ---

    function renderFooter() {
      if (slots.footer) {
        return <div class="hk-modal-footer">{slots.footer()}</div>;
      }
      if (props.footerActions && props.footerActions.length > 0) {
        return (
          <div class="hk-modal-footer">
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
      return null;
    }

    return () => {
      if (!shouldRender.value) return null;

      const headerShown = props.title || props.closable || slots.header;

      return (
        <Teleport to="body">
          <div
            class="hk-modal-root"
            style={{ zIndex: overlayZ.value }}
            onKeydown={onKeydown}
          >
            <Transition name="hk-modal-overlay" appear>
              {props.modelValue && (
                <div
                  class="hk-modal-overlay"
                  onClick={onOverlayClick}
                />
              )}
            </Transition>
            <Transition
              name="hk-modal-content"
              appear
              onAfterEnter={onAfterEnter}
              onAfterLeave={onAfterLeave}
            >
              {props.modelValue && (
                <div
                  ref={contentRef}
                  class="hk-modal-content"
                  role="dialog"
                  aria-modal="true"
                  aria-label={props.title}
                  style={{
                    maxWidth: resolvedWidth.value,
                    zIndex: contentZ.value,
                  }}
                  onClick={onContentClick}
                  tabindex={-1}
                >
                  {headerShown && (
                    <>
                      <div class="hk-modal-header">
                        <h2 class="hk-modal-title">
                          {slots.header ? (props.title ?? "") : (props.title ?? "")}
                        </h2>
                        {props.closable && (
                          <button
                            class="hk-modal-close"
                            aria-label={t("hikari::modal.close", "Close")}
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
                        )}
                      </div>
                      {slots.header && (
                        <div class="hk-modal-subheader">{slots.header()}</div>
                      )}
                    </>
                  )}
                  <div ref={bodyRef} class="hk-modal-body">
                    <div
                      ref={scrollContainerRef}
                      class="hk-modal-body-scroll"
                      onScroll={onBodyScroll}
                    >
                      <div class="hk-modal-body-inner">
                        {props.windowed
                          ? renderWindowedBody()
                          : slots.default?.()}
                      </div>
                    </div>
                    {props.autoFollow && (
                      <>
                        {/* "Auto" marks ACTIVE follow: pinned at bottom
                            with a body that overflows. Cancelled follow
                            swaps it for the jump-back FAB instead. */}
                        {hasOverflow.value && isFollowing.value && (
                          <span
                            class="hk-modal-autofollow-tag"
                            aria-hidden="true"
                          >
                            {t("hikari::modal.auto", "Auto")}
                          </span>
                        )}
                        {!isFollowing.value && (
                          <HFab
                            class="hk-modal-jump"
                            positioning="absolute"
                            corner="bottom-right"
                            icon="ArrowDown"
                            ariaLabel={t("hikari::modal.jumpToLatest", "Back to latest")}
                            onClick={resumeJumpLatest}
                          />
                        )}
                      </>
                    )}
                  </div>
                  {renderFooter()}
                </div>
              )}
            </Transition>
          </div>
        </Teleport>
      );
    };

    function renderWindowedBody() {
      const children = slots.default?.();
      if (!children) return null;

      const arr = Array.isArray(children) ? children : [children];

      return arr.map((child, i) => (
        <div
          key={i}
          data-hk-windowed={String(i)}
          style={{ minHeight: "1px" }}
        >
          {visibleIndices.value.has(i) || i === 0 || i === arr.length - 1
            ? child
            : <div style={{ height: "1em" }} />}
        </div>
      ));
    }
  },
});
