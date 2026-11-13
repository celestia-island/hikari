// AI-generated: developed with the DeepSeek Harness agent (model GLM-5.3 Flash); human-directed.

/**
 * HkDebugFloat — a generic debug floating window.
 *
 * Debug data (FPS, tick counters, cache stats, …) keeps leaking into
 * product chrome — the founding incident is shittim-chest's holographic
 * panel, whose global header carried a raw "60 FPS" chip (cut in chest
 * PR #2517). This component is the upstream, panel-independent home for
 * that data: a viewport-fixed, body-level window a host mounts ONCE and
 * feeds arbitrary debug content through the default slot.
 *
 * Design contract:
 * - **Body-level overlay.** Teleported to `<body>` directly — never
 *   inside any panel/layout DOM, and deliberately NOT into
 *   `#hk-overlay-root`: the debug window is not a functional popup, it
 *   must not join the popup manager's bands or the fenced z space. It
 *   paints at `--hk-z-debug-float` (default 80000) — above every
 *   content-chrome rung, strictly below the overlay root (90000), so
 *   every modal/toast/tooltip a user opens still wins over it.
 * - **Hover → yield (the wowsp HUD idiom).** Pointer over the window
 *   fades it to `hoverOpacity` (default 0.45, ~150ms opacity-only
 *   transition); leaving restores full opacity. While DRAGGING the
 *   window stays opaque — fading mid-grab hides what the hand holds.
 * - **Drag anywhere on the header**, pointer-captured, clamped to the
 *   viewport (`clampDebugFloatPosition`); on drop the position persists.
 * - **Close (×)** emits `update:open` (v-model:open) and persists the
 *   closed state. With `persistKey` set, open-state and dragged position
 *   round-trip via localStorage under `hk-debug-float:<key>`; reopening
 *   restores both.
 * - The window intercepts pointers ONLY on its own box (no backdrop,
 *   no inset-0 overlay) — clicks outside it always reach the page.
 */
import { X } from "lucide-vue-next";
import {
  computed,
  defineComponent,
  nextTick,
  onMounted,
  ref,
  Teleport,
  watch,
  type CSSProperties,
  type PropType,
} from "vue";

import HIconButton from "./HkIconButton";
import {
  clampDebugFloatPosition,
  debugFloatPersistedPosition,
  HK_DEBUG_FLOAT_DOCUMENT_Z,
  readDebugFloatPersisted,
  writeDebugFloatPersisted,
  type HkDebugFloatCorner,
} from "./debugFloat";
import { useI18n } from "../i18n/context";
import "./HkDebugFloat.scss";

interface DragStart {
  px: number;
  py: number;
  x: number;
  y: number;
}

export default defineComponent({
  name: "HkDebugFloat",
  props: {
    /** v-model:open. Controlled when bound; leave undefined to let the
     *  window own the state (persisted value first, then defaultOpen). */
    open: { type: Boolean, default: undefined },
    /** Header text; falls back to the localized debug label ("DEBUG"). */
    title: { type: String, default: undefined },
    /** Viewport corner to anchor to until the window is dragged. */
    position: { type: String as PropType<HkDebugFloatCorner>, default: "bottom-right" },
    /** Distance from the anchored viewport edges, px. */
    offset: { type: Number, default: 16 },
    /** Window width, px. */
    width: { type: Number, default: 280 },
    /** Opacity the window fades to while hovered, 0..1. */
    hoverOpacity: { type: Number, default: 0.45 },
    /** Uncontrolled initial open state (superseded by any persisted one). */
    defaultOpen: { type: Boolean, default: true },
    /** When set: open-state + position persist under
     *  `hk-debug-float:<persistKey>` and restore on remount. */
    persistKey: { type: String, default: undefined },
    /** Document-space z-index. The default band stays below every
     *  functional hikari popup (see debugFloat.ts). */
    zIndex: { type: Number, default: HK_DEBUG_FLOAT_DOCUMENT_Z },
  },
  emits: {
    "update:open": (_open: boolean) => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();

    const titleText = computed(() => props.title ?? t("hikari::debugFloat.title", "DEBUG"));

    // -- persistence (read once at setup; re-read when the key changes) --
    const readPersisted = () =>
      props.persistKey ? readDebugFloatPersisted(props.persistKey) : null;

    // -- open: controlled v-model:open over an uncontrolled fallback --
    const initialPersisted = readPersisted();
    const internalOpen = ref(initialPersisted ? initialPersisted.open : props.defaultOpen);
    const isOpen = computed(() => props.open ?? internalOpen.value);

    // -- dragged position: null until the first grab; corner CSS anchors
    //    the window until then, and a persisted position short-circuits it --
    const dragPos = ref<{ x: number; y: number } | null>(
      initialPersisted ? debugFloatPersistedPosition(initialPersisted) : null,
    );
    const dragging = ref(false);
    const hovered = ref(false);
    const windowEl = ref<HTMLElement>();
    const headerEl = ref<HTMLElement>();
    let dragStart: DragStart | null = null;

    /** Best-effort persistence — the new open value is passed in because
     *  under a controlled v-model the prop (and thus isOpen) only flips
     *  after the parent round-trips the emitted update. */
    function persistState(open: boolean): void {
      if (!props.persistKey) return;
      const pos = dragPos.value;
      writeDebugFloatPersisted(props.persistKey, {
        open,
        ...(pos ? { x: pos.x, y: pos.y } : {}),
      });
    }

    /** Re-clamp a restored position against the RENDERED box (the width
     *  prop alone would mis-clamp on auto-grown bodies) and viewport. */
    function reclampToViewport(): void {
      const el = windowEl.value;
      const pos = dragPos.value;
      if (!el || !pos) return;
      dragPos.value = clampDebugFloatPosition(
        pos.x,
        pos.y,
        el.offsetWidth,
        el.offsetHeight,
        window.innerWidth,
        window.innerHeight,
      );
    }

    function setOpen(open: boolean): void {
      internalOpen.value = open;
      emit("update:open", open);
      persistState(open);
    }

    // -- drag (header handle) --
    function onHeaderPointerDown(e: PointerEvent): void {
      // Primary button only; interactive chrome in the header (the
      // close button) keeps its own pointer semantics.
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
      const el = windowEl.value;
      if (!el) return;
      e.preventDefault();
      // Corner-anchored windows take their CSS-resolved spot as the
      // drag origin: position:fixed makes the rect viewport-true.
      const rect = el.getBoundingClientRect();
      const origin = dragPos.value ?? { x: rect.left, y: rect.top };
      dragStart = { px: e.clientX, py: e.clientY, x: origin.x, y: origin.y };
      dragging.value = true;
      // Capture keeps live moves flowing while the pointer leaves the
      // handle. A synthetic pointer (tests, some engines) has no active
      // pointer id and the capture call may reject per spec — a failed
      // capture must never kill the grab: moves land on the handle
      // anyway, which is the plain no-capture semantic.
      try {
        headerEl.value?.setPointerCapture?.(e.pointerId);
      } catch {
        // No active pointer for the id — dragging continues un-captured.
      }
    }

    function onHeaderPointerMove(e: PointerEvent): void {
      if (!dragStart) return;
      // Re-check the press: a hover with no button held (or a stale
      // start after a mid-drag close) must never move the window.
      if (e.buttons === 0) {
        dragStart = null;
        dragging.value = false;
        return;
      }
      const el = windowEl.value;
      if (!el) return;
      dragPos.value = clampDebugFloatPosition(
        dragStart.x + (e.clientX - dragStart.px),
        dragStart.y + (e.clientY - dragStart.py),
        el.offsetWidth,
        el.offsetHeight,
        window.innerWidth,
        window.innerHeight,
      );
    }

    function endDrag(): void {
      if (!dragStart) return;
      dragStart = null;
      dragging.value = false;
      persistState(isOpen.value);
    }

    // -- hover → yield --
    function onPointerEnter(): void {
      hovered.value = true;
    }

    function onPointerLeave(): void {
      hovered.value = false;
    }

    // A restored position clamps once the real box is measurable.
    onMounted(() => {
      void nextTick(reclampToViewport);
    });

    // Switching keys re-reads storage and re-syncs both channels.
    watch(
      () => props.persistKey,
      () => {
        const persisted = readPersisted();
        internalOpen.value = persisted ? persisted.open : props.defaultOpen;
        dragPos.value = persisted ? debugFloatPersistedPosition(persisted) : null;
        if (persisted) void nextTick(reclampToViewport);
      },
    );

    return () => {
      if (!isOpen.value) return null;
      const style: Record<string, string> = {
        width: `${props.width}px`,
        zIndex: String(props.zIndex),
        "--hk-debug-float-hover-opacity": String(props.hoverOpacity),
        "--hk-debug-float-offset": `${props.offset}px`,
      };
      // A dragged/persisted position pins the top-left corner in px;
      // the corner insets must yield to it entirely.
      if (dragPos.value) {
        style.left = `${dragPos.value.x}px`;
        style.top = `${dragPos.value.y}px`;
        style.right = "auto";
        style.bottom = "auto";
      }
      return (
        // Directly to <body> — NOT into #hk-overlay-root: this window
        // is not a functional popup (no popup-manager band, no scroll
        // lock, no breadcrumb) and must paint BELOW the whole fenced
        // popup tree, which only a document-space z can do.
        <Teleport to="body">
          <div
            ref={windowEl}
            class="hk-debug-float"
            data-corner={props.position}
            data-hovered={hovered.value ? "" : undefined}
            data-dragging={dragging.value ? "" : undefined}
            role={titleText.value ? "group" : undefined}
            aria-label={titleText.value || undefined}
            style={style as CSSProperties}
            onPointerenter={onPointerEnter}
            onPointerleave={onPointerLeave}
          >
            <div
              ref={headerEl}
              data-el="header"
              onPointerdown={onHeaderPointerDown}
              onPointermove={onHeaderPointerMove}
              onPointerup={endDrag}
              onPointercancel={endDrag}
            >
              <span data-el="title">{slots.title ? slots.title() : titleText.value}</span>
              <HIconButton
                class="hk-debug-float-close"
                size={24}
                variant="ghost"
                aria-label={t("hikari::alert.close", "Close")}
                onClick={() => setOpen(false)}
              >
                {{ icon: () => <X aria-hidden="true" /> }}
              </HIconButton>
            </div>
            <div data-el="body">{slots.default?.()}</div>
          </div>
        </Teleport>
      );
    };
  },
});
