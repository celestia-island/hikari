import { Check } from "lucide-vue-next";
import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType,
} from "vue";


import "./HkTimeline.scss";

export type TimelineStepStatus = "completed" | "active" | "pending";

export interface TimelineStep {
  key: string;
  label: string;
  icon?: string;
}

/**
 * How the horizontal timeline behaves when there is not enough width to lay
 * every step out in a row:
 *
 * - `"auto"` (default) — measure the host; when the full row would overflow,
 *   collapse into the three-cell window (previous / current / next) with the
 *   truncated edges fading out, and restore the full row once width returns.
 * - `"always"` — always render the window form (useful for narrow cards and
 *   for deterministic tests).
 * - `"never"` — always render the full row, the classic behavior.
 */
export type TimelineCollapse = "auto" | "always" | "never";

/** Which neighbours the compact window reveals around the current step. */
export interface TimelineWindowState {
  /** Index of the step shown left of the current one, or -1 at the start. */
  beforeIndex: number;
  /** Index of the step shown right of the current one, or -1 at the end. */
  afterIndex: number;
  /** Earlier steps exist beyond the window's left edge (fade that side). */
  fadeBefore: boolean;
  /** Later steps exist beyond the window's right edge (fade that side). */
  fadeAfter: boolean;
}

/**
 * Pure window computation for the compact mode so the layout logic is
 * unit-testable without a layout engine. At most one neighbour is shown on
 * each side of the current step; a side only fades when further hidden
 * steps continue past it.
 */
export function computeTimelineWindow(
  steps: TimelineStep[],
  currentKey: string,
): TimelineWindowState {
  const currentIndex = steps.findIndex((s) => s.key === currentKey);
  const has = (i: number): boolean => i >= 0 && i < steps.length;
  return {
    beforeIndex: has(currentIndex - 1) ? currentIndex - 1 : -1,
    afterIndex: has(currentIndex + 1) ? currentIndex + 1 : -1,
    fadeBefore: currentIndex - 1 > 0,
    fadeAfter: currentIndex + 1 < steps.length - 1,
  };
}

/**
 * Measure the row's natural (unshrunk) width.
 *
 * Summing the laid-out step rects is useless here: the steps are flex items
 * with `min-width: 0`, so when the row overflows they simply shrink to the
 * host's width and their rects always sum to ≈ `clientWidth` — the overflow
 * only shows as overlapping labels. The reliable way is an offscreen clone
 * sized to `max-content`, which lets the flex items keep their natural
 * widths (labels are `white-space: nowrap; flex-shrink: 0`).
 */
function naturalRowWidth(el: HTMLElement): number {
  const probe = el.cloneNode(true) as HTMLElement;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.width = "max-content";
  probe.style.whiteSpace = "nowrap";
  const parent = el.parentElement;
  if (!parent) return el.scrollWidth;
  parent.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return Math.ceil(width);
}

export default defineComponent({
  name: "HkTimeline",
  props: {
    steps: { type: Array as PropType<TimelineStep[]>, required: true },
    currentKey: { type: String, required: true },
    orientation: {
      type: String as PropType<"horizontal" | "vertical">,
      default: "horizontal",
    },
    clickable: { type: Boolean, default: false },
    collapse: {
      type: String as PropType<TimelineCollapse>,
      default: "auto",
    },
  },
  emits: {
    select: (_key: string) => true,
  },
  setup(props, { emit }) {
    const host = ref<HTMLElement | null>(null);
    const collapsed = ref(false);
    /** Full-row width captured right before collapsing; used as the
     *  expand-again threshold (plus hysteresis) while windowed. */
    let fullNaturalWidth = 0;
    let observer: ResizeObserver | undefined;

    const currentIndex = computed(() =>
      props.steps.findIndex((s) => s.key === props.currentKey),
    );

    /** The window only makes sense for a horizontal row with more steps
     *  than the window can show (a 3-step row is its own window). */
    const windowable = computed(
      () =>
        props.orientation === "horizontal" &&
        props.steps.length > 3 &&
        currentIndex.value >= 0,
    );

    const windowed = computed(
      () =>
        windowable.value &&
        (props.collapse === "always" ||
          (props.collapse === "auto" && collapsed.value)),
    );

    const win = computed(() =>
      computeTimelineWindow(props.steps, props.currentKey),
    );

    function statusOf(idx: number): TimelineStepStatus {
      return idx < currentIndex.value
        ? "completed"
        : idx === currentIndex.value
          ? "active"
          : "pending";
    }


    function measure(): void {
      const el = host.value;
      if (!el || !windowable.value || props.collapse !== "auto") {
        collapsed.value = false;
        return;
      }
      if (collapsed.value) {
        // Expand again only once the host comfortably fits the full row it
        // could not fit when we collapsed (16px hysteresis against flapping
        // around the exact threshold).
        if (fullNaturalWidth > 0 && el.clientWidth >= fullNaturalWidth + 16) {
          collapsed.value = false;
          fullNaturalWidth = 0;
        }
        return;
      }
      const natural = naturalRowWidth(el);
      if (natural > el.clientWidth + 1) {
        fullNaturalWidth = natural;
        collapsed.value = true;
      }
    }

    onMounted(() => {
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(() => measure());
        if (host.value) observer.observe(host.value);
      }
      void nextTick(measure);
    });

    onBeforeUnmount(() => {
      observer?.disconnect();
      observer = undefined;
    });

    // Labels and keys drive the row's natural width (locale switches rebuild
    // the steps array), so re-measure from a clean full-mode render whenever
    // they change.
    watch(
      () => [
        props.steps.map((s) => `${s.key} ${s.label}`).join(" "),
        props.orientation,
        props.collapse,
      ],
      () => {
        collapsed.value = false;
        fullNaturalWidth = 0;
        void nextTick(measure);
      },
    );

    function renderStep(idx: number, opts: { connector: boolean; last: boolean }) {
      const step = props.steps[idx];
      const status = statusOf(idx);

      return (
        <div
          key={step.key}
          class="hk-timeline-step"
          data-status={status}
          data-last={opts.last || undefined}
          aria-current={status === "active" ? "step" : undefined}
          data-clickable={(props.clickable && status === "completed") || undefined}
          role={props.clickable ? "button" : undefined}
          tabindex={props.clickable && status === "completed" ? 0 : undefined}
          onClick={() => {
            if (props.clickable && status === "completed")
              emit("select", step.key);
          }}
          onKeydown={(e: KeyboardEvent) => {
            if (
              props.clickable &&
              status === "completed" &&
              (e.key === "Enter" || e.key === " ")
            ) {
              e.preventDefault();
              emit("select", step.key);
            }
          }}
        >
          <span
            data-el="indicator"
            aria-hidden="true"
          >
            {status === "completed" && (
              <Check size={12} data-el="check" strokeWidth={3} />
            )}
            {status !== "completed" && (
              <span data-el="num">{idx + 1}</span>
            )}
          </span>
          <span data-el="label">{step.label}</span>
          {opts.connector && (
            <div data-el="connector" />
          )}
        </div>
      );
    }

    return () => {
      if (windowed.value) {
        // Window-mode layout: three fixed equal thirds — previous / current /
        // next stack VERTICALLY (indicator circle centered on top, single-line
        // ellipsised label below, see SCSS). Horizontal link segments drawn on
        // an overlay join the neighbouring node centers (16.6667% → 50% →
        // 83.3333%) and continue past a side's edge with a fading gradient
        // where hidden steps go on; edge cells stay empty when no neighbour
        // exists.
        const w = win.value;
        return (
          <div
            ref={host}
            class="hk-timeline"
            data-orientation={props.orientation}
            data-mode="window"
          >
            {(w.beforeIndex >= 0 || w.afterIndex >= 0) && (
              <div class="hk-timeline-links" aria-hidden="true">
                {w.beforeIndex >= 0 && (
                  <div
                    class="hk-timeline-link"
                    data-segment="before-current"
                    data-status={statusOf(w.beforeIndex)}
                  />
                )}
                {w.afterIndex >= 0 && (
                  <div
                    class="hk-timeline-link"
                    data-segment="current-after"
                    data-status={statusOf(w.afterIndex)}
                  />
                )}
                {w.beforeIndex >= 0 && w.fadeBefore && (
                  <div
                    class="hk-timeline-link"
                    data-segment="edge-before"
                    data-status={statusOf(w.beforeIndex)}
                    data-fade-dir="left"
                  />
                )}
                {w.afterIndex >= 0 && w.fadeAfter && (
                  <div
                    class="hk-timeline-link"
                    data-segment="edge-after"
                    data-status={statusOf(w.afterIndex)}
                    data-fade-dir="right"
                  />
                )}
              </div>
            )}
            <div
              class="hk-timeline-window"
              data-side="before"
              data-dimmed={(w.beforeIndex >= 0) || undefined}
            >
              {w.beforeIndex >= 0
                ? renderStep(w.beforeIndex, { connector: false, last: false })
                : null}
            </div>
            <div class="hk-timeline-window" data-side="current">
              {renderStep(currentIndex.value, { connector: false, last: false })}
            </div>
            <div
              class="hk-timeline-window"
              data-side="after"
              data-dimmed={(w.afterIndex >= 0) || undefined}
            >
              {w.afterIndex >= 0
                ? renderStep(w.afterIndex, { connector: false, last: false })
                : null}
            </div>
          </div>
        );
      }

      return (
        <div
          ref={host}
          class="hk-timeline"
          data-orientation={props.orientation}
          data-mode="full"
        >
          {props.steps.map((_step, idx) => {
            const isLast = idx === props.steps.length - 1;
            return renderStep(idx, { connector: !isLast, last: isLast });
          })}
        </div>
      );
    };
  },
});
