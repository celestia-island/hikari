import { defineComponent, nextTick, onScopeDispose, ref, watch, type PropType } from "vue";

import HSkeletonList from "./HkSkeletonList";
import HkLoadMore from "./HkLoadMore";
import "./HkInfiniteTail.scss";

/**
 * HkInfiniteTail — the DOM half of the infinite-list scaffold, mounted
 * directly after the list body (inside whatever scroll viewport the
 * host already uses; it never creates one). Paired with
 * `useInfinitePages`, the page state machine.
 *
 * State derivation (bind EXACTLY this — a first-page load must read as
 * `"loading"` too, or a short first page never auto-fills):
 *
 *     state = exhausted ? "end" : (loading || loadingMore) ? "loading" : "idle"
 *
 * - `"loading"` — a page is in flight: the animated skeleton
 *   placeholder rows (HkSkeletonList) occupy the tail, so the list
 *   reads as "more is arriving", not "the page ended". In manual mode
 *   the load-more button morphs to its in-place spinner instead
 *   (HkLoadMore's own loading contract).
 * - `"end"` — the machine is exhausted: the muted end note (and the
 *   shown/total progress counter when the host passes them).
 * - `"idle"` — more exists, nothing in flight. With `auto` (default)
 *   the invisible sentinel watches the viewport and emits `loadMore`
 *   as it approaches; with `auto={false}` the explicit load-more
 *   button (HkLoadMore) renders instead. NOTE: a failed page
 *   terminalizes the machine's walk — the tail keeps emitting
 *   `loadMore` as the sentinel re-enters view, but each emission is a
 *   no-op until the host calls `reload()` (the retry verb; the
 *   delivered rows stay on screen under the host's stale banner).
 *   Auto-retrying from the tail is deliberately not supported: the
 *   sentinel would re-fire on a fixed geometry with no backoff, one
 *   RPC per round trip, which locks a shared rate budget.
 *
 * The sentinel observes the BROWSER viewport (IntersectionObserver,
 * `rootMargin` lookahead), so it works inside any nested scroll
 * container without knowing which ancestor scrolls. Intersection
 * alone misses the "page landed but the tail is still on screen"
 * case (the observer does not re-fire without a geometry change), so
 * every `idle` entry re-checks the sentinel's rect on the next frame
 * and keeps filling until the tail actually leaves the viewport — the
 * auto-fill contract for short first screens.
 */
export const HkInfiniteTail = defineComponent({
  name: "HkInfiniteTail",
  props: {
    /** `loading` — fetching a later page (skeleton); `end` — exhausted
     * (end note); `idle` — more available, awaiting the sentinel. */
    state: {
      type: String as PropType<"idle" | "loading" | "end">,
      default: "idle" as const,
    },
    /** Auto-load on approach (default). `false` renders the explicit
     * load-more button instead of the invisible sentinel. */
    auto: { type: Boolean, default: true },
    /** Delivered item count (with `total`, the progress counter). */
    shown: { type: Number, default: undefined },
    /** Match count behind the windowed list. */
    total: { type: Number, default: undefined },
    /** Skeleton placeholder rows while a later page is in flight. */
    skeletonCount: { type: Number, default: 3 },
    /** Row height of the skeleton placeholders (match the host's row
     * height so the tail does not jump when real rows land). */
    skeletonItemHeight: { type: String, default: "40px" },
    /** Viewport lookahead in px before the tail enters view (default
     * 480 — about half a screen of runway). Live: a change re-observes
     * the sentinel with the new margin (the rect path reads it live
     * either way). */
    lookahead: { type: Number, default: 480 },
    /** Diagnostic hook: rendered as `data-label` on the (aria-hidden)
     * sentinel — for tests and DOM inspection, NOT an a11y name (the
     * sentinel is invisible geometry; the visible states carry their
     * own accessible text). */
    label: { type: String, default: undefined },
  },
  emits: {
    loadMore: () => true,
  },
  setup(props, { emit }) {
    const sentinelRef = ref<HTMLElement | null>(null);
    let io: IntersectionObserver | null = null;
    let rafHandle: number | null = null;
    let stopped = false;

    function maybeLoad(): void {
      if (stopped) return;
      if (props.state !== "idle") return;
      emit("loadMore");
    }

    function sentinelInView(): boolean {
      const el = sentinelRef.value;
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      if (rect.height === 0 && rect.width === 0) return false;
      // Mirror the observer's lookahead: the zone extends `lookahead`
      // px below the viewport bottom (and above the top, so a fast
      // upward fling back into the zone also counts).
      const vh = window.innerHeight || 0;
      return rect.top <= vh + props.lookahead && rect.bottom >= -props.lookahead;
    }

    function scheduleRectCheck(): void {
      if (stopped || rafHandle != null) return;
      rafHandle = requestAnimationFrame(() => {
        rafHandle = null;
        if (stopped) return;
        if (sentinelInView()) maybeLoad();
      });
    }

    function observe(): void {
      unobserve();
      const el = sentinelRef.value;
      if (!el || typeof IntersectionObserver === "undefined") return;
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) maybeLoad();
          }
        },
        { rootMargin: `${props.lookahead}px 0px ${props.lookahead}px 0px` },
      );
      io.observe(el);
    }

    function unobserve(): void {
      io?.disconnect();
      io = null;
    }

    // Sentinel mount/swap: attach the observer.
    watch(sentinelRef, (el) => {
      if (el && !stopped) observe();
      else unobserve();
    }, { flush: "post" });

    // A live `lookahead` change re-observes with the new margin (the
    // margin is baked into the observer at observe time; the rect path
    // above already reads it live).
    watch(
      () => props.lookahead,
      () => {
        if (sentinelRef.value && !stopped) observe();
      },
    );

    // Every transition INTO idle re-checks the geometry on the next
    // frame: a page that landed while the sentinel stayed on screen
    // produced no intersection change, but the list still needs its
    // next window (auto-fill).
    watch(
      () => props.state,
      (state, prev) => {
        if (state === "idle" && prev !== "idle") {
          void nextTick(scheduleRectCheck);
        }
      },
    );

    onScopeDispose(() => {
      stopped = true;
      unobserve();
      if (rafHandle != null) cancelAnimationFrame(rafHandle);
    });

    return () => {
      // Manual mode never renders the sentinel; the button is the
      // affordance. The end note renders in both modes.
      if (props.state === "end") {
        return (
          <HkLoadMore
            state="end"
            shown={props.shown}
            total={props.total}
          />
        );
      }
      if (props.state === "loading") {
        // Manual mode: the button morphs to its in-place spinner
        // (HkLoadMore's advertised loading contract) instead of being
        // replaced by skeletons — the affordance never disappears.
        if (!props.auto) {
          return (
            <HkLoadMore
              state="loading"
              shown={props.shown}
              total={props.total}
            />
          );
        }
        return (
          <div class="hk-infinite-tail-loading" role="status" aria-live="polite">
            <HSkeletonList
              count={props.skeletonCount}
              itemHeight={props.skeletonItemHeight}
            />
          </div>
        );
      }
      if (!props.auto) {
        return (
          <HkLoadMore
            state="idle"
            shown={props.shown}
            total={props.total}
            onLoadMore={() => maybeLoad()}
          />
        );
      }
      return (
        <div
          ref={sentinelRef}
          class="hk-infinite-tail-sentinel"
          aria-hidden="true"
          data-label={props.label}
        />
      );
    };
  },
});

export default HkInfiniteTail;
