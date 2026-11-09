import { Check, ChevronUp, GripVertical } from "lucide-vue-next";

import { computed, defineComponent, inject, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";

import { useI18n } from "../i18n/context";
import { usePointerReorder } from "../composables/usePointerReorder";
import { useReportedTransition } from "../composables/useReportedTransition";
import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";
import { onceFrame } from "../runtime/animationBus";
import { scheduleCronAfter, type CronHandle } from "../runtime/cronBus";
import { ancestorZoom } from "../runtime/cssZoom";
import { useClipboardWithToast } from "../runtime/useClipboard";
import { useToast } from "../runtime/useToast";
import HkRowActions from "./HkRowActions";
import { HK_SCROLL_PROGRESS_REGISTRAR, type HkScrollProgressHandle } from "./HkScrollProgressDock";
import "./HkTable.scss";

interface Column {
  key: string;
  title: string;
  /** Accessible name for the header cell, WITHOUT visible text. Utility
   *  columns (row actions, ⋯ menus) intentionally render an empty
   *  `title` — but an empty `<th>` is also an unnamed one for screen
   *  readers. Set `headerLabel` to publish `aria-label` on that `<th>`
   *  while the visible header stays empty; it never renders text and
   *  never participates in sorting. */
  headerLabel?: string;
  width?: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  /** 2026-10-18 table-interaction contract: cells are not prose — a
   *  click on a cell's plain text copies it (shared clipboard-with-toast
   *  path). Set `copyable: false` to opt one column out (controls-only
   *  columns, editable previews); the copy click layer never fires
   *  there. Default true. */
  copyable?: boolean;
}

/** One group in a grouped/sectioned table (`sections`). Sorting runs
 *  WITHIN a section; selection spans the whole table (the header checkbox
 *  selects every section's rows); drag-to-reorder is clamped to the
 *  pressed row's section. Its band renders inside the table body — the
 *  single column header stays at the top, exactly once. */
export interface HkTableSection {
  /** Stable UNIQUE identity for the section: it is the Vue key of the
   *  section body and the drag clamp resolves the pressed row's section by
   *  it. Duplicate keys collapse in Vue's keyed diff. */
  key: string;
  /** Default band text; the `section` slot overrides the whole band content. */
  label?: string;
  rows: Record<string, unknown>[];
}

/** A section's live display state: the sorted rows plus the flat offset
 *  its first row occupies in the concatenation of every section's rows
 *  (the index space `reorder` emits and selection walks). */
interface SectionView {
  section: HkTableSection;
  index: number;
  rows: Record<string, unknown>[];
  offset: number;
}

/** Per-row gate for the manage column: `true` renders the trigger;
 *  `false` renders an empty cell (permission gates, rows without
 *  actions — the roster convention is no ⋯ at all, not a dead button);
 *  `"disabled"` keeps the affordance but refuses activation (read-only
 *  rows that must still show where actions would live). */
export type HkRowManageGate =
  | boolean
  | ((row: Record<string, unknown>) => boolean | "disabled");

/** Elements whose clicks mean their own action — the cell copy layer
 *  must never swallow them. Matches the HkCopyBadge interactive guard:
 *  real controls, button-role elements, popup owners, and the explicit
 *  `[data-no-copy]` escape hatch for slot content that wants its own
 *  click semantics without becoming a control. */
const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, label, [role="button"], [aria-haspopup], [data-no-copy]';

/** The text a default-rendered cell child ACTUALLY renders, restricted to
 *  the table-cell value contract. Vue's `normalizeVNode` sends strings,
 *  numbers, bigints, symbols and functions through
 *  `createVNode(Text, null, String(child))`, arrays through a Fragment,
 *  and NON-vnode objects through that same Text branch (a plain object
 *  shows `[object Object]`, a `Date` its `toString`); booleans / `null` /
 *  `undefined` become comment placeholders that render NOTHING. Only
 *  strings / numbers / bigints are table-cell values here: `String(false)`
 *  is not a copy payload — the handler would find an empty textContent —
 *  so a `false` cell must not advertise the affordance. Symbols,
 *  functions, arrays, objects and Dates DO render something and their
 *  click copies, so leaving them out is a deliberate UNDER-promise (never
 *  a lie); a slot is the supported way to render structured content. */
function renderedText(value: unknown): string {
  return typeof value === "string" || typeof value === "number" || typeof value === "bigint"
    ? String(value).trim()
    : "";
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
    rows: { type: Array as PropType<Record<string, unknown>[]>, default: () => [] },
    /** Grouped mode: when provided, `rows` is unused and the body renders
     *  ONE `<tbody class="hk-table-section-body">` per section, each led by
     *  a band row (`<th scope="rowgroup">`, `colspan` = total columns).
     *  The column header still renders exactly once at the top. Sorting
     *  runs within each section; selection spans the whole table; the drag
     *  strip is clamped to the pressed row's section. `section.key` must be
     *  UNIQUE (Vue keyed diff + drag clamp identity). An empty section
     *  keeps its band (callers show unreachable/empty panels), and when
     *  every section is empty the trailing empty row still renders. */
    sections: { type: Array as PropType<HkTableSection[]>, default: undefined },
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
     *  sort is cleared (the handles render dimmed and refuse presses).
     *  With `sections` the drag strip is CLAMPED to the section that owns
     *  the pressed row (a row can never be dropped into another section),
     *  and the emitted `reorder(from, to)` indices are FLAT indices into
     *  the concatenation of every section's rows — section-local index
     *  plus that section's flat offset — so a consumer holding one flat
     *  array can apply the move. */
    draggable: { type: Boolean, default: false },
    /** 2026-10-18 table-interaction contract: table content is not
     *  prose. When on (the default for every roster/admin table), plain
     *  text in a cell copies on click through the shared
     *  clipboard-with-toast path, drag mass-selection is dead
     *  (user-select: none, scoped by `data-copy-cells`), and per-column
     *  opt-out rides `Column.copyable`. Turn off only for exotic embeds
     *  that genuinely need selectable text. */
    copyCells: { type: Boolean, default: true },
    /** Render the trailing row-actions column (HkRowActions trigger).
     *  This is the 2026-10-12 row-manage ruling's ⋯ button, promoted
     *  into the table so call sites stop hand-rolling it: enable the
     *  column, handle `manage`, done. The button — not cell bodies —
     *  remains the ONLY row-action affordance (2026-10-18 ruling).
     *  Pass a gate function (HkRowManageGate) to hide the trigger per
     *  row (no permission, no actions for that row) or render it
     *  disabled (read-only rows that keep the affordance). */
    manageable: {
      type: [Boolean, Function] as PropType<HkRowManageGate>,
      default: false,
    },
    emptyText: { type: String, default: "" },
    /** Authoritative row total the scroll-progress pill uses as its
     *  denominator (the server count behind a paged list). Omitted: the
     *  pill falls back to counting the delivered DOM rows. Every HkTable
     *  self-registers with the nearest enclosing enabled
     *  HkScrollProgressDock — no wrapper needed (2026-11-06: moved here
     *  from HkAdminTablePage so the 17 bare-HkTable views inherit the
     *  pill too; 2026-11-09: the feature became the standalone dock
     *  component, the vocabulary unchanged). */
    total: { type: Number, default: undefined },
  },
  emits: {
    "update:selectedRows": (_rows: Record<string, unknown>[]) => true,
    reorder: (_fromIndex: number, _toIndex: number) => true,
    /** `manageable`: the row's ⋯ trigger was pressed. The opener is the
     *  trigger button (focus-restore anchor for a manage window). */
    manage: (_row: Record<string, unknown>, _opener: HTMLElement) => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const sortKey = ref<string | null>(null);
    const sortDirection = ref<"asc" | "desc">("asc");
    const selectedRowKeys = ref<Set<string>>(new Set());

    // The cell copy layer shares the house clipboard-with-toast path
    // (same runtime HkCopyBadge uses), so the confirmation toast —
    // top-right band, localized defaults — is identical everywhere.
    const clipboard = useClipboardWithToast(useToast());
    const copyHint = computed(() => t("hikari::clipboard.clickToCopy", "Click to copy"));

    /** Copy the text of a TEXT LEAF — an element with no element
     *  children. Layout wrappers (rows of chips, badges beside prose)
     *  never become a copy payload: a click there copies nothing rather
     *  than sweeping up every descendant's text into one string. */
    function copyLeafText(el: HTMLElement): void {
      if (el.firstElementChild) return;
      const text = (el.textContent ?? "").trim();
      if (text) void clipboard.copy(text);
    }

    /** The td's copy click layer. Partition, in order:
     *  1. Interactive descendants own their clicks outright (toggles,
     *     badges, the ⋯ trigger) — return.
     *  2. A click on the td itself is a text click ONLY when the cell
     *     is pure text (no element children); a click on the padding
     *     AROUND slot content does nothing — per the 2026-10-18 ruling,
     *     cell bodies do NOT open row actions.
     *  3. Otherwise the target must be a text leaf; layout containers
     *     (gaps between chips) do nothing. */
    function onCellClick(e: MouseEvent, col: Column, cellEl: HTMLElement): void {
      if (!props.copyCells || col.copyable === false) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target !== cellEl) {
        if (target.closest(INTERACTIVE_SELECTOR)) return;
        copyLeafText(target);
        return;
      }
      if (cellEl.firstElementChild) return;
      copyLeafText(cellEl);
    }

    /** Resolve the row's manage mode from the gate: the column renders
     *  whenever `manageable` is set, but the TRIGGER obeys the per-row
     *  verdict — off (empty cell, roster convention: no permission, no
     *  ⋯), disabled (read-only rows keep the affordance), or on. */
    function rowManageMode(row: Record<string, unknown>): "off" | "disabled" | "on" {
      const gate = props.manageable;
      if (!gate) return "off";
      if (typeof gate === "function") {
        const verdict = gate(row);
        if (verdict === "disabled") return "disabled";
        return verdict ? "on" : "off";
      }
      return "on";
    }

    function renderManageCell(row: Record<string, unknown>) {
      const mode = rowManageMode(row);
      return (
        <td class="hk-table-cell hk-table-manage-cell">
          {mode !== "off" ? (
            <HkRowActions
              size={28}
              disabled={mode === "disabled"}
              onOpen={(opener: HTMLElement) => emit("manage", row, opener)}
            />
          ) : null}
        </td>
      );
    }

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

    // Scroll-progress registration: the nearest enclosing ENABLED
    // HkScrollProgressDock provides the registrar (provide/inject
    // scoping resolves the shell viewport for admin pages and keeps an
    // inner dock's lists out of the shell). The handle exposes the
    // table host as the row root plus the `total` prop live — the pill's
    // denominator follows it as pages load.
    const progressRegistrar = inject(HK_SCROLL_PROGRESS_REGISTRAR, null);
    const progressHandle: HkScrollProgressHandle = {
      getRoot: () => wrapperHostRef.value ?? null,
      getTotal: () => props.total,
      // Sectioned bodies lead with a band `<tr>` that is not a data row:
      // hand the pill the data rows only. Unsectioned returns undefined so
      // the dock keeps its `selector` path unchanged.
      getRows: () => {
        if (!props.sections) return undefined;
        // The host can contain a NESTED table (its rows are descendants
        // too): the strip reader above already scopes by `closest("table")`,
        // and the pill's row list must use the same boundary or a nested
        // sectioned table inflates this table's count.
        const own = wrapperHostRef.value?.querySelector<HTMLElement>("table.hk-table") ?? null;
        if (!own) return [];
        return Array.from(
          own.querySelectorAll<HTMLElement>("tbody.hk-table-section-body > .hk-table-row"),
        ).filter((row) => row.closest("table") === own);
      },
    };
    onMounted(() => {
      progressRegistrar?.register(progressHandle);
    });
    onBeforeUnmount(() => {
      progressRegistrar?.unregister(progressHandle);
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

    /** Sort one row list by the active column sort. Sectioned tables call
     *  this per section (the section order is preserved); the unsectioned
     *  table calls it on `rows` — the exact arrangement it always had. */
    function sortRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
      if (!sortKey.value) return [...rows];
      const dir = sortDirection.value === "asc" ? 1 : -1;
      return [...rows].sort((a, b) => {
        const aVal = a[sortKey.value!];
        const bVal = b[sortKey.value!];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (aVal < bVal) return -1 * dir;
        if (aVal > bVal) return 1 * dir;
        return 0;
      });
    }

    const sortedRows = computed(() => sortRows(props.rows));

    /** The sectioned display plan: each section's rows sorted WITHIN the
     *  section, section order untouched, plus the flat offset its first row
     *  occupies. Offsets are computed from the displayed (sorted) lengths so
     *  a reorder emit and the selection walk agree on one index space. */
    const sectionView = computed<SectionView[]>(() => {
      if (!props.sections) return [];
      let offset = 0;
      return props.sections.map((section, index) => {
        const rows = sortRows(section.rows);
        const view: SectionView = { section, index, rows, offset };
        offset += rows.length;
        return view;
      });
    });

    /** Every displayed data row, in display order — the flat list selection
     *  and `reorder` indices are expressed against. Unsectioned: today's
     *  `sortedRows`; sectioned: the concatenation of every section's rows. */
    const displayRows = computed(() =>
      props.sections ? sectionView.value.flatMap((view) => view.rows) : sortedRows.value,
    );

    function toggleRow(row: Record<string, unknown>, index: number) {
      const key = getRowKey(row, index);
      const next = new Set(selectedRowKeys.value);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      selectedRowKeys.value = next;
      emit(
        "update:selectedRows",
        displayRows.value.filter((r, i) => next.has(getRowKey(r, i)))
      );
    }

    function toggleAll() {
      if (selectedRowKeys.value.size === displayRows.value.length) {
        selectedRowKeys.value = new Set();
        emit("update:selectedRows", []);
      } else {
        const keys = new Set(displayRows.value.map((r, i) => getRowKey(r, i)));
        selectedRowKeys.value = keys;
        emit("update:selectedRows", [...displayRows.value]);
      }
    }

    const allChecked = computed(
      () =>
        props.selectable &&
        displayRows.value.length > 0 &&
        selectedRowKeys.value.size === displayRows.value.length
    );

    // ── Drag-to-reorder (draggable) ─────────────────────────────────────
    /** The section that owns the live press (`null` while no press owns
     *  one). The drag strip is CLAMPED to it: `items()` returns only that
     *  section's row elements, so the engine can never resolve a slot in
     *  another section — the same clamp HkTagInput applies to its row drag
     *  (the selected group is its drop space). */
    const dragSectionKey = ref<string | null>(null);

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
      if (props.sections) {
        const key = dragSectionKey.value;
        if (key == null) return [];
        const body =
          Array.from(own.querySelectorAll<HTMLElement>("tbody.hk-table-section-body")).find(
            (candidate) =>
              candidate.closest("table") === own && candidate.dataset.sectionKey === key,
          ) ?? null;
        if (!body) return [];
        return Array.from(body.querySelectorAll<HTMLElement>(".hk-table-row")).filter(
          (row) => row.parentElement === body && row.closest("table") === own,
        );
      }
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

    /** Freeze the arrangement and emit the commit. With sections the strip
     *  indices are SECTION-LOCAL, so the emitted pair is translated into
     *  the flat index space — `section offset + local index` — which is the
     *  array a consumer holds after concatenating its sections. */
    function commitReorder(view: SectionView | null, from: number, to: number): void {
      const sectionKey = view?.section.key ?? null;
      // The live measurement belongs to the strip it was taken on. A
      // keyboard commit may target ANOTHER section (the pointer drag it
      // follows landed elsewhere): reuse would paint this section's local
      // indices through foreign tops, so drop the measurement instead.
      // Unsectioned keeps the historic single-strip behavior.
      if (props.sections && sectionKey !== measuredSectionKey.value) {
        stripMeasure.value = null;
        measuredSectionKey.value = null;
      }
      arrangementSectionKey.value = sectionKey;
      arrangement.value = { from, slot: to };
      arrangementHeld.value = true;
      const offset = view?.offset ?? 0;
      emit("reorder", offset + from, offset + to);
    }

    /** `moveTo` in the consumer's array: the entry at `from` takes `to`'s
     *  place and the entries between shift by one (HkTagInput's drop
     *  semantics — insert-at-target, what dropping a row ON another row
     *  looks like). */
    function onReorderDrop(from: number, to: number): void {
      if (reorderInert.value) return;
      if (from === to || from < 0 || to < 0) return;
      if (props.sections) {
        const key = dragSectionKey.value;
        const view =
          key == null
            ? null
            : sectionView.value.find((candidate) => candidate.section.key === key) ?? null;
        // The strip was clamped to this section at press time; a section
        // that vanished under the drag has no drop to commit.
        if (!view) return;
        if (from >= view.rows.length || to >= view.rows.length) return;
        // The arrangement the user dropped is ALREADY on screen (the live
        // shift painted it while the pointer hovered) — freeze it, so the
        // commit-whenever-the-consumer-lands-it is seamless: the render that
        // carries the new order paints the rows exactly where the shift
        // already put them. A consumer that persists over the network first
        // (the house pattern: every admin list upsert) keeps showing the
        // chosen order instead of snapping back to the pre-drop one.
        commitReorder(view, from, to);
        return;
      }
      if (from >= props.rows.length || to >= props.rows.length) return;
      // The arrangement the user dropped is ALREADY on screen (the live
      // shift painted it while the pointer hovered) — freeze it, so the
      // commit-whenever-the-consumer-lands-it is seamless: the render that
      // carries the new order paints the rows exactly where the shift
      // already put them. A consumer that persists over the network first
      // (the house pattern: every admin list upsert) keeps showing the
      // chosen order instead of snapping back to the pre-drop one.
      commitReorder(null, from, to);
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
    /** Which section the live `stripMeasure` was taken for (`null` =
     *  unsectioned, or no measurement). A KEYBOARD commit can follow a
     *  pointer drag on ANOTHER section; painting that section's local
     *  indices through this strip's measured tops would smear the
     *  pre-paint, so `commitReorder` drops a foreign measurement instead
     *  of reusing it (rowShift is then 0 — the order simply lands). */
    const measuredSectionKey = ref<string | null>(null);
    /** The section the measured strip — and the arrangement painted over
     *  it — belongs to. `rowShift` is fed section-local indices and only
     *  shifts rows of THIS section; every other section's rows stay put, so
     *  a clamped drag can never paint a cross-section glide. Null while
     *  unsectioned. */
    const arrangementSectionKey = ref<string | null>(null);
    /** The painted arrangement: display index `from`'s placeholder sits at
     *  slot `slot`. Live while the drag moves; FROZEN after a real drop
     *  (see `onReorderDrop`) until `rows` carries the emitted move. With
     *  sections these are SECTION-LOCAL strip indices; the emitted
     *  `reorder` pair is the flat translation. */
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
        measuredSectionKey.value = null;
        return;
      }
      // A drag starting while a HELD arrangement is still painted would
      // measure the shifted paint — force the stale transforms off first
      // (the render will not re-apply them: the arrangement was cleared).
      // removeProperty rather than an empty write: an empty transform
      // value would leave a `style=""` husk on rows that never carried
      // anything else.
      for (const row of rows) {
        row.style.removeProperty("transform");
        if (!row.getAttribute("style")) row.removeAttribute("style");
      }
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
      measuredSectionKey.value = props.sections ? dragSectionKey.value : null;
      // The measured strip IS the pressed section's row list: name that
      // section so rowShift only paints the rows it measured.
      arrangementSectionKey.value = measuredSectionKey.value;
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
        arrangementSectionKey.value = props.sections ? dragSectionKey.value : null;
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
          arrangementSectionKey.value = null;
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
        // The gesture is over: the next press arms its own section (and a
        // held drop keeps painting through `arrangementSectionKey`, which
        // outlives this release).
        dragSectionKey.value = null;
      }
    });

    watch(() => rowDrag.dragOver.value, (slot) => {
      if (!rowDrag.dragging.value || slot < 0) return;
      const from = rowDrag.dragFrom.value;
      const a = arrangement.value;
      if (a && a.from === from && a.slot === slot) return;
      arrangementSectionKey.value = props.sections ? dragSectionKey.value : null;
      arrangement.value = { from, slot };
      // A slot equal to the origin paints no shift — reporting motion for
      // nothing would only tell the bus a lie.
      if (from !== slot) anim.run();
    });

    watch([() => props.rows, () => props.sections], () => {
      // The consumer's array (or section list) moved — the committed drop,
      // an external edit, a refresh. The held arrangement's job is done:
      // clearing in this same pre-render flush paints the new order and
      // drops the shifts in one paint, which coincide (that is the freeze's
      // whole point).
      // NOTE the contract: reference replacement. A consumer mutating the
      // array in place must emit a replacement (or re-key) for the hold to
      // lift — the house consumers all do.
      arrangementHeld.value = false;
      arrangementSectionKey.value = null;
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

    function onHandlePointerdown(
      e: PointerEvent,
      index: number,
      sectionKey: string | null,
    ): void {
      if (reorderInert.value) return;
      // A live press already owns the engine. `rowDrag.start` would no-op,
      // but arming the strip for this second pointer would point the
      // in-flight drag at another section — and its next resolution would
      // abandon the gesture. Bail before touching the key.
      if (rowDrag.pressed.value) return;
      const previousKey = dragSectionKey.value;
      // Arm the strip's section BEFORE the engine reads `items()`: the
      // press's own row is looked up in the live (clamped) strip, and the
      // render-time index is only a fallback for a handle that somehow
      // left the table.
      dragSectionKey.value = props.sections ? sectionKey : null;
      const row = (e.currentTarget as HTMLElement | null)?.closest("tr");
      const strip = row ? liveRowEls().indexOf(row as HTMLElement) : index;
      if (strip < 0) {
        dragSectionKey.value = previousKey;
        return;
      }
      // Where the finger grabbed the row — the ghost hangs the strip's
      // lift off this point so the grab stays under the pointer.
      pressClientY = e.clientY;
      rowDrag.start(e, strip);
      if (!rowDrag.pressed.value) {
        // The engine refused the press (non-primary button, prevented
        // default, interactive target): never leave the strip armed for a
        // gesture that does not exist.
        dragSectionKey.value = previousKey;
      }
    }

    /** Keyboard twin of the drop: move one row one slot, CLAMPED to the
     *  row's section and emitted as flat indices (section offset + local
     *  pair). Runs on a focused handle, so plain ArrowUp/Down are
     *  unambiguous (no competing cursor semantics on a button) and are
     *  consumed even at the ends, where the row has nowhere to go. */
    function onHandleKeydown(
      e: KeyboardEvent,
      index: number,
      sectionKey: string | null,
    ): void {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      if (reorderInert.value) return;
      const delta = e.key === "ArrowUp" ? -1 : 1;
      if (props.sections) {
        const view =
          sectionKey == null
            ? null
            : sectionView.value.find((candidate) => candidate.section.key === sectionKey) ?? null;
        if (!view) return;
        const to = index + delta;
        if (index < 0 || to < 0 || index >= view.rows.length || to >= view.rows.length) return;
        commitReorder(view, index, to);
        return;
      }
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
      () =>
        props.columns.length +
        (props.selectable ? 1 : 0) +
        (props.draggable ? 1 : 0) +
        (props.manageable ? 1 : 0)
    );

    /** The one empty state: rendered inside the sole body when unsectioned,
     *  and as a trailing body when EVERY section is empty (each section
     *  still keeps its band — chest must keep unreachable/empty panels
     *  visible). */
    function renderEmptyRow() {
      return (
        <tr>
          <td colspan={totalCols.value} class="hk-table-empty">
            {slots.empty ? slots.empty() : (props.emptyText || t("hikari::table.noData", "No data"))}
          </td>
        </tr>
      );
    }

    /** One data row, shared by the unsectioned body and every section body.
     *  `localIndex` is the display index INSIDE its section (the index the
     *  `cell-<key>` slots receive and the clamped drag strip resolves
     *  against); `flatIndex` is the index in the concatenation of every
     *  section's rows (row identity fallback + selection + `reorder`
     *  emits). Unsectioned, the two are the same number. */
    function renderDataRow(
      row: Record<string, unknown>,
      localIndex: number,
      flatIndex: number,
      sectionKey: string | null,
    ) {
      const rowKey = getRowKey(row, flatIndex);
      // The FLIP shift this row rides under the live (or frozen)
      // arrangement — 0 for rows the arrangement leaves put. It travels to
      // the CELLS as a custom property, not as a row transform: `<tr>`
      // transforms are unreliable across engines (the predecessor lift
      // avoided them for exactly this), while a <td> is a plain box
      // everywhere — and a custom property is inert paint-wise, so the row
      // element only NAMES the shift and the stylesheet moves the paint.
      // A sectioned strip is measured from its OWN section's rows, so a row
      // outside the arrangement's section is never fed a strip index.
      const shiftPx = rowShift(
        sectionKey !== null && sectionKey !== arrangementSectionKey.value ? -1 : localIndex,
      );
      // `dragFrom` is a STRIP index and restarts at 0 in every section:
      // matching it against `localIndex` alone would dim/tint row 0 of
      // EVERY other section during a section-A drag. Require the row's own
      // section too.
      const rowDragging =
        rowDrag.dragging.value &&
        rowDrag.dragFrom.value === localIndex &&
        (sectionKey === null || sectionKey === dragSectionKey.value);
      return (
        <tr
          key={rowKey}
          class="hk-table-row"
          style={shiftPx ? { "--hk-drag-shift": `${shiftPx}px` } : undefined}
          data-shift={shiftPx ? "" : undefined}
          data-dragging={rowDragging ? "" : undefined}
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
                onPointerdown={(e: PointerEvent) =>
                  onHandlePointerdown(e, localIndex, sectionKey)
                }
                onKeydown={(e: KeyboardEvent) => onHandleKeydown(e, localIndex, sectionKey)}
              >
                <GripVertical size={14} aria-hidden="true" />
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
                  onChange={() => toggleRow(row, flatIndex)}
                />
                <span
                  class={[
                    "hk-table-checkbox",
                    "hk-table-checkbox-md",
                    selectedRowKeys.value.has(rowKey) ? "hk-table-checkbox-checked" : "",
                  ]}
                >
                  {selectedRowKeys.value.has(rowKey) && (
                    <Check class="hk-table-checkbox-icon" stroke-width={3} />
                  )}
                </span>
              </label>
            </td>
          )}
          {props.columns.map((col) => {
            const isSlotCell = Boolean(slots[`cell-${col.key}`]);
            const value = row[col.key];
            // ONE predicate behind the hover hint AND the
            // copy-affordance cursor (`pointer`, `data-copy-cell`): a DEFAULT text
            // cell advertises the copy affordance only when its
            // background click really copies — the td is a text
            // leaf that still RENDERS text (see `renderedText`).
            // Slot cells (chips/badges/wrappers) never take the
            // click on their td surface (only inner text leaves
            // copy) and `copyable: false` columns copy nothing,
            // so both keep the plain arrow — a deliberate
            // under-promise, never an over-promise (2026-11-07
            // user direction: a copy affordance on every cell
            // promised more than the handler does; badges carry
            // their own pointer/tooltip). A slot that renders
            // BARE text is the one case where the td surface
            // does copy and still stays unmarked: the slot owns
            // its own hints.
            const cellCopies =
              props.copyCells &&
              col.copyable !== false &&
              !isSlotCell &&
              renderedText(value) !== "";
            return (
              <td
                key={col.key}
                class={["hk-table-cell", col.align ? `hk-text-${col.align}` : ""]}
                data-copy-cell={cellCopies ? "" : undefined}
                title={cellCopies ? copyHint.value : undefined}
                onClick={(e: MouseEvent) =>
                  onCellClick(e, col, e.currentTarget as HTMLElement)
                }
              >
                {isSlotCell
                  ? slots[`cell-${col.key}`]!({ row, value, index: localIndex })
                  : value}
              </td>
            );
          })}
          {props.manageable && renderManageCell(row)}
        </tr>
      );
    }

    return () => {
      return (
      <div ref={wrapperHostRef} class="hk-table-host">
        <div ref={wrapperRef} class="hk-table-wrapper">
        <table
          class={tableCls.value}
          {...dragScope.value}
          data-copy-cells={props.copyCells ? "" : undefined}
        >
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
                        <Check class="hk-table-checkbox-icon" stroke-width={3} />
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
                    aria-label={col.headerLabel}
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
                      <ChevronUp class={[
                          "hk-table-sort-icon",
                          sortDirection.value === "desc" ? "hk-table-sort-icon-desc" : "",
                        ]} />
                    )}
                  </th>
                );
              })}
              {props.manageable && (
                <th class="hk-table-header-cell hk-table-manage-head" style={{ width: "36px" }}>
                  <span class="hk-table-sr-only">{t("hikari::table.rowActions", "Row actions")}</span>
                </th>
              )}
            </tr>
          </thead>
          {props.sections ? (
            <>
              {sectionView.value.map((view) => (
                <tbody
                  key={view.section.key}
                  class="hk-table-body hk-table-section-body"
                  data-section-key={view.section.key}
                >
                  {/* The band: a real rowgroup header, never a data row.
                      It carries no `.hk-table-row`, so the copy layer,
                      hover paint, drag-strip measurement, selection and the
                      ⋯ column all ignore it by construction. */}
                  <tr class="hk-table-section-row">
                    <th
                      class="hk-table-section-cell"
                      scope="rowgroup"
                      colspan={totalCols.value}
                    >
                      {slots.section
                        ? slots.section({ section: view.section, index: view.index })
                        : view.section.label != null
                          ? (
                            <span class="hk-table-section-label">{view.section.label}</span>
                          )
                          : null}
                    </th>
                  </tr>
                  {view.rows.map((row, localIndex) =>
                    renderDataRow(
                      row,
                      localIndex,
                      view.offset + localIndex,
                      view.section.key,
                    ),
                  )}
                </tbody>
              ))}
              {displayRows.value.length === 0 && (
                <tbody class="hk-table-body">{renderEmptyRow()}</tbody>
              )}
            </>
          ) : (
            <tbody class="hk-table-body">
              {sortedRows.value.length === 0
                ? renderEmptyRow()
                : sortedRows.value.map((row, index) =>
                    renderDataRow(row, index, index, null),
                  )}
            </tbody>
          )}
        </table>
        </div>
      </div>
      );
    };
  },
});
