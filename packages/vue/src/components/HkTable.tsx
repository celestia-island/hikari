import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";

import { useI18n } from "../i18n/context";
import { usePointerReorder } from "../composables/usePointerReorder";
import { useReportedTransition } from "../composables/useReportedTransition";
import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";
import { onceFrame } from "../runtime/animationBus";
import { scheduleCronAfter, type CronHandle } from "../runtime/cronBus";
import { ancestorZoom } from "../runtime/cssZoom";
import "./HkTable.scss";

interface Column {
  key: string;
  title: string;
  width?: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
}

/** Duration of every drag motion this component paints: the arrangement
 *  shift (placeholder onto the resolved slot, neighbours gliding across)
 *  and the ghost's settle fade on release. One number so the transition
 *  the user sees and the animation window reported to the shared bus
 *  (useReportedTransition) cannot drift apart. */
const DRAG_SHIFT_MS = 150;

export default defineComponent({
  name: "HkTable",
  props: {
    columns: { type: Array as PropType<Column[]>, required: true },
    rows: { type: Array as PropType<Record<string, unknown>[]>, required: true },
    rowKey: { type: String, default: undefined },
    caption: { type: String, default: undefined },
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
    bordered: { type: Boolean, default: false },
    striped: { type: Boolean, default: false },
    hover: { type: Boolean, default: false },
    sortable: { type: Boolean, default: false },
    selectable: { type: Boolean, default: false },
    /** Left grip column with pointer drag-to-reorder (and ArrowUp/Down on a
     *  focused handle). The emitted indices are indices into `rows` — the
     *  consumer applies `moveTo(rows, from, to)`. While a column sort is
     *  active the displayed arrangement is derived, so two indices cannot
     *  faithfully encode the visual move: reordering is INERT until the
     *  sort is cleared (the handles render dimmed and refuse presses). */
    draggable: { type: Boolean, default: false },
    emptyText: { type: String, default: "" },
  },
  emits: {
    "update:selectedRows": (_rows: Record<string, unknown>[]) => true,
    reorder: (_fromIndex: number, _toIndex: number) => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const sortKey = ref<string | null>(null);
    const sortDirection = ref<"asc" | "desc">("asc");
    const selectedRowKeys = ref<Set<string>>(new Set());

    // Wide tables scroll horizontally in the wrapper — attach the shared
    // overlay scrollbar (horizontal track) once on mount.
    const wrapperRef = ref<HTMLElement>();
    // Positioned wrapper containing ONLY the scrolling box — the rail
    // host (the wrapper is the component root; its DOM parent is
    // consumer markup the rail must not span).
    const wrapperHostRef = ref<HTMLElement>();
    let wrapperScrollbar: OverlayScrollbarHandle | null = null;

    onMounted(() => {
      if (!wrapperRef.value) return;
      wrapperScrollbar = attachOverlayScrollbars(wrapperRef.value, {
        axis: "horizontal",
        host: wrapperHostRef.value,
      });
    });

    onBeforeUnmount(() => {
      wrapperScrollbar?.detach();
      wrapperScrollbar = null;
    });

    function getRowKey(row: Record<string, unknown>, index: number): string {
      if (props.rowKey && row[props.rowKey] != null) return String(row[props.rowKey]);
      return String(index);
    }

    /** Click-to-sort is TRI-state: ascending → descending → unsorted. The
     *  third click restores the consumer's own array order, which is what
     *  makes the state reachable again for a `draggable` table (reordering
     *  is inert while an arrangement is derived from a sort — see
     *  `reorderInert`). */
    function toggleSort(key: string) {
      if (sortKey.value !== key) {
        sortKey.value = key;
        sortDirection.value = "asc";
        return;
      }
      if (sortDirection.value === "asc") {
        sortDirection.value = "desc";
        return;
      }
      sortKey.value = null;
      sortDirection.value = "asc";
    }

    const sortedRows = computed(() => {
      if (!sortKey.value) return [...props.rows];
      const dir = sortDirection.value === "asc" ? 1 : -1;
      return [...props.rows].sort((a, b) => {
        const aVal = a[sortKey.value!];
        const bVal = b[sortKey.value!];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (aVal < bVal) return -1 * dir;
        if (aVal > bVal) return 1 * dir;
        return 0;
      });
    });

    function toggleRow(row: Record<string, unknown>, index: number) {
      const key = getRowKey(row, index);
      const next = new Set(selectedRowKeys.value);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      selectedRowKeys.value = next;
      emit(
        "update:selectedRows",
        sortedRows.value.filter((r, i) => next.has(getRowKey(r, i)))
      );
    }

    function toggleAll() {
      if (selectedRowKeys.value.size === sortedRows.value.length) {
        selectedRowKeys.value = new Set();
        emit("update:selectedRows", []);
      } else {
        const keys = new Set(sortedRows.value.map((r, i) => getRowKey(r, i)));
        selectedRowKeys.value = keys;
        emit("update:selectedRows", [...sortedRows.value]);
      }
    }

    const allChecked = computed(
      () =>
        props.selectable &&
        sortedRows.value.length > 0 &&
        selectedRowKeys.value.size === sortedRows.value.length
    );

    // ── Drag-to-reorder (draggable) ─────────────────────────────────────
    /** The strip the reorder engine measures: the body rows in display
     *  order, read from the DOM on demand.
     *
     *  A ref registry cannot be trusted here. Vue calls a REMOVED row's
     *  function ref with null, and the index that callback captured is the
     *  one the row had in the PREVIOUS render — which, after a mid-list
     *  deletion, is the very slot the row below just slid into. The stale
     *  null lands last and erases a live registration (measured: rows
     *  [Row-0, Row-2] render while the registry reads [Row-0, null]), so
     *  every later pointer drop resolves past the end and is swallowed by
     *  the bounds check. The DOM is the one source that cannot drift; the
     *  engine re-reads it per resolution, which is also what keeps a list
     *  that changes under a held press honest. */
    function liveRowEls(): HTMLElement[] {
      const host = wrapperHostRef.value;
      // The host's FIRST table is this component's own (a nested table can
      // only live inside one of its cells), and the `closest` filter keeps a
      // nested table's rows out of the strip: they are descendants of the
      // host too, and a bare descendant query would let an outer drag
      // resolve onto them.
      const own = host?.querySelector<HTMLElement>("table.hk-table") ?? null;
      if (!own) return [];
      return Array.from(own.querySelectorAll<HTMLElement>("tbody > .hk-table-row")).filter(
        (row) => row.closest("table") === own,
      );
    }

    /** Reordering is meaningful only over the array the consumer owns. A
     *  column sort is an arrangement DERIVED from that array — the two
     *  `reorder` indices could not tell the consumer how to reproduce the
     *  visual move — so a sorted table refuses to drag (dimmed handles,
     *  inert presses) rather than emit an edit that would land somewhere
     *  the user did not drop it. Clicking the sorted header a third time
     *  clears the sort (tri-state), which is the way back to dragging. */
    const reorderInert = computed(() => sortKey.value !== null);

    /** `moveTo` in the consumer's array: the entry at `from` takes `to`'s
     *  place and the entries between shift by one (HkTagInput's drop
     *  semantics — insert-at-target, what dropping a row ON another row
     *  looks like). */
    function onReorderDrop(from: number, to: number): void {
      if (reorderInert.value) return;
      if (from === to || from < 0 || to < 0) return;
      if (from >= props.rows.length || to >= props.rows.length) return;
      // The arrangement the user dropped is ALREADY on screen (the live
      // shift painted it while the pointer hovered) — freeze it, so the
      // commit-whenever-the-consumer-lands-it is seamless: the render that
      // carries the new order paints the rows exactly where the shift
      // already put them. A consumer that persists over the network first
      // (the house pattern: every admin list upsert) keeps showing the
      // chosen order instead of snapping back to the pre-drop one.
      arrangement.value = { from, slot: to };
      arrangementHeld.value = true;
      emit("reorder", from, to);
    }

    /** The scrollable ancestor a live drag pulls along, resolved on demand
     *  (the engine re-reads it every frame while the pointer rests near an
     *  edge): the nearest ancestor that actually overflows vertically — the
     *  page shell, a modal body, a scroll container — or null when the
     *  table sits fully in view, where there is nothing to scroll. */
    function dragScrollContainer(): HTMLElement | null {
      let el = wrapperHostRef.value?.parentElement ?? null;
      while (el) {
        const overflowY =
          typeof getComputedStyle === "function" ? getComputedStyle(el).overflowY : "";
        if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1) {
          return el;
        }
        el = el.parentElement;
      }
      return null;
    }

    const rowDrag = usePointerReorder({
      items: liveRowEls,
      axis: "y",
      onDrop: onReorderDrop,
      scrollContainer: dragScrollContainer,
    });

    // ── Drag lift: ghost, placeholder and the FLIP shift ────────────────
    // A lift no longer paints on the strip alone. The pressed row becomes
    // the PLACEHOLDER — the same element, so exactly the size the strip
    // laid out, dimmed and tinted where it sits — and a detached,
    // semi-transparent GHOST (a snapshot of the row the user grabbed)
    // floats with the pointer above the page. The slot the pointer
    // resolves to is painted by SHIFTING the arrangement: the placeholder
    // translates onto the target row's spot and every row in between
    // glides one slot across, so the drop commits an arrangement the user
    // has already watched settle — the old paint (a line on an edge) is
    // gone. Everything runs on the shared animation context: the shifts
    // and the settle are reported transitions (useReportedTransition, so
    // the bus knows motion is in flight), the ghost attaches on a bus
    // frame (onceFrame) and its removal on a bus timer
    // (scheduleCronAfter), and the `prefers-reduced-motion` media guard in
    // the stylesheet snaps the glides.

    const anim = useReportedTransition(DRAG_SHIFT_MS);

    /** The strip measured at drag start: per-row visual tops/heights plus
     *  the cumulative CSS zoom the rows paint under (chest's root DPI
     *  scale). The arrangement math runs in these VISUAL px (gBCR space)
     *  and divides by the zoom once at the write layer — a transform on a
     *  row inside a zoomed subtree paints zoom× its local px. */
    interface StripMeasure {
      tops: number[];
      zoom: number;
      left: number;
      width: number;
    }
    const stripMeasure = ref<StripMeasure | null>(null);
    /** The painted arrangement: display index `from`'s placeholder sits at
     *  slot `slot`. Live while the drag moves; FROZEN after a real drop
     *  (see `onReorderDrop`) until `rows` carries the emitted move. */
    const arrangement = ref<{ from: number; slot: number } | null>(null);
    const arrangementHeld = ref(false);

    /** Row displacement (LOCAL px, ready for a transform) for display
     *  index `index` under the live arrangement — the FLIP delta between
     *  the slot the strip measured the row at and the slot the arrangement
     *  puts it in. Anchored to the strip's own measured positions: the row
     *  landing at final slot f sits exactly where the strip laid the f-th
     *  row out, so uneven rows land pixel-exact too. */
    function rowShift(index: number): number {
      const m = stripMeasure.value;
      const a = arrangement.value;
      if (!m || !a || a.from === a.slot) return 0;
      if (index < 0 || index >= m.tops.length) return 0;
      const order = m.tops.map((_, i) => i);
      order.splice(a.from, 1);
      order.splice(a.slot, 0, a.from);
      const finalTop = new Array<number>(m.tops.length).fill(0);
      for (let f = 0; f < order.length; f += 1) finalTop[order[f]!] = m.tops[f]!;
      const delta = finalTop[index]! - m.tops[index]!;
      return Math.abs(delta) < 0.5 ? 0 : delta / m.zoom;
    }

    function measureStrip(): void {
      const rows = liveRowEls();
      if (rows.length === 0) {
        stripMeasure.value = null;
        return;
      }
      // A drag starting while a HELD arrangement is still painted would
      // measure the shifted paint — force the stale transforms off first
      // (the render will not re-apply them: the arrangement was cleared).
      for (const row of rows) row.style.transform = "";
      const zoom = ancestorZoom(rows[0]!);
      const tops: number[] = [];
      rows.forEach((row) => {
        tops.push(row.getBoundingClientRect().top);
      });
      const source = rows[rowDrag.dragFrom.value]?.getBoundingClientRect();
      stripMeasure.value = {
        tops,
        zoom,
        left: source?.left ?? 0,
        width: source?.width ?? 0,
      };
    }

    // ── The ghost ──
    let ghostNode: HTMLElement | null = null;
    let ghostFading: HTMLElement | null = null;
    let ghostHTML = "";
    let ghostStartTop = 0;
    let ghostGrabOffsetY = 0;
    let pressClientY = 0;
    let ghostFadeTimer: CronHandle | null = null;

    /** Snapshot the pressed row BEFORE the drag paint lands on it (this
     *  runs in the pre-render watcher): the ghost is the row the user
     *  grabbed, not the dimmed placeholder it is about to become. The
     *  clone must not carry the row's interactive chrome — its grip keeps
     *  `tabindex`/`role` in the snapshot HTML, and a second tabbable copy
     *  of every row would be a keyboard trap — so the attributes come off
     *  and the ghost root is hidden from the accessibility tree. */
    function captureGhost(): void {
      const row = liveRowEls()[rowDrag.dragFrom.value];
      ghostHTML = row
        ? row.outerHTML
            .replace(/\sdata-dragging="[^"]*"/g, "")
            .replace(/\sdata-drop="[^"]*"/g, "")
            .replace(/\stabindex="[^"]*"/g, "")
            .replace(/\srole="button"/g, "")
        : "";
      const rect = row?.getBoundingClientRect();
      ghostStartTop = rect?.top ?? 0;
      ghostGrabOffsetY = pressClientY - ghostStartTop;
    }

    /** Attach the snapshot as a fixed-position clone above the page. The
     *  ghost lives on <body> — inside any root CSS zoom subtree its px are
     *  LOCAL while the measured rect reports the root VISUAL space — so
     *  every write divides by the body's cumulative zoom (house pattern:
     *  HkDraggableList's ghost). */
    function attachGhost(): void {
      const m = stripMeasure.value;
      if (!m || !ghostHTML || m.width <= 0) return;
      detachGhost();
      const zb = ancestorZoom(document.body);
      const node = document.createElement("div");
      node.className = "hk-table-drag-ghost";
      // The clone's table carries the source table's classes, so size and
      // bordered variants paint identically to the row it lifted.
      const table = document.createElement("table");
      const sourceTable = wrapperHostRef.value?.querySelector("table.hk-table");
      if (sourceTable) table.className = sourceTable.className;
      table.style.width = `${m.width / zb}px`;
      table.style.tableLayout = "fixed";
      const tbody = document.createElement("tbody");
      tbody.className = "hk-table-body";
      tbody.innerHTML = ghostHTML;
      // Fixed layout takes its column spec from the first row's widths —
      // pin each clone cell to the source's rendered width so the ghost's
      // columns line up with the strip it floats over.
      const sourceCells = liveRowEls()[rowDrag.dragFrom.value]?.querySelectorAll<HTMLElement>("td, th");
      const ghostCells = tbody.querySelectorAll<HTMLElement>("td, th");
      ghostCells.forEach((cell, i) => {
        const w = sourceCells?.[i]?.getBoundingClientRect().width ?? 0;
        if (w > 0) cell.style.width = `${w / zb}px`;
      });
      table.appendChild(tbody);
      node.appendChild(table);
      node.style.width = `${m.width / zb}px`;
      moveGhostTo(node, pressClientY);
      node.style.pointerEvents = "none";
      node.setAttribute("aria-hidden", "true");
      document.body.appendChild(node);
      ghostNode = node;
    }

    function moveGhostTo(node: HTMLElement, clientY: number): void {
      const m = stripMeasure.value;
      if (!m) return;
      const zb = ancestorZoom(document.body);
      // Vertical only: the ghost stays anchored to the row's own left
      // edge, so a sideways jitter never slides the row across columns.
      const x = m.left / zb;
      const y = (clientY - ghostGrabOffsetY) / zb;
      node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }

    function onDragPointerMove(event: PointerEvent): void {
      if (!ghostNode) return;
      moveGhostTo(ghostNode, event.clientY);
    }

    /** The ghost hands off to the placeholder: a short fade at the
     *  position where the pointer released, removed on a bus timer. */
    function fadeGhost(): void {
      if (!ghostNode) return;
      const node = ghostNode;
      ghostNode = null;
      ghostFading = node;
      node.setAttribute("data-fading", "");
      ghostFadeTimer?.disconnect();
      ghostFadeTimer = scheduleCronAfter(() => {
        ghostFadeTimer = null;
        ghostFading?.remove();
        ghostFading = null;
      }, DRAG_SHIFT_MS);
    }

    function detachGhost(): void {
      ghostFadeTimer?.disconnect();
      ghostFadeTimer = null;
      ghostNode?.remove();
      ghostNode = null;
      // A fade in flight has already left `ghostNode` — it is owned by the
      // timer alone, so an unmount mid-fade must reap it here or it would
      // linger on <body> with its removal cancelled.
      ghostFading?.remove();
      ghostFading = null;
    }

    /** The beat after a cancel / release-on-origin: the transforms come
     *  off in the same flush that removes `data-dragging`, and a CSS
     *  transition takes the AFTER-change style — with the arming attribute
     *  gone the return would snap. `data-releasing` keeps the transitions
     *  armed for exactly one shift window so the glide is real. */
    const releasing = ref(false);
    let releaseTimer: CronHandle | null = null;

    watch(() => rowDrag.dragging.value, (active) => {
      if (active) {
        arrangementHeld.value = false;
        releaseTimer?.disconnect();
        releaseTimer = null;
        releasing.value = false;
        arrangement.value = null;
        measureStrip();
        captureGhost();
        onceFrame(() => {
          // The frame may land after a fast release — never paint a lift
          // for a gesture that is already over.
          if (!rowDrag.dragging.value) return;
          attachGhost();
          anim.run();
        });
        window.addEventListener("pointermove", onDragPointerMove);
      } else {
        // The engine clears its refs before `onDrop` runs, so by the time
        // this flushes, a real drop has already frozen the arrangement.
        window.removeEventListener("pointermove", onDragPointerMove);
        if (!arrangementHeld.value) {
          // Cancel / release on the origin: glide the arrangement home.
          const moved = arrangement.value != null && arrangement.value.from !== arrangement.value.slot;
          arrangement.value = null;
          if (moved) {
            releasing.value = true;
            anim.run();
            releaseTimer?.disconnect();
            releaseTimer = scheduleCronAfter(() => {
              releaseTimer = null;
              releasing.value = false;
            }, DRAG_SHIFT_MS);
          }
        }
        fadeGhost();
      }
    });

    watch(() => rowDrag.dragOver.value, (slot) => {
      if (!rowDrag.dragging.value || slot < 0) return;
      const from = rowDrag.dragFrom.value;
      const a = arrangement.value;
      if (a && a.from === from && a.slot === slot) return;
      arrangement.value = { from, slot };
      // A slot equal to the origin paints no shift — reporting motion for
      // nothing would only tell the bus a lie.
      if (from !== slot) anim.run();
    });

    watch(() => props.rows, () => {
      // The consumer's array moved — the committed drop, an external edit,
      // a refresh. The held arrangement's job is done: clearing in this
      // same pre-render flush paints the new order and drops the shifts in
      // one paint, which coincide (that is the freeze's whole point).
      // NOTE the contract: reference replacement. A consumer mutating the
      // array in place must emit a replacement (or re-key) for the hold to
      // lift — the house consumers all do.
      arrangementHeld.value = false;
      if (rowDrag.dragging.value) {
        // A strip replaced UNDER a live drag: the measurement is stale
        // (tops were read at press time) and the engine will resolve
        // against the NEW elements — re-measure the clean strip so the
        // paint follows, and let the shift re-arm on the next resolution.
        arrangement.value = null;
        measureStrip();
        return;
      }
      arrangement.value = null;
    });

    onBeforeUnmount(() => {
      window.removeEventListener("pointermove", onDragPointerMove);
      releaseTimer?.disconnect();
      releaseTimer = null;
      detachGhost();
    });

    function onHandlePointerdown(e: PointerEvent, index: number): void {
      if (reorderInert.value) return;
      // The press's own row is looked up in the live strip: the render-time
      // index is a fallback for a handle that somehow left the table.
      const row = (e.currentTarget as HTMLElement | null)?.closest("tr");
      const strip = row ? liveRowEls().indexOf(row as HTMLElement) : index;
      if (strip >= 0) {
        // Where the finger grabbed the row — the ghost hangs the strip's
        // lift off this point so the grab stays under the pointer.
        pressClientY = e.clientY;
        rowDrag.start(e, strip);
      }
    }

    /** Keyboard twin of the drop: move one row one slot. Runs on a focused
     *  handle, so plain ArrowUp/Down are unambiguous (no competing cursor
     *  semantics on a button) and are consumed even at the ends, where the
     *  row has nowhere to go. */
    function onHandleKeydown(e: KeyboardEvent, index: number): void {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      if (reorderInert.value) return;
      const delta = e.key === "ArrowUp" ? -1 : 1;
      onReorderDrop(index, index + delta);
    }

    /** The handle's accessible name names the entry AND the action (house
     *  pattern: HkTagInput's reorderLabel) — the first column's value is
     *  the row's identity as far as this generic component can tell. */
    function rowLabel(row: Record<string, unknown>): string {
      const first = props.columns[0]?.key;
      const value = first != null ? row[first] : undefined;
      return value == null ? "" : String(value).trim();
    }

    function handleName(row: Record<string, unknown>): string {
      const label = rowLabel(row);
      if (!label) return t("hikari::table.dragHandle", "Drag to reorder");
      const template = t("hikari::table.dragHandleRow", "Reorder {label}");
      // split/join, not String.replace: a row label carrying `$&` / `$'`
      // would otherwise be expanded as a replacement pattern (house
      // interpolation, HkTagInput/HkAffixPicker).
      const [before, after] = template.split("{label}");
      if (after === undefined) return template;
      return `${before}${label}${after}`;
    }

    const tableCls = computed(() => [
      "hk-table",
      `hk-table-${props.size}`,
      props.bordered ? "hk-table-bordered" : "",
      props.striped ? "hk-table-striped" : "",
      props.hover ? "hk-table-hover" : "",
      props.draggable ? "hk-table-draggable" : "",
    ]);

    /** Drag-scoped switches the stylesheet reads: `data-dragging` arms the
     *  shift transitions for as long as a gesture owns the strip;
     *  `data-shift-held` keeps them armed after a drop while the frozen
     *  arrangement waits for `rows` to carry it; `data-releasing` arms
     *  them for the one beat a cancelled arrangement needs to glide home
     *  (the arming attribute must OUTLIVE the transform removal, or the
     *  after-change style snaps). */
    const dragScope = computed(() => ({
      "data-dragging": rowDrag.dragging.value ? "" : undefined,
      "data-shift-held": arrangementHeld.value ? "" : undefined,
      "data-releasing": releasing.value ? "" : undefined,
    }));

    const totalCols = computed(
      () => props.columns.length + (props.selectable ? 1 : 0) + (props.draggable ? 1 : 0)
    );

    return () => {
      return (
      <div ref={wrapperHostRef} class="hk-table-host">
        <div ref={wrapperRef} class="hk-table-wrapper">
        <table class={tableCls.value} {...dragScope.value}>
          {props.caption && <caption class="hk-table-sr-only">{props.caption}</caption>}
          <thead>
            <tr class="hk-table-header-row">
              {props.draggable && (
                <th class="hk-table-header-cell hk-table-drag-col" style={{ width: "36px" }} aria-hidden="true" />
              )}
              {props.selectable && (
                <th class="hk-table-header-cell" style={{ width: "40px" }}>
                  <label class="hk-table-checkbox-label">
                    <input
                      type="checkbox"
                      class="hk-table-checkbox-input"
                      checked={allChecked.value}
                      onChange={toggleAll}
                    />
                    <span
                      class={[
                        "hk-table-checkbox",
                        "hk-table-checkbox-md",
                        allChecked.value ? "hk-table-checkbox-checked" : "",
                      ]}
                    >
                      {allChecked.value && (
                        <svg
                          class="hk-table-checkbox-icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="3"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                  </label>
                </th>
              )}
              {props.columns.map((col) => {
                const canSort = props.sortable || col.sortable;
                return (
                  <th
                    key={col.key}
                    class={[
                      "hk-table-header-cell",
                      col.align ? `hk-text-${col.align}` : "",
                      canSort ? "hk-table-header-sortable" : "",
                      canSort && sortKey.value === col.key ? "hk-table-header-sorted" : "",
                    ]}
                    style={{ width: col.width }}
                    onClick={() => canSort && toggleSort(col.key)}
                  >
                    <span class="hk-table-header-label">{col.title}</span>
                    {canSort && sortKey.value === col.key && (
                      <svg
                        class={[
                          "hk-table-sort-icon",
                          sortDirection.value === "desc" ? "hk-table-sort-icon-desc" : "",
                        ]}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody class="hk-table-body">
            {sortedRows.value.length === 0 ? (
              <tr>
                <td colspan={totalCols.value} class="hk-table-empty">
                  {slots.empty ? slots.empty() : (props.emptyText || t("hikari::table.noData", "No data"))}
                </td>
              </tr>
            ) : (
              sortedRows.value.map((row, index) => {
                const rowKey = getRowKey(row, index);
                // The FLIP shift this row rides under the live (or frozen)
                // arrangement — 0 for rows the arrangement leaves put. It
                // travels to the CELLS as a custom property, not as a row
                // transform: `<tr>` transforms are unreliable across
                // engines (the predecessor lift avoided them for exactly
                // this), while a <td> is a plain box everywhere — and a
                // custom property is inert paint-wise, so the row element
                // only NAMES the shift and the stylesheet moves the paint.
                const shiftPx = rowShift(index);
                return (
                  <tr
                    key={rowKey}
                    class="hk-table-row"
                    style={shiftPx ? { "--hk-drag-shift": `${shiftPx}px` } : undefined}
                    data-shift={shiftPx ? "" : undefined}
                    data-dragging={rowDrag.dragging.value && rowDrag.dragFrom.value === index ? "" : undefined}
                  >
                    {props.draggable && (
                      <td class="hk-table-cell hk-table-drag-cell">
                        {/* A span, not a <button>: the reorder engine (house
                            rule, HkDraggableList's handle too) treats presses
                            on interactive controls as ACTIVATION, not drag —
                            the grip is a span so a press on it IS the drag
                            gesture. Keyboard stays first-class: focusable,
                            ArrowUp/Down nudges the row (aria-keyshortcuts). */}
                        <span
                          role="button"
                          tabindex={0}
                          class="hk-table-drag-handle"
                          aria-label={handleName(row)}
                          title={handleName(row)}
                          aria-keyshortcuts="ArrowUp ArrowDown"
                          aria-disabled={reorderInert.value || undefined}
                          data-disabled={reorderInert.value || undefined}
                          onPointerdown={(e: PointerEvent) => onHandlePointerdown(e, index)}
                          onKeydown={(e: KeyboardEvent) => onHandleKeydown(e, index)}
                        >
                          <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
                            <circle cx="3.5" cy="3" r="1.2" />
                            <circle cx="8.5" cy="3" r="1.2" />
                            <circle cx="3.5" cy="7" r="1.2" />
                            <circle cx="8.5" cy="7" r="1.2" />
                            <circle cx="3.5" cy="11" r="1.2" />
                            <circle cx="8.5" cy="11" r="1.2" />
                          </svg>
                        </span>
                      </td>
                    )}
                    {props.selectable && (
                      <td class="hk-table-cell" style={{ width: "40px" }}>
                        <label class="hk-table-checkbox-label">
                          <input
                            type="checkbox"
                            class="hk-table-checkbox-input"
                            checked={selectedRowKeys.value.has(rowKey)}
                            onChange={() => toggleRow(row, index)}
                          />
                          <span
                            class={[
                              "hk-table-checkbox",
                              "hk-table-checkbox-md",
                              selectedRowKeys.value.has(rowKey) ? "hk-table-checkbox-checked" : "",
                            ]}
                          >
                            {selectedRowKeys.value.has(rowKey) && (
                              <svg
                                class="hk-table-checkbox-icon"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="3"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </span>
                        </label>
                      </td>
                    )}
                    {props.columns.map((col) => (
                      <td
                        key={col.key}
                        class={["hk-table-cell", col.align ? `hk-text-${col.align}` : ""]}
                      >
                        {slots[`cell-${col.key}`]
                          ? slots[`cell-${col.key}`]!({ row, value: row[col.key], index })
                          : row[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>
      );
    };
  },
});
