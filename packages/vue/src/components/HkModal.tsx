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
import { useSurfaceTransition } from "../composables/useSurfaceTransition";
import { useSizeMorph } from "../composables/useSizeMorph";
import HButton from "./HkButton";
import HFab from "./HkFab";
import HSpinner from "./HkSpinner";
import HIconButton from "./HkIconButton";
import HIcon from "./HkIcon";
import "./window-close.scss";

export interface ModalAction {
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

/**
 * Named width presets for the `width` prop. Callers kept reaching for
 * semantic sizes (`width="sm"`) which, passed through as raw CSS
 * `max-width`, are silently dropped by the browser — the frame fell back
 * to `width: 100%` and spanned the whole viewport (chest #662-era change
 * password modal rendered 2048px wide). Named values now resolve here;
 * anything else keeps passing through as a CSS max-width value.
 */
export const MODAL_WIDTH_PRESETS = {
  xs: "20rem",
  sm: "32rem",
  md: "40rem",
  lg: "56rem",
  xl: "72rem",
} as const;

export type ModalWidthPreset = keyof typeof MODAL_WIDTH_PRESETS;

/**
 * `width` accepts a named preset or any CSS max-width value. The
 * `(string & {})` arm keeps preset autocomplete in TSX while still
 * allowing arbitrary lengths ("32rem", "560px", "50%").
 */
export type ModalWidth = ModalWidthPreset | (string & {});

const warnedWidths = new Set<string>();
/** Dev-only warn-once memory cap: a session feeding dynamically generated
 *  garbage widths must not grow the set forever. Prod never reaches this
 *  code (DEV is statically false there). */
const MAX_WARNED_WIDTHS = 50;

/** Valid digit-free CSS max-width keywords: the browser honors these, so
 *  the "would span the viewport" dev warn must stay silent for them. */
const WIDTH_KEYWORDS = new Set([
  "auto",
  "none",
  "min-content",
  "max-content",
  "fit-content",
]);

/**
 * Resolve the `width` prop to a concrete CSS max-width value: presets map
 * through `MODAL_WIDTH_PRESETS`, everything else passes through untouched.
 * In dev, a value that is neither a preset, a keyword, nor a length (no
 * digit anywhere — e.g. a stray token like `"wide"`) warns once: as a raw
 * max-width it would be dropped by the browser and the modal would span
 * the viewport.
 */
export function resolveModalWidth(width: string): string {
  // Coerce defensively: a JS consumer passing width={560} skips the prop
  // type check at runtime and Vue would have rendered the number as px.
  const value = String(width);
  // hasOwnProperty.call instead of Object.hasOwn (ES2022): the package
  // ships TS source, so consumers' bundlers will not polyfill new
  // built-ins — this must not raise the runtime floor. The own-property
  // guard is what keeps inherited members ("constructor", "toString")
  // from resolving as presets past the dev warn.
  const key = value.trim();
  const preset = Object.prototype.hasOwnProperty.call(MODAL_WIDTH_PRESETS, key)
    ? MODAL_WIDTH_PRESETS[key as ModalWidthPreset]
    : undefined;
  if (preset !== undefined) return preset;
  if (
    import.meta.env?.DEV &&
    !/\d/.test(value) &&
    !WIDTH_KEYWORDS.has(key) &&
    warnedWidths.size < MAX_WARNED_WIDTHS &&
    !warnedWidths.has(value)
  ) {
    warnedWidths.add(value);
    console.warn(
      `[HkModal] width "${value}" is neither a named preset (${Object.keys(MODAL_WIDTH_PRESETS).join("/")}) nor a CSS length — the browser would drop it and the modal would span the viewport.`,
    );
  }
  return value;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';


export default defineComponent({
  name: "HkModal",
  props: {
    modelValue: { type: Boolean, required: true },
    title: { type: String, default: undefined },
    closable: { type: Boolean, default: true },
    /** Named preset ("xs"…"xl") or any CSS max-width value (see ModalWidth). */
    width: { type: String as PropType<ModalWidth>, default: "32rem" },
    /**
     * Escape hatch: extra class appended to the .hk-modal-content frame
     * so hosts can restyle the surface without forking the modal (e.g.
     * the image lightbox's immersive layout override).
     */
    contentClass: { type: String, default: undefined },
    /**
     * Accessible name for header-less surfaces: names the popup-manager
     * layer (breadcrumb) and the dialog's aria-label without rendering
     * a header. Titleless chrome-only modals (the image lightbox) pass
     * an i18n-resolved string here to stay named and warning-free.
     * Takes precedence over `title` everywhere: when both are passed,
     * later `title` changes no longer reach the layer/aria naming.
     */
    surfaceTitle: { type: String, default: undefined },
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
    // Open/close motion reported into the unified animation context
    // (animationBus) — scrim and content on separate tracks so each
    // layer's report arms/cancels independently.
    const surf = useSurfaceTransition(320);
    const overlayHooks = surf.hooks("overlay");
    const contentHooks = surf.hooks("content");
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
    /** Natural-height probe inside the scroll container: the body's
     *  content wrapper, whose height is the content's intrinsic height
     *  regardless of scroll — the size morph measures this (see
     *  useSizeMorph). */
    const innerRef = ref<HTMLElement>();
    // Content-driven size morphing: the frame follows content growth with
    // the height transition instead of snapping (see useSizeMorph).
    const morph = useSizeMorph(contentRef, innerRef);
    const shouldRender = ref(false);
    let previouslyFocused: HTMLElement | null = null;
    let unmounted = false;

    const overlayZ = computed(() => handle.value?.zIndex ?? 0);
    const contentZ = computed(() => (handle.value?.zIndex ?? 0) + 1);
    const resolvedWidth = computed(() => resolveModalWidth(props.width));
    // Layer/dialog name: the explicit surface name wins over the header
    // title (which header-less surfaces never pass).
    const resolvedSurfaceName = computed(() => props.surfaceTitle ?? props.title);

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
          // Windows always block, so the kind alone lists this layer in
          // the modal-stack breadcrumb on every form factor.
          handle.value = manager.register("modal", true, resolvedSurfaceName.value);
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
      resolvedSurfaceName,
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

      const headerShown = props.title || props.closable || slots.header || slots.headerLead;

      return (
        <Teleport to="body">
          <div
            class="hk-modal-root"
            style={{ zIndex: overlayZ.value }}
            onKeydown={onKeydown}
          >
            <Transition
              name="hk-modal-overlay"
              appear
              onBeforeEnter={overlayHooks.onBeforeEnter}
              onAfterEnter={overlayHooks.onAfterEnter}
              onBeforeLeave={overlayHooks.onBeforeLeave}
              onAfterLeave={overlayHooks.onAfterLeave}
            >
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
              onBeforeEnter={contentHooks.onBeforeEnter}
              onAfterEnter={() => {
                contentHooks.onAfterEnter();
                onAfterEnter();
                // Size morphs arm once the open choreography finished —
                // pinning during enter would override its height reveal.
                morph.start();
              }}
              onBeforeLeave={() => {
                contentHooks.onBeforeLeave();
                // Release the pinned height so the leave owns the frame.
                morph.stop();
              }}
              onAfterLeave={() => {
                contentHooks.onAfterLeave();
                onAfterLeave();
              }}
            >
              {props.modelValue && (
                <div
                  ref={contentRef}
                  class={["hk-modal-content", props.contentClass]}
                  role="dialog"
                  aria-modal="true"
                  aria-label={resolvedSurfaceName.value}
                  style={{
                    maxWidth: resolvedWidth.value,
                    zIndex: contentZ.value,
                  }}
                  onClick={onContentClick}
                  tabindex={-1}
                >
                  {headerShown && (
                    <>
                      <div
                        class={[
                          "hk-modal-header",
                          slots.headerLead ? "hk-modal-header--lead" : "",
                        ]}
                      >
                        {slots.headerLead && (
                          <div class="hk-modal-header-lead">{slots.headerLead()}</div>
                        )}
                        <h2 class="hk-modal-title">
                          {slots.header ? (props.title ?? "") : (props.title ?? "")}
                        </h2>
                        {props.closable && (
                          // Unified window-close affordance: the shared
                          // icon button + registry X glyph (see
                          // window-close.scss) — no per-component ✕ SVG.
                          // `hk-modal-close` stays as the placement hook.
                          <HIconButton
                            class="hk-window-close hk-modal-close"
                            size={32}
                            variant="ghost"
                            aria-label={t("hikari::modal.close", "Close")}
                            onClick={close}
                          >
                            <HIcon name="close" size={16} />
                          </HIconButton>
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
                      <div ref={innerRef} class="hk-modal-body-inner">
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
