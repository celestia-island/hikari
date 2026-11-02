// AI-generated: developed with a DeepSeek Harness agent (model GLM-5.3-flash); human-directed.

import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type PropType,
} from "vue";

import "./HkMasonry.scss";

/** What the `card` slot receives for one item. */
export interface MasonryCardSlotProps {
  item: unknown;
  /** Index inside the whole item stream (reading order). */
  index: number;
}

/** One packed placement: the card's identity and its stream position. */
interface MasonryEntry {
  key: string;
  item: unknown;
  index: number;
}

/**
 * HkMasonry — a lightweight, measured masonry: the item stream packs into
 * independent flex columns, each card dropped into the currently SHORTEST
 * column by its MEASURED height, so every column reads as one contiguous
 * stack (the waterfall guarantee: a column is a card after a card, never a
 * row band that waits for its tallest neighbour).
 *
 *   - **no scroll ownership, no virtualization** — the host scrolls; the
 *     component is a plain block that sizes itself from its content. The
 *     virtualized, scroll-owning, bucket-grouped sibling is HkWaterfall
 *     (chat streams); this is the primitive for bounded card sets that live
 *     inside a host's own scrolling surface (a modal body, a page section)
 *     and must pack densely anyway.
 *   - **measured, not estimated** — every card wrapper is observed; a
 *     content change inside a card (rows swapping in place) re-reports the
 *     height and everything BELOW it re-packs. CSS multicol was rejected
 *     for exactly this job: its balancer fragments content, and a stale
 *     balancer (older WebView2 / Android WebViews) kept the pre-change
 *     column height and CLIPPED the cards at the old bottom edge (wowsp
 *     spec panel, alternate-firing toggle, 2026-11). Flex columns have
 *     nothing to fragment — a card is placed whole or the layout is wrong.
 *   - **one fixed point** — a card's height depends only on the column
 *     width, and every column shares `flex: 1 1 0`, so a height measured
 *     in one column stays valid in all the others. The measure/pack loop
 *     therefore converges after one redistribution and cannot oscillate.
 *   - **reading order** — items walk FIRST -> LAST into the currently
 *     shortest column; heights not yet reported yet count as one unit, so
 *     an unmeasured stream packs count-greedy and corrects itself on the
 *     first observation pass.
 *
 * Slots: `card` (required), `empty`.
 */
export default defineComponent({
  name: "HkMasonry",
  props: {
    /** Items in reading order. */
    items: { type: Array as PropType<readonly unknown[]>, required: true },
    /** Stable key for a card — the height table and the cross-column moves
     *  are keyed by it. Without it the positional fallback keys the stream. */
    itemKeyOf: {
      type: Function as PropType<(item: unknown, index: number) => string>,
      default: undefined,
    },
    /** Column count, or `"auto"` to derive it from the measured width. */
    columns: { type: [Number, String] as PropType<number | "auto">, default: "auto" },
    /** Minimum column width (px) used by `columns="auto"`. */
    columnMinWidth: { type: Number, default: 220 },
    /** Accessible label for the masonry region. */
    ariaLabel: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    const rootEl = shallowRef<HTMLElement | null>(null);
    const measuredWidth = ref(0);
    /** Measured card heights (px, rounded) by item key. Replaced immutably
     *  so the pack recomputes through the ordinary ref tracking. */
    const heights = ref(new Map<string, number>());

    const columnCount = computed(() => {
      if (props.columns === "auto") {
        const width = measuredWidth.value;
        if (width <= 0) return 1;
        return Math.max(1, Math.floor(width / Math.max(1, props.columnMinWidth)));
      }
      const n = Math.floor(Number(props.columns));
      return Number.isFinite(n) && n > 0 ? n : 1;
    });

    const entries = computed<MasonryEntry[]>(() =>
      props.items.map((item, index) => ({
        key: String(props.itemKeyOf?.(item, index) ?? index),
        item,
        index,
      })),
    );

    /** Greedy shortest-column packing in READING order. A height the
     *  observers have not reported yet counts as ONE unit, not zero: with
     *  plain zeros every total stays equal and the strict-less scan would
     *  strand the whole stream in the first column. The unit keeps an
     *  unmeasured stream count-greedy (one card per placement breaks the
     *  next tie), and the observers correct it onto real heights. */
    const pack = computed<string[][]>(() => {
      const cols = columnCount.value;
      const out: string[][] = Array.from({ length: cols }, () => []);
      const totals = new Array(cols).fill(0);
      const table = heights.value;
      for (const entry of entries.value) {
        let target = 0;
        for (let c = 1; c < cols; c++) {
          if (totals[c] < totals[target]) target = c;
        }
        out[target].push(entry.key);
        totals[target] += table.get(entry.key) ?? 1;
      }
      return out;
    });

    /** Where each key landed: key -> column index. The render map and the
     *  observer-sync signature both read this. */
    const placement = computed(() => {
      const map = new Map<string, number>();
      pack.value.forEach((column, columnIndex) => {
        for (const key of column) map.set(key, columnIndex);
      });
      return map;
    });

    /** Column-assignment signature: changes exactly when some card moves
     *  between columns (a height report that only pads the receiving
     *  column must not spend an observer-diff pass). */
    const placementSignature = computed(() =>
      pack.value.map((column) => column.join("\u0000")).join("\u0001"),
    );

    const byKey = computed(() => {
      const map = new Map<string, MasonryEntry>();
      for (const entry of entries.value) map.set(entry.key, entry);
      return map;
    });

    const layout = computed(() =>
      Array.from({ length: columnCount.value }, (_, columnIndex) => ({
        columnIndex,
        cards: pack.value[columnIndex].map((key) => byKey.value.get(key)!),
        /** A column with no cards must not eat a width share (see scss). */
        empty: pack.value[columnIndex].length === 0,
      })),
    );

    // ── observation ─────────────────────────────────────────────────────
    let cardRo: ResizeObserver | null = null;
    let rootRo: ResizeObserver | null = null;
    /** Wrappers the card observer currently watches: key -> element. */
    const observed = new Map<string, HTMLElement>();

    function reportHeights(report: ResizeObserverEntry[]): void {
      let changed = false;
      const next = new Map(heights.value);
      for (const entry of report) {
        const el = entry.target as HTMLElement;
        const key = el.dataset.masonryKey;
        if (key === undefined) continue;
        // A zero-height report (a display:none subtree) must not poison the
        // table — keep the last known height instead.
        const h = Math.round(entry.contentRect.height);
        if (h <= 0 || next.get(key) === h) continue;
        next.set(key, h);
        changed = true;
      }
      if (changed) heights.value = next;
    }

    function registerCard(key: string, el: unknown): void {
      if (el) {
        const node = el as HTMLElement;
        observed.set(key, node);
        cardRo?.observe(node);
        return;
      }
      const node = observed.get(key);
      if (node) {
        cardRo?.unobserve(node);
        observed.delete(key);
      }
    }

    /** Stable per-key ref factories: a fresh arrow per render would make
     *  Vue call ref(null) + ref(el) on every patch, and the card observer
     *  would churn unobserve/observe for cards that never moved. */
    const cardRefFactories = new Map<string, (el: unknown) => void>();
    function cardRef(key: string): (el: unknown) => void {
      let factory = cardRefFactories.get(key);
      if (!factory) {
        factory = (el: unknown) => registerCard(key, el);
        cardRefFactories.set(key, factory);
      }
      return factory;
    }

    /** Drop observers for keys that left the stream (a watch on the
     *  placement signature covers arrival: new keys register through their
     *  own function refs the moment they render). */
    function pruneObserved(): void {
      const live = byKey.value;
      for (const key of cardRefFactories.keys()) {
        if (!live.has(key)) cardRefFactories.delete(key);
      }
      if (!cardRo) return;
      for (const [key, el] of observed) {
        if (!live.has(key)) {
          cardRo.unobserve(el);
          observed.delete(key);
        }
      }
    }

    onMounted(() => {
      if (typeof ResizeObserver === "undefined") return;
      cardRo = new ResizeObserver(reportHeights);
      rootRo = new ResizeObserver((entries) => {
        for (const entry of entries) measuredWidth.value = entry.contentRect.width;
      });
      if (rootEl.value) rootRo.observe(rootEl.value);
      // The function refs fired during the mount patch, before this hook
      // created the observer — their registrations no-op'd on the null
      // cardRo. Observe the registered set now; every LATER card arrives
      // through its ref with the observer already live.
      for (const node of observed.values()) cardRo.observe(node);
      pruneObserved();
    });

    onBeforeUnmount(() => {
      cardRo?.disconnect();
      cardRo = null;
      rootRo?.disconnect();
      rootRo = null;
      observed.clear();
      cardRefFactories.clear();
    });

    watch(placementSignature, () => {
      pruneObserved();
    });

    return () => {
      if (props.items.length === 0) {
        return (
          <div ref={rootEl} class="hk-masonry" aria-label={props.ariaLabel}>
            {slots.empty?.() ?? null}
          </div>
        );
      }
      return (
        <div
          ref={rootEl}
          class="hk-masonry"
          data-columns={columnCount.value}
          aria-label={props.ariaLabel}
        >
          {layout.value.map(({ columnIndex, cards, empty }) => (
            <div
              key={columnIndex}
              class="hk-masonry-col"
              data-empty={empty ? "" : undefined}
            >
              {cards.map(({ key, item, index }) => (
                <div key={key} class="hk-masonry-card" data-masonry-key={key} ref={cardRef(key)}>
                  {slots.card?.({ item, index })}
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    };
  },
});
