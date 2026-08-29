import { nextTick, onScopeDispose, ref, watch, type Ref, type WatchSource } from "vue";

/** Options for [useMeasuredHighlight]. */
export interface UseMeasuredHighlightOptions {
  /** The element that visually owns the highlight — make it
   *  `position: relative` so item `offsetLeft` is already relative to it. */
  container: Ref<HTMLElement | null>;
  /** Index of the active item within the matched items. Negative means
   *  "no active item" (the highlight clears); a too-large index clamps to
   *  the last item. */
  activeIndex: Ref<number>;
  /** Selector matching the measurable items inside `container`. */
  itemSelector: string;
  /** Extra reactive sources whose changes re-measure — pass the options /
   *  tabs array here so swapped item sets re-measure even when the active
   *  index number is unchanged. */
  extraSources?: WatchSource<unknown>[];
}

export interface MeasuredHighlight {
  /** Left offset (px) of the active item relative to `container`. */
  x: Ref<number>;
  /** Measured width (px) of the active item; 0 before a successful measure. */
  width: Ref<number>;
  /** Inner width (px) of the container, refreshed on every measurement
   *  pass — lets callers derive end-anchored geometry (e.g. a tail
   *  overlay spanning to the track end) without a second observer. */
  containerWidth: Ref<number>;
  /** True once a non-zero width has been measured — i.e. real layout was
   *  available (stays false under jsdom/happy-dom/SSR, where reads are 0). */
  ready: Ref<boolean>;
}

/**
 * Offset of `item` relative to `container`, robust to intermediate
 * positioned ancestors. `offsetLeft` is relative to the nearest positioned
 * ancestor (the offsetParent); when that is the container itself the value
 * is already container-relative. Otherwise accumulate offsetLeft up the
 * offsetParent chain until the container is reached — and if the chain
 * escapes without passing through the container (no positioned ancestor:
 * hidden subtrees, layout-less test environments, fixed items), fall back
 * to the direct offsetLeft read rather than reporting a wrong frame.
 */
function offsetWithin(item: HTMLElement, container: HTMLElement): number {
  if (item.offsetParent === container) return item.offsetLeft;
  let x = 0;
  let cur: HTMLElement | null = item;
  while (cur && cur !== container) {
    x += cur.offsetLeft;
    const parent = cur.offsetParent as HTMLElement | null;
    // Chain ended above the container (hidden subtree, or a layout-less
    // test environment): trust the direct offsetLeft read — 0 in real
    // hidden subtrees, the stubbed value under tests.
    if (!parent) return item.offsetLeft;
    if (parent === cur) return 0;
    cur = parent;
  }
  return cur === container ? x : item.offsetLeft;
}

/**
 * Measure the active item of a flat group (segmented options, tab triggers)
 * so a sliding highlight can follow real geometry instead of assumed equal
 * widths — `flex: 1 1 0` + `min-width: auto` lets overflowing labels widen
 * some items, which silently drifts percentage-math indicators.
 *
 * Measures after mount (nextTick), after `activeIndex` / `extraSources`
 * changes, on container resizes (ResizeObserver, when the environment
 * provides one), and once after `document.fonts.ready` so late font swaps
 * re-align the highlight. The observer is disconnected on scope dispose.
 *
 * jsdom/happy-dom/SSR-safe: layout reads return 0 there, so `ready` stays
 * false and callers keep their pre-measurement CSS fallback — nothing
 * throws and no NaN leaks (every number is finite-coerced to 0).
 */
export function useMeasuredHighlight(opts: UseMeasuredHighlightOptions): MeasuredHighlight {
  const x = ref(0);
  const width = ref(0);
  const containerWidth = ref(0);
  const ready = ref(false);

  let observer: ResizeObserver | null = null;

  function measure(): void {
    const containerEl = opts.container.value;
    if (!containerEl) return;
    containerWidth.value = Number.isFinite(containerEl.clientWidth) ? containerEl.clientWidth : 0;
    const items = containerEl.querySelectorAll<HTMLElement>(opts.itemSelector);
    if (items.length === 0) {
      width.value = 0;
      ready.value = false;
      return;
    }
    const raw = opts.activeIndex.value;
    if (raw < 0) {
      // Explicit "no active item" (e.g. modelValue matches no option):
      // clear the highlight instead of pointing at the first item.
      x.value = 0;
      width.value = 0;
      ready.value = false;
      return;
    }
    const idx = Math.min(raw, items.length - 1);
    const item = items[idx];
    if (!item) {
      width.value = 0;
      ready.value = false;
      return;
    }
    const nx = offsetWithin(item, containerEl);
    const nw = item.offsetWidth;
    x.value = Number.isFinite(nx) ? nx : 0;
    width.value = Number.isFinite(nw) ? nw : 0;
    ready.value = width.value > 0;
  }

  /** Re-measure after the current render flush commits layout. */
  function schedule(): void {
    void nextTick(measure);
  }

  watch(
    opts.container,
    (el) => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (el && typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(schedule);
        observer.observe(el);
      }
      schedule();
    },
    { immediate: true },
  );

  watch(() => opts.activeIndex.value, schedule);
  for (const source of opts.extraSources ?? []) watch(source, schedule);

  // Late font load changes label metrics — re-align once fonts settle.
  if (typeof document !== "undefined") document.fonts?.ready.then(schedule).catch(() => {});

  onScopeDispose(() => {
    observer?.disconnect();
    observer = null;
  });

  return { x, width, containerWidth, ready };
}
