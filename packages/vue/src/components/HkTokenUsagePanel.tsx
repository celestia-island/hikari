import { computed, defineComponent, type PropType } from "vue";
import { HDrawer, HListTransition } from "@celestia-island/hikari";

import type { HModelCosts, HModelUsageEntry } from "./HkChatTypes";
import { formatTokenCount, formatPriceUsd } from "../utils/format";
import { useI18n } from "../i18n/context";

import "./HkTokenUsagePanel.scss";

const modelBarColors = [
  "rgb(var(--color-primary))",
  "rgb(var(--color-success))",
  "rgb(var(--color-warning))",
  "rgb(var(--color-error))",
  "rgb(168 85 247)",
  "rgb(236 72 153)",
  "rgb(20 184 166)",
  "rgb(249 115 22)",
];

/**
 * HkTokenUsagePanel — read-only token metering drawer.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * Fully data-driven: the parent passes per-model entries, the
 * prompt/completion/total breakdown and (optionally) estimated costs as
 * plain numbers. No provider coupling — costs are precomputed upstream.
 *
 * Totals come in two flavors:
 * - split: pass `promptTokens` + `completionTokens` (the card shows all
 *   three rows);
 * - aggregate: pass `totalTokens` only — for sources that expose a bare
 *   aggregate (chest's usage.get has no prompt/completion split). The
 *   card then shows a single honest Total row instead of faking a split.
 */
export const HkTokenUsagePanel = defineComponent({
  name: "HkTokenUsagePanel",
  props: {
    modelValue: { type: Boolean, required: true },
    entries: {
      type: Array as PropType<HModelUsageEntry[]>,
      default: () => [],
    },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    /** Aggregate total — when set, overrides the prompt/completion split. */
    totalTokens: { type: Number as PropType<number | undefined>, default: undefined },
    /** Optional estimated costs in USD (per bucket). */
    costs: { type: Object as PropType<HModelCosts | null>, default: null },
    currency: { type: String, default: "$" },
  },
  emits: {
    "update:modelValue": (_v: boolean) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();

    const aggregate = computed(() => props.totalTokens != null);
    const totalTokens = computed(() =>
      props.totalTokens ?? props.promptTokens + props.completionTokens,
    );
    const totalCost = computed(() => {
      if (!props.costs) return null;
      return (props.costs.prompt ?? 0) + (props.costs.completion ?? 0) + (props.costs.cached ?? 0);
    });
    const maxTokens = computed(() => {
      if (!props.entries.length) return 1;
      return Math.max(...props.entries.map((m) => m.tokenCount), 1);
    });

    return () => (
      <HDrawer
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: boolean) => emit("update:modelValue", v)}
        title={t("hikari::tokenUsage.title", "Token Usage")}
        side="right"
        size="340px"
      >
        <div class="s-token-panel">
          {props.entries.length === 0 ? (
            <div class="s-token-panel-empty">
              {t("hikari::tokenUsage.noData", "No token usage data available.")}
            </div>
          ) : (
            <>
              {/* Totals card — aggregate mode shows a single honest Total
                  row; split mode shows prompt/completion/total. */}
              <div class="s-token-panel-total">
                {!aggregate.value && (
                  <>
                    <div class="s-token-panel-total-row">
                      <span>{t("hikari::tokenUsage.prompt", "Prompt")}</span>
                      <span class="s-token-panel-num">{formatTokenCount(props.promptTokens)}</span>
                    </div>
                    <div class="s-token-panel-total-row">
                      <span>{t("hikari::tokenUsage.completion", "Completion")}</span>
                      <span class="s-token-panel-num">{formatTokenCount(props.completionTokens)}</span>
                    </div>
                  </>
                )}
                <div class="s-token-panel-total-row is-total">
                  <span>{t("hikari::tokenUsage.total", "Total")}</span>
                  <span class="s-token-panel-num">{formatTokenCount(totalTokens.value)}</span>
                </div>
                {props.costs && (
                  <div class="s-token-panel-total-row is-cost">
                    <span>{t("hikari::tokenUsage.estimatedCost", "Est. cost")}</span>
                    <span class="s-token-panel-num">{formatPriceUsd(totalCost.value ?? 0, props.currency)}</span>
                  </div>
                )}
              </div>

              {/* Per-model breakdown */}
              <div class="s-token-panel-models">
                <div class="s-token-panel-models-title">{t("hikari::tokenUsage.byModel", "By model")}</div>
                <HListTransition tag="div" class="s-token-panel-model-list" variant="grow" move={false}>
                  {props.entries.map((m, i) => {
                    const pct = Math.round((m.tokenCount / maxTokens.value) * 100);
                    const color = modelBarColors[i % modelBarColors.length];
                    return (
                      <div key={m.model} class="s-token-panel-model">
                        <div class="s-token-panel-model-row">
                          <span class="s-token-panel-model-name" title={m.model}>{m.model}</span>
                          <span class="s-token-panel-model-count">{formatTokenCount(m.tokenCount)}</span>
                        </div>
                        <div class="s-token-panel-model-track">
                          <div class="s-token-panel-model-bar" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </HListTransition>
              </div>
            </>
          )}
        </div>
      </HDrawer>
    );
  },
});
