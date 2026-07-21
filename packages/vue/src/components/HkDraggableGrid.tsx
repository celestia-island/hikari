import { defineComponent, onBeforeUnmount, ref, shallowRef, watch, type PropType } from "vue";
import { onceFrame } from "../runtime/animationBus";
import { useReportedTransition } from "../composables/useReportedTransition";
import "./HkDraggableGrid.scss";

const MAX_COLS = 3;

export interface GridItem {
  key: string;
  locked?: boolean;
  [k: string]: unknown;
}

export interface GridCellAddress {
  row: number;
  col: number;
}

interface DragState {
  from: GridCellAddress;
  placeholder: GridCellAddress;
  grabOffsetX: number;
  grabOffsetY: number;
}

export default defineComponent({
  name: "HkDraggableGrid",
  props: {
    rows: { type: Array as PropType<GridItem[][]>, required: true },
    lockedKeys: { type: Array as PropType<string[]>, default: () => [] },
  },
  emits: {
    reorder: (_from: GridCellAddress, _to: GridCellAddress) => true,
  },
  setup(props, { emit, slots }) {
    function isLocked(key: string): boolean {
      return props.lockedKeys.includes(key);
    }

    const drag = shallowRef<DragState | null>(null);
    const tick = ref(0);
    const rowEls = ref<(HTMLElement | null)[]>([]);
    const cellEls = ref<(HTMLElement | null)[][]>([]);

    function setRowEl(row: number, el: Element | null) {
      rowEls.value[row] = (el as HTMLElement | null) ?? null;
    }
    function setCellEl(row: number, col: number, el: Element | null) {
      if (!cellEls.value[row]) cellEls.value[row] = [];
      cellEls.value[row][col] = (el as HTMLElement | null) ?? null;
    }

    let ghostNode: HTMLElement | null = null;

    const anim = useReportedTransition(250);

    function bump() { tick.value++; }

    watch(
      () => props.rows,
      (rows) => {
        rowEls.value = rowEls.value.slice(0, rows.length);
        cellEls.value = cellEls.value.slice(0, rows.length);
      },
      { deep: true },
    );

    // ── Drag lifecycle ──

    function onPointerDown(e: PointerEvent, row: number, col: number, item: GridItem) {
      if (e.button !== 0) return;
      if (isLocked(item.key)) return;
      const handle = (e.currentTarget as HTMLElement);
      const isHandle = handle.classList.contains("hk-draggable-grid-handle");
      if (!isHandle) {
        const target = e.target as HTMLElement | null;
        if (target && target.closest("button, a, input, textarea, select, [contenteditable]")) {
          return;
        }
      }

      const cell = cellEls.value[row]?.[col];
      if (!cell) return;

      e.preventDefault();
      const rect = cell.getBoundingClientRect();

      const snapshot = cell.outerHTML
        .replace(/\sdraggable="[^"]*"/g, "")
        .replace(/\sdata-dragging="[^"]*"/g, "");

      const state: DragState = {
        from: { row, col },
        placeholder: { row, col },
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
      node.className = "hk-draggable-grid-ghost";
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

    function moveGhost(clientX: number, clientY: number) {
      const s = drag.value;
      if (!s || !ghostNode) return;
      const gx = clientX - s.grabOffsetX;
      const gy = clientY - s.grabOffsetY;
      ghostNode.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
    }

    function sameAddress(a: GridCellAddress, b: GridCellAddress): boolean {
      return a.row === b.row && a.col === b.col;
    }

    function recomputePlaceholder(clientX: number, clientY: number) {
      const s = drag.value;
      if (!s) return;
      const rows = props.rows;

      let row = -1;
      for (let r = 0; r < rows.length; r++) {
        const el = rowEls.value[r];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (clientY < midY) { row = r; break; }
        row = r;
      }
      if (row === -1) row = s.from.row;

      const cells = rows[row] ?? [];

      const isFull = cells.length >= MAX_COLS;
      const sourceInThisRow = s.from.row === row;
      if (isFull && !sourceInThisRow) {
        const target = { row: row + 1, col: 0 };
        if (!sameAddress(target, s.placeholder)) {
          s.placeholder = target;
          bump();
          anim.run();
        }
        return;
      }

      let col = cells.length;
      for (let c = 0; c < cells.length; c++) {
        const el = cellEls.value[row]?.[c];
        if (!el) continue;
        if (sourceInThisRow && c === s.from.col) continue;
        const rect = el.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        if (clientX < midX) { col = c; break; }
      }

      const target = { row, col };
      if (!sameAddress(target, s.placeholder)) {
        s.placeholder = target;
        bump();
        anim.run();
      }
    }

    function onPointerMove(e: PointerEvent) {
      const s = drag.value;
      if (!s) return;
      e.preventDefault();
      moveGhost(e.clientX, e.clientY);
      recomputePlaceholder(e.clientX, e.clientY);
    }

    function onPointerUp() {
      const s = drag.value;
      window.removeEventListener("pointermove", onPointerMove);

      if (s && !sameAddress(s.from, s.placeholder)) {
        emit("reorder", s.from, s.placeholder);
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

      const phRow = s?.placeholder.row;
      const phCol = s?.placeholder.col;

      return (
        <div class="hk-draggable-grid" data-dragging={s ? "" : undefined}>
          {props.rows.map((cells, row) => {
            const cols = Math.max(1, cells.length);
            const isPhRowAfter = s != null && phRow === row && phCol != null && phCol >= cells.length;
            return (
              <div
                key={row}
                ref={(el) => setRowEl(row, el as Element | null)}
                class="hk-draggable-grid-row"
                data-cols={cols}
                data-placeholder-row={isPhRowAfter ? "after" : undefined}
                style={{ "--hk-grid-cols": cols }}
              >
                {cells.map((item, col) => {
                  const locked = isLocked(item.key);
                  const isSource = s != null && s.from.row === row && s.from.col === col;
                  const isPhBefore = s != null && phRow === row && phCol === col && !isSource;
                  return (
                    <div
                      key={item.key}
                      ref={(el) => setCellEl(row, col, el as Element | null)}
                      class="hk-draggable-grid-cell"
                      data-locked={locked || undefined}
                      data-dragging={isSource || undefined}
                      data-placeholder={isPhBefore ? "before" : undefined}
                      onPointerdown={(e: PointerEvent) => onPointerDown(e, row, col, item)}
                    >
                      <span
                        class="hk-draggable-grid-handle"
                        data-hidden={locked || undefined}
                        onPointerdown={(e: PointerEvent) => {
                          e.stopPropagation();
                          onPointerDown(e, row, col, item);
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
                      <div class="hk-draggable-grid-content">
                        {slots.cell?.({ item, row, col, locked })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {s != null && phRow != null && phRow >= props.rows.length && (
            <div class="hk-draggable-grid-row hk-draggable-grid-row--phantom" data-cols={1}>
              <div class="hk-draggable-grid-cell hk-draggable-grid-cell--placeholder-target" />
            </div>
          )}
        </div>
      );
    };
  },
});
