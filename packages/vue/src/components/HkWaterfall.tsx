import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type PropType,
} from "vue";

import "./HkWaterfall.scss";
import HListTransition from "./HkListTransition";
import HScrollContainer from "./HkScrollContainer";
import HWindowedItem from "./HkWindowedItem";
import { scheduleFrame, type AnimationHandle } from "../runtime/animationBus";

/** One bucket of a waterfall — a day section of the reports view, or the
 *  single unnamed section of an ungrouped list. */
export interface WaterfallBucket {
  /** Bucket identity, mirrored onto `data-waterfall-bucket` so a jump can
   *  address the section. Empty string for an ungrouped list. */
  key: string;
  items: readonly unknown[];
}

/** What the `card` slot receives for one item. */
export interface WaterfallCardSlotProps {
  item: unknown;
  /** Index inside its own column (render order), not inside the bucket. */
  index: number;
  bucketKey: string;
  bucketIndex: number;
}

/** What the `bucketHeader` slot receives for one bucket. */
export interface WaterfallHeaderSlotProps {
  bucketKey: string;
  bucketIndex: number;
  items: readonly unknown[];
}

/** What the `rail` slot receives — enough to draw a timeline that mirrors
 *  the buckets and drives jumps without owning the scroll element. */
export interface WaterfallRailSlotProps {
  buckets: readonly WaterfallBucket[];
  activeBucket: string | undefined;
  jumpToBucket: (key: string) => void;
}

/** The scroll-element handle the container exposes (narrowed: the waterfall
 *  only needs to read the element and scroll it). */
interface ScrollHost {
  getScrollElement: () => HTMLElement | undefined;
}

/**
 * HkWaterfall — the base view for bucket-grouped card waterfalls.
 *
 * The library-level parent the chat waterfalls (reports / history / node
 * list) share: it owns the MECHANISM and none of the content.
 *
 *   - **bucketing** — an optional `bucketOf` groups the item stream into
 *     ordered sections (the reports/history day buckets); without it the
 *     list renders as one unnamed section;
 *   - **columns** — each bucket is laid out into `columns` independent
 *     flex columns (1..n, or `"auto"` from the measured width and
 *     `columnMinWidth`). Items are assigned by walking OLDEST -> NEWEST
 *     and dropping each into the currently shortest column, then kept
 *     newest-first inside it: a newly prepended item — the newest — is
 *     walked last, so every older item keeps its column and only the
 *     receiving column animates;
 *   - **windowing** — every card is wrapped in `HWindowedItem` with the
 *     given `estimatedItemHeight`, inside an `HScrollContainer` running
 *     `mode="windowed"`;
 *   - **scroll contract** — rAF-throttled active-bucket tracking (the last
 *     section whose top passed `activeThreshold` below the viewport top),
 *     `jumpToBucket(key)`, `backToTop()`, and an opt-in back-to-top
 *     visibility signal so a consumer's FAB rides the same scroll pass
 *     instead of adding its own listener.
 *
 * Content arrives through slots: `card` (required), `bucketHeader`, `rail`
 * (drawn behind the scroller, e.g. a timeline), `overlay` (floating
 * affordances such as a back-to-top FAB) and `empty`.
 */
export default defineComponent({
  name: "HkWaterfall",
  props: {
    /** Items in display order (newest-first for the chat waterfalls). */
    items: { type: Array as PropType<readonly unknown[]>, required: true },
    /** Bucket key for an item; `null`/`undefined`/`""` lands in the same
     *  unnamed bucket. Absent = one flat list. */
    bucketOf: {
      type: Function as PropType<(item: unknown, index: number) => string | null | undefined>,
      default: undefined,
    },
    /** Stable key for a card (forwarded to `HWindowedItem`). Without it the
     *  windowed wrapper falls back to positional keys. */
    itemKeyOf: {
      type: Function as PropType<(item: unknown, index: number) => string>,
      default: undefined,
    },
    /** Column count, or `"auto"` to derive it from the measured width. */
    columns: { type: [Number, String] as PropType<number | "auto">, default: 1 },
    /** Minimum column width (px) used by `columns="auto"`. */
    columnMinWidth: { type: Number, default: 320 },
    /** Estimated card height (px) for the windowing placeholder. */
    estimatedItemHeight: { type: Number, default: 120 },
    overscanScreens: { type: Number, default: 1 },
    /** Controlled active bucket key (`v-model:active-bucket`). */
    activeBucket: { type: String, default: undefined },
    /** How far (px) a section top must pass the viewport top to count as
     *  the active bucket. */
    activeThreshold: { type: Number, default: 24 },
    /** Opt in to back-to-top visibility reporting: the FAB appears past
     *  `backTopShow` px and hides again below `backTopHide` (hysteresis). */
    backTopShow: { type: Number, default: undefined },
    backTopHide: { type: Number, default: undefined },
    ariaLabel: { type: String, default: undefined },
  },
  emits: ["update:activeBucket", "update:backTopVisible"],
  setup(props, { slots, expose, emit }) {
    const scrollHost = shallowRef<ScrollHost | null>(null);
    const rootEl = shallowRef<HTMLElement | null>(null);
    const activeKey = ref<string | undefined>(undefined);
    const backTopVisible = ref(false);
    const measuredWidth = ref(0);

    let scrollEl: HTMLElement | null = null;
    let scrollRaf: AnimationHandle | null = null;
    let ro: ResizeObserver | null = null;

    // ── bucketing ─────────────────────────────────────────────────────
    const buckets = computed<WaterfallBucket[]>(() => {
      const items = props.items;
      const bucketOf = props.bucketOf;
      if (!bucketOf) {
        return items.length > 0 ? [{ key: "", items }] : [];
      }
      const out: WaterfallBucket[] = [];
      const byKey = new Map<string, WaterfallBucket & { items: unknown[] }>();
      for (let i = 0; i < items.length; i++) {
        const raw = bucketOf(items[i], i);
        const key = typeof raw === "string" ? raw : "";
        let bucket = byKey.get(key);
        if (!bucket) {
          bucket = { key, items: [] };
          byKey.set(key, bucket);
          out.push(bucket);
        }
        bucket.items.push(items[i]);
      }
      return out;
    });

    // ── columns ───────────────────────────────────────────────────────
    const columnCount = computed(() => {
      if (props.columns === "auto") {
        const width = measuredWidth.value;
        if (width <= 0) return 1;
        return Math.max(1, Math.floor(width / Math.max(1, props.columnMinWidth)));
      }
      const n = Math.floor(Number(props.columns));
      return Number.isFinite(n) && n > 0 ? n : 1;
    });

    /** Distribute one bucket's items across `cols` columns: walk OLDEST ->
     *  NEWEST into the currently shortest column, then unshift so each
     *  column stays newest-first. A newly prepended (newest) item is the
     *  last step of the walk, so no older item changes column. */
    function distribute(items: readonly unknown[], cols: number): unknown[][] {
      const out: unknown[][] = Array.from({ length: cols }, () => []);
      for (let i = items.length - 1; i >= 0; i--) {
        let target = 0;
        for (let c = 1; c < cols; c++) {
          if (out[c].length < out[target].length) target = c;
        }
        out[target].unshift(items[i]);
      }
      return out;
    }

    const layout = computed(() =>
      buckets.value.map((bucket) => ({
        bucket,
        columns: distribute(bucket.items, columnCount.value),
      })),
    );

    // ── scroll ────────────────────────────────────────────────────────
    function selectorFor(key: string): string {
      return `[data-waterfall-bucket="${key.replace(/["\\]/g, "\\$&")}"]`;
    }

    function recomputeActive() {
      scrollRaf = null;
      if (!scrollEl) return;
      const top = scrollEl.scrollTop;

      if (props.backTopShow !== undefined) {
        const show = props.backTopShow;
        const hide = props.backTopHide;
        const next =
          hide !== undefined
            ? top > show
              ? true
              : top < hide
                ? false
                : backTopVisible.value
            : top > show;
        if (next !== backTopVisible.value) {
          backTopVisible.value = next;
          emit("update:backTopVisible", next);
        }
      }

      const viewportTop = scrollEl.getBoundingClientRect().top;
      const sections = scrollEl.querySelectorAll<HTMLElement>("[data-waterfall-bucket]");
      let best: string | undefined;
      for (const section of sections) {
        // Viewport-relative comparison: robust whichever ancestor is the
        // sections' offsetParent.
        if (section.getBoundingClientRect().top - viewportTop - props.activeThreshold <= 0) {
          best = section.dataset.waterfallBucket;
        } else {
          break;
        }
      }
      const next = best ?? buckets.value[0]?.key;
      if (next !== undefined && next !== activeKey.value) {
        activeKey.value = next;
        emit("update:activeBucket", next);
      }
    }

    function onScroll() {
      if (scrollRaf) return;
      scrollRaf = scheduleFrame(recomputeActive);
    }

    function getScrollElement(): HTMLElement | undefined {
      return scrollEl ?? undefined;
    }

    /** Scroll the section for `key` to the top of the viewport. The offset
     *  is computed against the raw scroll element (the handle the active
     *  tracking already relies on) so a jump can never throw. */
    function jumpToBucket(key: string) {
      if (!scrollEl) return;
      const target = scrollEl.querySelector<HTMLElement>(selectorFor(key));
      if (!target) return;
      const top =
        target.getBoundingClientRect().top -
        scrollEl.getBoundingClientRect().top +
        scrollEl.scrollTop;
      scrollEl.scrollTo({ top, behavior: "smooth" });
    }

    function backToTop() {
      scrollEl?.scrollTo({ top: 0, behavior: "smooth" });
    }

    function attach() {
      const next = scrollHost.value?.getScrollElement() ?? null;
      if (next === scrollEl) return;
      scrollEl?.removeEventListener("scroll", onScroll);
      scrollEl = next;
      scrollEl?.addEventListener("scroll", onScroll, { passive: true });
      recomputeActive();
    }

    onMounted(() => {
      // The scroll element resolves after the container mounts.
      void nextTick(attach);
      if (typeof ResizeObserver !== "undefined" && rootEl.value) {
        ro = new ResizeObserver((entries) => {
          for (const entry of entries) measuredWidth.value = entry.contentRect.width;
        });
        ro.observe(rootEl.value);
      }
    });

    onBeforeUnmount(() => {
      scrollEl?.removeEventListener("scroll", onScroll);
      scrollEl = null;
      ro?.disconnect();
      ro = null;
    });

    watch(
      () => props.activeBucket,
      (value) => {
        if (value !== undefined && value !== activeKey.value) activeKey.value = value;
      },
    );

    expose({
      getScrollElement,
      jumpToBucket,
      backToTop,
      buckets,
      activeBucket: activeKey,
      backTopVisible,
    });

    return () => (
      <div
        ref={rootEl}
        class="hk-waterfall"
        data-columns={columnCount.value}
        aria-label={props.ariaLabel}
      >
        {slots.rail?.({
          buckets: buckets.value,
          activeBucket: activeKey.value,
          jumpToBucket,
        })}
        <HScrollContainer
          ref={scrollHost}
          class="hk-waterfall-scroll"
          mode="windowed"
          overscanScreens={props.overscanScreens}
        >
          {buckets.value.length === 0
            ? (slots.empty?.() ?? null)
            : layout.value.map(({ bucket, columns }, bucketIndex) => (
                <section
                  key={bucket.key || "__waterfall_all__"}
                  class="hk-waterfall-bucket"
                  data-waterfall-bucket={bucket.key}
                >
                  {slots.bucketHeader?.({
                    bucketKey: bucket.key,
                    bucketIndex,
                    items: bucket.items,
                  })}
                  <div class="hk-waterfall-columns">
                    {columns.map((column, columnIndex) => (
                      <HListTransition
                        key={columnIndex}
                        tag="div"
                        class="hk-waterfall-column"
                        variant="reveal"
                        move={true}
                      >
                        {column.map((item, index) => {
                          // The transition group requires a key on every
                          // child. `itemKeyOf` supplies the stable identity
                          // (so an arriving card animates only its own
                          // column); without it the positional fallback
                          // keeps the group valid at the cost of re-mounting
                          // rows when the list is prepended to.
                          const itemKey =
                            props.itemKeyOf?.(item, index) ??
                            `${bucket.key}#${columnIndex}#${index}`;
                          return (
                            <HWindowedItem
                              key={itemKey}
                              itemKey={itemKey}
                              estimatedHeight={props.estimatedItemHeight}
                              overscanScreens={props.overscanScreens}
                            >
                              {slots.card?.({
                                item,
                                index,
                                bucketKey: bucket.key,
                                bucketIndex,
                              })}
                            </HWindowedItem>
                          );
                        })}
                      </HListTransition>
                    ))}
                  </div>
                </section>
              ))}
        </HScrollContainer>
        {slots.overlay?.()}
      </div>
    );
  },
});
