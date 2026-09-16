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

/** The container handle the waterfall uses: read the scroll element, ask the
 *  container to scroll to a node (it owns the offset math, which must run in
 *  the layout space the scroll offset lives in, not on drawn rects), and
 *  forward the container-only affordances — a host that needs to re-measure
 *  after slot content changed, or to read the live offset, should not have
 *  to reach past the waterfall for them. */
interface ScrollHost {
  getScrollElement: () => HTMLElement | undefined;
  scrollToElement: (el: HTMLElement | null, behavior?: ScrollBehavior) => void;
  scrollTo: (top: number, behavior?: ScrollBehavior) => void;
  getScrollTop: () => number;
  refresh: () => void;
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
     *  unnamed bucket. Absent = one flat list. Receives the item's index in
     *  the WHOLE stream, unlike `itemKeyOf`. */
    bucketOf: {
      type: Function as PropType<(item: unknown, index: number) => string | null | undefined>,
      default: undefined,
    },
    /** Stable key for a card (forwarded to `HWindowedItem`). Without it the
     *  windowed wrapper falls back to positional keys. Receives the item's
     *  index inside its own column. */
    itemKeyOf: {
      type: Function as PropType<(item: unknown, index: number) => string>,
      default: undefined,
    },
    /** Column count, or `"auto"` to derive it from the measured width. */
    columns: { type: [Number, String] as PropType<number | "auto">, default: 1 },
    /** Minimum column width (px) used by `columns="auto"`. */
    columnMinWidth: { type: Number, default: 320 },
    /** Estimated card height (px) for the windowing placeholder. The
     *  per-card form below wins when both are set. */
    estimatedItemHeight: { type: Number, default: 120 },
    /** Per-card estimate, for views whose cards differ by kind or by
     *  breakpoint — a single number mis-sizes every other tier, and a
     *  mis-sized placeholder reads as a blank gap in the list. Receives the
     *  item's index inside its own column. */
    estimatedItemHeightOf: {
      type: Function as PropType<(item: unknown, index: number) => number>,
      default: undefined,
    },
    /** Screens of overscan kept mounted on either side of the viewport. */
    overscanScreens: { type: Number, default: 1 },
    /** Whether list enter/leave/move animations run. Hosts turn this off
     *  while a bulk hydration lands, so fifty cards arriving in one patch do
     *  not animate at once. */
    animate: { type: Boolean, default: true },
    /** Active bucket key (`v-model:active-bucket`). An external write syncs
     *  the internal highlight; scrolling then re-derives it from the
     *  sections' geometry and emits the new key — while the user scrolls the
     *  component is the authority, so a mount-time deep link is settled by
     *  the geometry, not by the prop. */
    activeBucket: { type: String, default: undefined },
    /** How far (px) a section top must pass the viewport top to count as
     *  the active bucket. */
    activeThreshold: { type: Number, default: 24 },
    /** Opt in to back-to-top visibility reporting: the FAB appears past
     *  `backTopShow` px and hides again below `backTopHide` (hysteresis).
     *  `backTopShow` gates the whole signal — a lone `backTopHide` is
     *  ignored, since there would be no threshold to appear at. */
    backTopShow: { type: Number, default: undefined },
    /** Hide threshold of the hysteresis; only read when `backTopShow` is
     *  also set. Without it the signal falls back to the single
     *  `top > backTopShow` test. */
    backTopHide: { type: Number, default: undefined },
    /** Attribute carrying each section's bucket key. Override it when the
     *  consuming view (and its tests) already addresses sections by another
     *  name. Must be a plain `data-*` attribute; anything else falls back to
     *  the default. */
    sectionAttr: { type: String, default: "data-waterfall-bucket" },
    /** Accessible label for the waterfall region. */
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
    /** The attribute each section carries its bucket key on. The prop is
     *  free text, so it is validated before it can become a selector: only a
     *  plain `data-*` attribute passes, everything else falls back. */
    const sectionAttribute = computed(() => {
      const raw = props.sectionAttr;
      return /^data-[a-z0-9-]+$/.test(raw) ? raw : "data-waterfall-bucket";
    });

    /** The section element for a bucket key — matched through the attribute
     *  map, never through a selector built from the key itself: the key is
     *  data, and a key carrying a quote, a backslash or a newline would make
     *  such a selector throw. */
    function findBucketSection(key: string): HTMLElement | null {
      if (!scrollEl) return null;
      const attr = sectionAttribute.value;
      for (const section of scrollEl.querySelectorAll<HTMLElement>(`[${attr}]`)) {
        if (section.getAttribute(attr) === key) return section;
      }
      return null;
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
      const attr = sectionAttribute.value;
      const sections = scrollEl.querySelectorAll<HTMLElement>(`[${attr}]`);
      let best: string | undefined;
      for (const section of sections) {
        // Viewport-relative comparison: robust whichever ancestor is the
        // sections' offsetParent.
        if (section.getBoundingClientRect().top - viewportTop - props.activeThreshold <= 0) {
          best = section.getAttribute(attr) ?? undefined;
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

    /** Programmatic scrolls are JS-driven, so the CSS reduced-motion sheet
     *  cannot reach them: `behavior: "smooth"` would still animate. Read the
     *  preference the same way `HkAuthCard` does and snap instead. */
    function scrollBehavior(): ScrollBehavior {
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
      return reduced ? "auto" : "smooth";
    }

    /** Scroll the section for `key` to the top of the viewport.
     *
     *  The offset math belongs to the container: it measures in the layout
     *  space the scroll offset actually lives in, so a zoomed host (chest
     *  drives `documentElement.style.zoom`) or a nested viewport does not
     *  overshoot by the scale factor — a raw `getBoundingClientRect` delta
     *  overshoots by ~2x at 200% zoom. */
    function jumpToBucket(key: string) {
      const host = scrollHost.value;
      if (!host) return;
      const target = findBucketSection(key);
      if (!target) return;
      host.scrollToElement(target, scrollBehavior());
    }

    function backToTop() {
      scrollEl?.scrollTo({ top: 0, behavior: scrollBehavior() });
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

    // Re-attach whenever the host resolves late: the one-shot nextTick above
    // covers the normal mount order, and this covers a container that
    // reports its viewport only later (otherwise the view would silently
    // stay without scroll tracking).
    watch(scrollHost, () => {
      void nextTick(attach);
    });

    onBeforeUnmount(() => {
      scrollEl?.removeEventListener("scroll", onScroll);
      scrollEl = null;
      // The pending frame would otherwise run once against a null element;
      // the replaced views cancelled it explicitly, so keep that discipline.
      scrollRaf?.disconnect();
      scrollRaf = null;
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
      // Container affordances forwarded so a host never reaches past the
      // waterfall for them (see the ScrollHost note).
      scrollToElement: (el: HTMLElement | null, behavior?: ScrollBehavior) =>
        scrollHost.value?.scrollToElement(el, behavior),
      scrollTo: (top: number, behavior?: ScrollBehavior) =>
        scrollHost.value?.scrollTo(top, behavior),
      getScrollTop: () => scrollHost.value?.getScrollTop() ?? scrollEl?.scrollTop ?? 0,
      refresh: () => scrollHost.value?.refresh(),
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
          {{
            default: () =>
              buckets.value.length === 0
                ? (slots.empty?.() ?? null)
                : layout.value.map(({ bucket, columns }, bucketIndex) => (
                    <section
                      key={`${bucketIndex}\u0000${bucket.key}`}
                      class="hk-waterfall-bucket"
                      {...{ [sectionAttribute.value]: bucket.key }}
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
                            // An empty column — a bucket with fewer cards
                            // than columns — must not keep eating a share of
                            // the row, or the surviving card renders half
                            // width beside a ghost.
                            data-empty={column.length === 0 ? "" : undefined}
                            variant="reveal"
                            move={true}
                            disabled={!props.animate}
                          >
                            {column.map((item, index) => {
                              // The transition group requires a key on every
                              // child. `itemKeyOf` supplies the stable
                              // identity (so an arriving card animates only
                              // its own column); without it the positional
                              // fallback keeps the group valid at the cost of
                              // re-mounting rows when the list is prepended
                              // to.
                              const itemKey =
                                props.itemKeyOf?.(item, index) ??
                                `${bucket.key}#${columnIndex}#${index}`;
                              return (
                                <HWindowedItem
                                  key={itemKey}
                                  itemKey={itemKey}
                                  estimatedHeight={
                                    props.estimatedItemHeightOf?.(item, index) ??
                                    props.estimatedItemHeight
                                  }
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
                  )),
            // Forwarded so a view whose layout docks its own chrome (an
            // input bar under the list) keeps the container's dock contract
            // — including the `--hk-scroll-dock-*` heights it publishes.
            dockTop: slots.dockTop,
            dockBottom: slots.dockBottom,
          }}
        </HScrollContainer>
        {slots.overlay?.()}
      </div>
    );
  },
});
