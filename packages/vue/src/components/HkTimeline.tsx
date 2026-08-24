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
      const natural = Math.ceil(
        Array.from(el.children).reduce(
          (width, child) =>
            width + (child as HTMLElement).getBoundingClientRect().width,
          0,
        ),
      );
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

    function renderStep(idx: number, connector: "trail" | "none") {
      const step = props.steps[idx];
      const status: TimelineStepStatus =
        idx < currentIndex.value
          ? "completed"
          : idx === currentIndex.value
            ? "active"
            : "pending";

      const showConnector = connector === "trail";

      return (
        <div
          key={step.key}
          class="hk-timeline-step"
          data-status={status}
          data-last={!showConnector || undefined}
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
          {showConnector && (
            <div data-el="connector" />
          )}
        </div>
      );
    }

    return () => {
      if (windowed.value) {
        return (
          <div
            ref={host}
            class="hk-timeline"
            data-orientation={props.orientation}
            data-mode="window"
          >
            <div
              class="hk-timeline-window"
              data-side="before"
              data-fade={win.value.fadeBefore || undefined}
            >
              {win.value.beforeIndex >= 0
                ? renderStep(win.value.beforeIndex, "trail")
                : null}
            </div>
            <div class="hk-timeline-window" data-side="current">
              {renderStep(
                currentIndex.value,
                win.value.afterIndex >= 0 ? "trail" : "none",
              )}
            </div>
            <div
              class="hk-timeline-window"
              data-side="after"
              data-fade={win.value.fadeAfter || undefined}
            >
              {win.value.afterIndex >= 0
                ? renderStep(win.value.afterIndex, "none")
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
            return renderStep(idx, isLast ? "none" : "trail");
          })}
        </div>
      );
    };
  },
});
