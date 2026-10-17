import { defineComponent, onBeforeUnmount, onMounted, ref, shallowRef, type PropType } from "vue";
import { onceFrame } from "../runtime/animationBus";
import { useReportedTransition } from "../composables/useReportedTransition";
import { ancestorZoom } from "../runtime/cssZoom";
import "./HkDraggableList.scss";

export interface DragListItem {
  key: string;
  locked?: boolean;
  [k: string]: unknown;
}

interface DragState {
  fromIndex: number;
  placeholderIndex: number;
  originX: number;
  originY: number;
  grabOffsetX: number;
  grabOffsetY: number;
}

/** Press-to-drag arm distance — a plain click on a row (or its handle)
 *  never starts a drag: the ghost only rises once the pointer moves past
 *  this many px, so a clickable row keeps its tap action and a jittered
 *  tap never flashes a ghost. */
const ARM_PX = 5;

/** How long after a drop the release click is still recognized as the
 *  drag's own click. Time-boxed (rather than a sticky flag) so a drag
 *  released off-window can never eat a later keyboard activation,
 *  which has no pointerdown to reset it. */
const SWALLOW_CLICK_MS = 300;

export default defineComponent({
  name: "HkDraggableList",
  props: {
    items: { type: Array as PropType<DragListItem[]>, required: true },
    /** Row keys that may not be dragged. A locked row hides its grip but
     *  keeps the handle lane reserved ([data-hidden]); when EVERY row is
     *  locked the root carries data-all-locked and the sheet collapses
     *  the lane entirely — the list cannot reorder at all. */
    lockedKeys: { type: Array as PropType<string[]>, default: () => [] },
    /** Accessible name for the list (aria-label on the role="list" root).
     *  The list semantics themselves are unconditional — a reorderable
     *  list is a list for AT users whether or not the host names it —
     *  mirroring the menu/vocabulary a11y rulings (#736/#737): chrome
     *  announces structure, the host supplies the name. */
    label: { type: String, default: undefined },
  },
  emits: {
    reorder: (_fromIndex: number, _toIndex: number) => true,
  },
  setup(props, { emit, slots }) {
    function isLocked(key: string): boolean {
      return props.lockedKeys.includes(key);
    }

    const drag = shallowRef<DragState | null>(null);
    const tick = ref(0);
    const rowEls = ref<(HTMLElement | null)[]>([]);

    function setRowEl(index: number, el: Element | null) {
      rowEls.value[index] = (el as HTMLElement | null) ?? null;
    }

    let ghostNode: HTMLElement | null = null;

    /** Press bookkeeping — captured at pointerdown, never read during
     *  render. `armed` flips only when the pointer crosses ARM_PX; until
     *  then the press is a plain click-in-progress (no ghost, no drag
     *  state, no preventDefault — the tap keeps its native semantics). */
    let press: {
      rect: DOMRect;
      snapshot: string;
      state: DragState;
      armed: boolean;
    } | null = null;
    /** Timestamp of an armed drag's release — the capture-phase click
     *  guard below eats the click a completed drag leaves behind (press
     *  + release on the same element), so dropping a row onto a
     *  clickable card never also activates that card. */
    let swallowClickAt = 0;

    const rootEl = ref<HTMLElement | null>(null);

    /** Capture-phase click guard — runs before any row content's own
     *  handlers (Vue's JSX typings have no onClickCapture attribute, so
     *  the listener is wired imperatively in onMounted). */
    function onRootClickCapture(e: MouseEvent) {
      if (Date.now() - swallowClickAt > SWALLOW_CLICK_MS) return;
      swallowClickAt = 0;
      e.preventDefault();
      e.stopPropagation();
    }

    onMounted(() => {
      rootEl.value?.addEventListener("click", onRootClickCapture, true);
    });

    const anim = useReportedTransition(250);

    function bump() { tick.value++; }

    // ── Drag lifecycle ──

    function onPointerDown(e: PointerEvent, index: number, item: DragListItem) {
      if (e.button !== 0) return;
      if (isLocked(item.key)) return;

      const handle = (e.currentTarget as HTMLElement);
      const isHandle = handle.classList.contains("hk-draggable-list-handle");
      if (!isHandle) {
        const target = e.target as HTMLElement | null;
        if (target && target.closest("button, a, input, textarea, select, [contenteditable]")) {
          return;
        }
      }

      const row = rowEls.value[index];
      if (!row) return;

      const rect = row.getBoundingClientRect();

      const snapshot = row.outerHTML
        .replace(/\sdraggable="[^"]*"/g, "")
        .replace(/\sdata-dragging="[^"]*"/g, "");

      // The press captures everything the arm needs. Nothing publishes
      // yet — no preventDefault either: the handle lane carries its own
      // touch-action:none and the rows are user-select:none, so a plain
      // tap keeps its native click/scroll semantics untouched.
      press = {
        rect,
        snapshot,
        state: {
          fromIndex: index,
          placeholderIndex: index,
          originX: e.clientX,
          originY: e.clientY,
          grabOffsetX: e.clientX - rect.left,
          grabOffsetY: e.clientY - rect.top,
        },
        armed: false,
      };

      window.addEventListener("pointermove", onPointerMove, { passive: false });
      window.addEventListener("pointerup", onPointerUp, { once: true });
      window.addEventListener("pointercancel", onPointerUp, { once: true });
    }

    function attachGhost(sourceRect: DOMRect, html: string) {
      detachGhost();
      const node = document.createElement("div");
      node.className = "hk-draggable-list-ghost";
      node.innerHTML = html;
      // The ghost is appended to <body> — inside any root CSS zoom
      // subtree — so its px are LOCAL while sourceRect (gBCR) reports the
      // root VISUAL space (standardized zoom applies ancestor zoom).
      // Divide at the write layer or the ghost paints zoom× too large and
      // zoom× off the pointer (chest's root-level manual DPI scale).
      const z = ancestorZoom(document.body);
      node.style.width = `${sourceRect.width / z}px`;
      node.style.transform = `translate3d(${sourceRect.left / z}px, ${sourceRect.top / z}px, 0)`;
      node.style.pointerEvents = "none";
      document.body.appendChild(node);
      ghostNode = node;
    }

    function detachGhost() {
      if (ghostNode) {
        ghostNode.remove();
        ghostNode = null;
      }
    }

    function moveGhost(clientY: number) {
      const s = drag.value;
      if (!s || !ghostNode) return;
      // gx/gy are the ghost's visual top-left (client coords minus the
      // visual grab offset); the teleported ghost paints local px scaled
      // by the cumulative zoom — divide once at the write layer.
      const z = ancestorZoom(document.body);
      const gx = (s.originX - s.grabOffsetX) / z;
      const gy = (clientY - s.grabOffsetY) / z;
      ghostNode.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
    }

    function recomputePlaceholder(clientY: number) {
      const s = drag.value;
      if (!s) return;
      const rows = rowEls.value;
      let target = s.fromIndex;
      let fallback = s.fromIndex;

      for (let i = 0; i < rows.length; i++) {
        if (i === s.fromIndex) continue;
        const item = props.items[i];
        if (!item || isLocked(item.key)) continue;
        const el = rows[i];
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        fallback = i;

        if (clientY < mid) {
          target = i;
          break;
        }
        target = i;
      }

      if (target === s.fromIndex && fallback !== s.fromIndex) {
        target = fallback;
      }

      if (target !== s.placeholderIndex) {
        s.placeholderIndex = target;
        bump();
        anim.run();
      }
    }

    function onPointerMove(e: PointerEvent) {
      const p = press;
      if (!p) return;

      if (!p.armed) {
        // Arm past the threshold: only now does the drag publish, the
        // ghost rise, and the gesture claim its defaults.
        if (Math.hypot(e.clientX - p.state.originX, e.clientY - p.state.originY) <= ARM_PX) {
          return;
        }
        p.armed = true;
        drag.value = p.state;
        bump();
        const { rect, snapshot } = p;
        onceFrame(() => {
          if (!drag.value) return;
          attachGhost(rect, snapshot);
          anim.run();
        });
      }

      e.preventDefault();
      moveGhost(e.clientY);
      recomputePlaceholder(e.clientY);
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);

      const s = drag.value;
      if (s) {
        // An armed drag's release lands as a click on the row the press
        // started from — mark it for the capture guard or every drop
        // onto a clickable card would also activate the card.
        swallowClickAt = Date.now();
        if (s.placeholderIndex !== s.fromIndex) {
          emit("reorder", s.fromIndex, s.placeholderIndex);
        }
      }
      press = null;
      anim.run();
      drag.value = null;
      bump();
      onceFrame(detachGhost);
    }

    onBeforeUnmount(() => {
      rootEl.value?.removeEventListener("click", onRootClickCapture, true);
      window.removeEventListener("pointermove", onPointerMove);
      detachGhost();
    });

    // ── Render ──

    return () => {
      void tick.value;
      const s = drag.value;
      // A list whose every row is locked can never reorder (chest's 2FA
      // factor list is the all-locked case), and an all-hidden lane reads
      // as "missing grips" rather than "locked" (user report 2026-10-11).
      // Mark the root so the sheet can collapse the lane outright; mixed
      // lists keep it on every row for grip-column alignment.
      const allLocked =
        props.items.length > 0 && props.items.every((item) => isLocked(item.key));
      return (
        <div
          ref={rootEl}
          class="hk-draggable-list"
          role="list"
          aria-label={props.label || undefined}
          data-dragging={s ? "" : undefined}
          data-all-locked={allLocked || undefined}
        >
          {props.items.map((item, index) => {
            const locked = isLocked(item.key);
            const isSource = s != null && s.fromIndex === index;
            const placeholderDir =
              s != null && !isSource && s.placeholderIndex === index
                ? (s.placeholderIndex < s.fromIndex ? "before" : "after")
                : null;
            return (
              <div
                key={item.key}
                ref={(el) => setRowEl(index, el as Element | null)}
                class="hk-draggable-list-item"
                role="listitem"
                data-locked={locked || undefined}
                data-dragging={isSource || undefined}
                data-placeholder={placeholderDir || undefined}
                onPointerdown={(e: PointerEvent) => onPointerDown(e, index, item)}
              >
                <span
                  class="hk-draggable-list-handle"
                  data-hidden={locked || undefined}
                  onPointerdown={(e: PointerEvent) => {
                    e.stopPropagation();
                    onPointerDown(e, index, item);
                  }}
                >
                  {slots.handle ? slots.handle() : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                      <circle cx="4" cy="3" r="1.2" />
                      <circle cx="4" cy="7" r="1.2" />
                      <circle cx="4" cy="11" r="1.2" />
                      <circle cx="10" cy="3" r="1.2" />
                      <circle cx="10" cy="7" r="1.2" />
                      <circle cx="10" cy="11" r="1.2" />
                    </svg>
                  )}
                </span>
                <div class="hk-draggable-list-content">
                  {slots.item?.({ item, index, locked })}
                </div>
                {/* The standard row-actions lane: when the host provides
                 * an `actions` slot, every row renders this right-pinned
                 * lane (the content lane keeps flex: 1, so the buttons
                 * land on the row's far edge structurally — hosts stop
                 * hand-rolling ml-auto/flex-1 spacers). The lane is
                 * host-decided content: locked rows may still carry
                 * actions (chest's pricing ladder), so locked-ness is
                 * only reported through the slot scope. */}
                {slots.actions ? (
                  <div class="hk-draggable-list-actions">
                    {slots.actions({ item, index, locked })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      );
    };
  },
});
