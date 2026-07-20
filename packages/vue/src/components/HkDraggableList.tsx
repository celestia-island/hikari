import { defineComponent, onBeforeUnmount, ref, shallowRef, type PropType } from "vue";
import { onceFrame } from "../runtime/animationBus";
import { useReportedTransition } from "../composables/useReportedTransition";
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
  grabOffsetX: number;
  grabOffsetY: number;
}

export default defineComponent({
  name: "HkDraggableList",
  props: {
    items: { type: Array as PropType<DragListItem[]>, required: true },
    lockedKeys: { type: Array as PropType<string[]>, default: () => [] },
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

    const anim = useReportedTransition(250);

    function bump() { tick.value++; }

    // ── Drag lifecycle ──

    function onPointerDown(e: PointerEvent, index: number, item: DragListItem) {
      if (e.button !== 0) return;
      if (isLocked(item.key)) return;

      const handle = (e.currentTarget as HTMLElement);
      const isHandle = handle.classList.contains("hk-draggable-list__handle");
      if (!isHandle) {
        const target = e.target as HTMLElement | null;
        if (target && target.closest("button, a, input, textarea, select, [contenteditable]")) {
          return;
        }
      }

      const row = rowEls.value[index];
      if (!row) return;

      e.preventDefault();
      const rect = row.getBoundingClientRect();

      const snapshot = row.outerHTML
        .replace(/\sdraggable="[^"]*"/g, "")
        .replace(/\sdata-dragging="[^"]*"/g, "");

      const state: DragState = {
        fromIndex: index,
        placeholderIndex: index,
        originX: e.clientX,
        grabOffsetX: e.clientX - rect.left,
        grabOffsetY: e.clientY - rect.top,
      };
      drag.value = state;
      bump();

      onceFrame(() => {
        if (!drag.value) return;
        attachGhost(rect, snapshot);
        anim.run();
      });

      window.addEventListener("pointermove", onPointerMove, { passive: false });
      window.addEventListener("pointerup", onPointerUp, { once: true });
      window.addEventListener("pointercancel", onPointerUp, { once: true });
    }

    function attachGhost(sourceRect: DOMRect, html: string) {
      detachGhost();
      const node = document.createElement("div");
      node.className = "hk-draggable-list__ghost";
      node.innerHTML = html;
      node.style.width = `${sourceRect.width}px`;
      node.style.transform = `translate3d(${sourceRect.left}px, ${sourceRect.top}px, 0)`;
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
      const gx = s.originX - s.grabOffsetX;
      const gy = clientY - s.grabOffsetY;
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
      const s = drag.value;
      if (!s) return;
      e.preventDefault();
      moveGhost(e.clientY);
      recomputePlaceholder(e.clientY);
    }

    function onPointerUp() {
      const s = drag.value;
      window.removeEventListener("pointermove", onPointerMove);

      if (s) {
        if (s.placeholderIndex !== s.fromIndex) {
          emit("reorder", s.fromIndex, s.placeholderIndex);
        }
      }
      anim.run();
      drag.value = null;
      bump();
      onceFrame(detachGhost);
    }

    onBeforeUnmount(() => {
      window.removeEventListener("pointermove", onPointerMove);
      detachGhost();
    });

    // ── Render ──

    return () => {
      void tick.value;
      const s = drag.value;
      return (
        <div class="hk-draggable-list" data-dragging={s ? "" : undefined}>
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
                class="hk-draggable-list__item"
                data-locked={locked || undefined}
                data-dragging={isSource || undefined}
                data-placeholder={placeholderDir || undefined}
                onPointerdown={(e: PointerEvent) => onPointerDown(e, index, item)}
              >
                <span
                  class="hk-draggable-list__handle"
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
                <div class="hk-draggable-list__content">
                  {slots.item?.({ item, index, locked })}
                </div>
              </div>
            );
          })}
        </div>
      );
    };
  },
});
