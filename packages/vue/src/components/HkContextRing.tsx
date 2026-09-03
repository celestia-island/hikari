import { computed, defineComponent, onBeforeUnmount, ref, type PropType } from "vue";
import { HModelTag, HPopover, HProgressBar, HProgressRing } from "@celestia-island/hikari";

import type { PopupPlacement } from "./HkPopover";
import { formatTokenCount } from "../utils/format";
import { useI18n } from "../i18n/context";

import "./HkContextRing.scss";

/** One context-window component: keyed so the ring color and the default
 *  i18n label (`hikari::context.<key>`) resolve automatically. */
export interface HkContextSegment {
  key: string;
  /** Overrides the `hikari::context.<key>` i18n label. */
  label?: string;
  tokens: number;
  /** Any CSS color; defaults to `rgb(var(--context-<key>, <fallback>))`. */
  color?: string;
}

/**
 * Fallback "r g b" triples for the ring colors. Chest's extended palette
 * publishes each component under `--context-<key>` carrying the same
 * space-separated triple convention as the theme tokens; when the variable
 * is absent the fallback keeps the ring legible.
 */
const KEY_RGB: Record<string, string> = {
  prompt: "167 139 250", // violet
  user: "96 165 250", // blue
  thinking: "251 191 36", // amber
  tool: "52 211 153", // green
  output: "251 113 133", // rose
  free: "120 120 130", // gray
};

/** Unknown keys fall back to the free gray. */
const DEFAULT_RGB = "120 120 130";

/** English defaults for the standard keys (inline fallback for t()). */
const KEY_EN: Record<string, string> = {
  prompt: "Prompt",
  user: "User",
  thinking: "Thinking",
  tool: "Tool",
  output: "Output",
  free: "Free",
};

function segmentColor(seg: HkContextSegment): string {
  if (seg.color) return seg.color;
  return `rgb(var(--context-${seg.key}, ${KEY_RGB[seg.key] ?? DEFAULT_RGB}))`;
}

/** 0.123 -> "12.3%", 0.3 -> "30%" (one decimal, trailing zero trimmed). */
function formatPct(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

export const HkContextRing = defineComponent({
  name: "HkContextRing",
  props: {
    /** Model id; shown in the popover via HModelTag. */
    model: { type: String, required: true },
    /** Tokens used so far. null (or a missing window) degrades the ring to
     *  an empty gray ring with a "–" center. */
    used: { type: Number as PropType<number | null>, default: null },
    /** Context window size; the ring's 100%. */
    contextWindow: { type: Number as PropType<number | null>, default: null },
    segments: { type: Array as PropType<HkContextSegment[]>, default: () => [] },
    /** Ring diameter in px (card-corner default). */
    size: { type: Number, default: 28 },
    strokeWidth: { type: Number, default: 3 },
    placement: { type: String as PropType<PopupPlacement>, default: "bottom-start" },
    /** Show the "estimated" footnote in the popover. */
    estimated: { type: Boolean, default: false },
  },
  setup(props) {
    const { t } = useI18n();
    const anchorRef = ref<HTMLElement | null>(null);
    const open = ref(false);
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const hasWindow = computed(() => props.contextWindow != null && props.contextWindow > 0);
    /** null when there is no usable usage/window pair. */
    const usagePct = computed(() => {
      if (!hasWindow.value || props.used == null) return null;
      return (props.used / props.contextWindow!) * 100;
    });

    /** Center/aria percentage text: floored, "100+" past the window. */
    const pctText = computed(() => {
      const p = usagePct.value;
      if (p == null) return null;
      return p > 100 ? "100+" : `${Math.floor(p)}%`;
    });

    const centerText = computed(() => pctText.value ?? "–");

    const usable = computed(() => usagePct.value != null);

    const visibleSegments = computed(() =>
      props.segments.filter((s) => s && s.tokens > 0),
    );

    const windowPct = (tokens: number) =>
      (tokens / props.contextWindow!) * 100;

    /**
     * Arcs for the ring / blocks for the bar (segments mode).
     *
     * The per-category tokens are usually an ESTIMATE while `used` is the
     * authoritative total, so raw `tokens/window` shares need not sum to
     * the occupancy the center label claims. The arcs therefore partition
     * the occupied share proportionally (composition within occupancy);
     * the legend keeps the raw tokens/window stat. When composition is
     * unknown but occupancy is known, one muted arc carries the fill so
     * the ring never under-reports against its own center label.
     */
    const chartSegments = computed(() => {
      if (!usable.value) return [];
      const occupancy = Math.min(100, usagePct.value!);
      const sum = visibleSegments.value.reduce((acc, s) => acc + s.tokens, 0);
      if (sum <= 0) {
        return occupancy > 0
          ? [{ value: occupancy, color: segmentColor({ key: "free", tokens: 0 }) }]
          : [];
      }
      return visibleSegments.value.map((s) => ({
        value: occupancy * (s.tokens / sum),
        color: segmentColor(s),
      }));
    });

    /** Legend rows sorted by tokens desc (largest first). */
    const legend = computed(() =>
      usable.value
        ? [...visibleSegments.value]
            .sort((a, b) => b.tokens - a.tokens)
            .map((s) => ({
              label: s.label ?? t(`hikari::context.${s.key}`, KEY_EN[s.key] ?? s.key),
              tokens: s.tokens,
              pct: windowPct(s.tokens),
              color: segmentColor(s),
            }))
        : [],
    );

    const titleText = computed(() => t("hikari::context.title", "Context usage"));

    const ariaLabel = computed(() => {
      const base = `${titleText.value}: ${props.model}`;
      return pctText.value ? `${base} ${pctText.value}` : base;
    });

    const ringFontSize = computed(() => Math.max(6, Math.round(props.size * 0.3)));

    // Hover choreography copied from HkModelTag: 250ms delay to open,
    // 120ms to close; hovering the popover keeps it alive.
    function clearTimers() {
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
      showTimer = undefined;
      hideTimer = undefined;
    }
    function onEnter() {
      if (hideTimer) clearTimeout(hideTimer);
      if (showTimer) clearTimeout(showTimer);
      showTimer = setTimeout(() => { open.value = true; }, 250);
    }
    function onLeave() {
      if (showTimer) clearTimeout(showTimer);
      hideTimer = setTimeout(() => { open.value = false; }, 120);
    }
    function toggle() {
      clearTimers();
      open.value = !open.value;
    }
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    }

    // HkModelTag never clears on unmount, but a pending show/hide timer
    // firing on a dead instance is pure waste — drop both here.
    onBeforeUnmount(clearTimers);

    return () => {
      const windowText = hasWindow.value
        ? formatTokenCount(props.contextWindow!)
        : "–";

      return (
        <span
          class="hk-ctx-ring"
          role="button"
          tabindex={0}
          aria-label={ariaLabel.value}
          ref={anchorRef}
          onMouseenter={onEnter}
          onMouseleave={onLeave}
          onClick={toggle}
          onKeydown={onKeydown}
        >
          <HProgressRing
            segments={chartSegments.value}
            size={props.size}
            strokeWidth={props.strokeWidth}
          >
            <span class="hk-ctx-ring-center" style={{ fontSize: `${ringFontSize.value}px` }}>
              {centerText.value}
            </span>
          </HProgressRing>
          <HPopover
            modelValue={open.value}
            onUpdate:modelValue={(v: boolean) => { open.value = v; }}
            anchorRef={anchorRef.value}
            placement={props.placement}
            offset={6}
            backdrop={false}
            sheetOnMobile
            title={titleText.value}
            class="hk-ctx-popover"
          >
            <div class="hk-ctx-pop" onMouseenter={onEnter} onMouseleave={onLeave}>
              <div class="hk-ctx-pop-model">
                <HModelTag model={props.model} />
              </div>
              {usable.value ? (
                <>
                  <div class="hk-ctx-pop-total">
                    <span class="hk-ctx-pop-total-label">
                      {t("hikari::context.used", "Used")}
                    </span>
                    <span class="hk-ctx-pop-total-num">
                      {formatTokenCount(props.used!)}
                    </span>
                    <span class="hk-ctx-pop-total-of">
                      {t("hikari::context.of", "of")}
                    </span>
                    <span class="hk-ctx-pop-total-num">
                      {formatTokenCount(props.contextWindow!)}
                    </span>
                  </div>
                  <div class="hk-ctx-pop-bar">
                    <HProgressBar segments={chartSegments.value} />
                  </div>
                  <ul class="hk-ctx-legend">
                    {legend.value.map((row, i) => (
                      <li key={i} class="hk-ctx-legend-row">
                        <i class="hk-ctx-legend-swatch" style={{ background: row.color }} aria-hidden="true" />
                        <span class="hk-ctx-legend-label">{row.label}</span>
                        <span class="hk-ctx-legend-tokens">{formatTokenCount(row.tokens)}</span>
                        <span class="hk-ctx-legend-pct">{formatPct(row.pct)}</span>
                      </li>
                    ))}
                  </ul>
                  {props.estimated && (
                    <p class="hk-ctx-est">{t("hikari::context.estimated", "Estimated")}</p>
                  )}
                </>
              ) : (
                <div class="hk-ctx-pop-empty">
                  {t("hikari::context.window", "Context window")}: {windowText}
                </div>
              )}
            </div>
          </HPopover>
        </span>
      );
    };
  },
});
