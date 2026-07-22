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
import "./HkModal.scss";
import { useOverlay } from "../runtime/useOverlay";
import { usePopupManager } from "../runtime/usePopupManager";
import HkButton from "./HkButton";
import HkSpinner from "./HkSpinner";

export interface ModalAction {
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapFocus(container: HTMLElement, e: KeyboardEvent): void {
  const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

function focusFirst(container: HTMLElement): void {
  const el = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  if (el) el.focus();
}

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
  },
  emits: {
    "update:modelValue": (_value: boolean) => true,
    afterLeave: () => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useHikariI18n();
    const manager = usePopupManager();
    const overlay = useOverlay({ name: "hk-modal" });

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
    let userScrolled = false;
    const scrollContainerRef = ref<HTMLElement>();

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

    function scrollToBottom(smooth = false) {
      const el = scrollContainerRef.value;
      if (!el) return;
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? "smooth" : "instant" as ScrollBehavior,
      });
    }

    function onBodyScroll() {
      if (!props.autoFollow) return;
      const el = scrollContainerRef.value;
      if (!el) return;
      const threshold = 32;
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom > threshold) {
        userScrolled = true;
        isFollowing.value = false;
      } else {
        userScrolled = false;
        isFollowing.value = true;
      }
    }

    function setupAutoFollow() {
      if (!props.autoFollow || !scrollContainerRef.value) return;
      teardownAutoFollow();

      isFollowing.value = true;
      userScrolled = false;
      scrollToBottom(false);

      autoFollowMutationObserver = new MutationObserver(() => {
        if (isFollowing.value && !unmounted) {
          nextTick(() => scrollToBottom(true));
        }
      });

      autoFollowMutationObserver.observe(scrollContainerRef.value, {
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
      isFollowing.value = true;
      userScrolled = false;
    }

    function resumeAutoFollow() {
      if (!props.autoFollow) return;
      isFollowing.value = true;
      userScrolled = false;
      scrollToBottom(true);
    }

    // --- Lifecycle ---

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
        } else {
          // Close happens via Transition onAfterLeave,
          // but if modelValue flips to false without Transition
          // (e.g. immediate), clean up now.
        }
      },
      { immediate: true },
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
      teardownWindowed();
      teardownAutoFollow();
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
              <HkButton
                key={i}
                variant={action.variant ?? "secondary"}
                size="sm"
                loading={action.loading}
                disabled={action.disabled}
                onClick={action.onClick}
              >
                {action.label}
              </HkButton>
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
                            aria-label={t("hk.modal.close", "Close")}
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
                    {props.autoFollow && !isFollowing.value && (
                      <div
                        class="hk-modal-autofollow-bar"
                        onClick={resumeAutoFollow}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          width="14"
                          height="14"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                        <span>Auto</span>
                      </div>
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
