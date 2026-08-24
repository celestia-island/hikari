import { computed, defineComponent, ref, type PropType } from "vue";
import { Brain, Eye, Wrench } from "lucide-vue-next";
import { HBadge, HPopover } from "@celestia-island/hikari";

import { getModelMeta, splitModelId, type HModelCatalog, type HModelMeta } from "./HkModelCatalog";
import { formatTokenCount, formatPriceUsd } from "../utils/format";
import { useI18n } from "../i18n/context";

import "./HkModelTag.scss";

/**
 * Pure visual pill — `#tag` + model-name rendered as ONE joined badge: a
 * divider line at the seam, no gap and no rounding at the junction (outer
 * corners keep the badge radius). The name segment truncates with an
 * ellipsis when the surrounding container is too narrow (min-width floor
 * keeps a couple of characters legible); the native `title` tooltip and
 * the hover card always carry the full model id.
 */
const ModelPill = defineComponent({
  name: "HkModelPill",
  props: {
    model: { type: String, required: true },
    /** Render the name without truncation (used inside the hover card). */
    expanded: { type: Boolean, default: false },
  },
  setup(props) {
    const { base, tag } = splitModelId(props.model);
    return () => (
      <span
        class="s-model-tag-group"
        data-expanded={props.expanded || undefined}
        title={props.model}
      >
        {tag && (
          <HBadge variant="primary" size="sm" mono pill={false} class="s-model-tag-num">
            #{tag}
          </HBadge>
        )}
        <HBadge variant="muted" size="sm" mono pill={false} class="s-model-tag-name">
          <span class="s-model-tag-name-text">{base}</span>
        </HBadge>
      </span>
    );
  },
});

/** Hover card showing context / pricing / capability hints. */
const ModelCard = defineComponent({
  name: "HkModelCard",
  props: {
    model: { type: String, required: true },
    meta: { type: Object as PropType<HModelMeta | undefined>, default: undefined },
    currency: { type: String, default: "$" },
  },
  setup(props) {
    const { t } = useI18n();

    interface GridRow { label: string; col2: string; col3: string; italic: boolean }

    return () => {
      const m = props.meta;
      const caps: { icon: typeof Eye; label: string }[] = [];
      if (m?.vision) caps.push({ icon: Eye, label: t("hikari::model.vision", "Vision") });
      if (m?.reasoning) caps.push({ icon: Brain, label: t("hikari::model.reasoning", "Reasoning") });
      if (m?.tools) caps.push({ icon: Wrench, label: t("hikari::model.tools", "Tools") });

      const inLabel = t("hikari::model.input", "Input");
      const outLabel = t("hikari::model.output", "Output");
      const cachedLabel = t("hikari::model.cached", "Cached");

      const rows: GridRow[] = [];

      const ctxLabel = t("hikari::model.context", "Context");
      const ctxVals: { val: string; dir: string }[] = [];
      if (m?.contextWindow != null) ctxVals.push({ val: formatTokenCount(m.contextWindow), dir: inLabel });
      if (m?.maxOutput != null) ctxVals.push({ val: formatTokenCount(m.maxOutput), dir: outLabel });
      ctxVals.forEach((c, i) => {
        rows.push({ label: i === 0 ? ctxLabel : "", col2: c.val, col3: c.dir, italic: true });
      });

      const priceLabel = t("hikari::model.pricing", "Pricing");
      if (m?.pricing) {
        const tiers: { price: number; suffix: string }[] = [];
        if (m.pricing.in != null) tiers.push({ price: m.pricing.in, suffix: inLabel });
        if (m.pricing.cached != null) tiers.push({ price: m.pricing.cached, suffix: cachedLabel });
        if (m.pricing.out != null) tiers.push({ price: m.pricing.out, suffix: outLabel });
        tiers.forEach((tier, i) => {
          rows.push({ label: i === 0 ? priceLabel : "", col2: formatPriceUsd(tier.price, props.currency), col3: tier.suffix, italic: true });
        });
      }

      return (
        <div class="s-model-card">
          <div class="s-model-card-title">
            <ModelPill model={props.model} expanded />
          </div>
          {rows.length > 0 && (
            <div class="s-model-card-stats">
              {rows.flatMap((r, i) => [
                <span key={`${i}-l`} class="s-model-card-col1">{r.label}</span>,
                <span key={`${i}-c2`} class="s-model-card-col2">{r.col2}</span>,
                <span key={`${i}-c3`} class={["s-model-card-col3", r.italic ? "s-model-card-italic" : ""].join(" ")}>{r.col3}</span>,
              ])}
            </div>
          )}
          {caps.length > 0 && (
            <div class="s-model-card-caps">
              {caps.map(({ icon: Icon, label }) => (
                <span key={label} class="s-model-card-cap">
                  <Icon size={11} />
                  {label}
                </span>
              ))}
            </div>
          )}
          {!m && (
            <div class="s-model-card-empty">{t("hikari::model.noData", "No spec available")}</div>
          )}
        </div>
      );
    };
  },
});

/**
 * HkModelTag — model pill with hover spec card.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * Renders the `#tag` + base-name pill; hovering shows context window,
 * pricing and capability hints from the model catalog. Services can pass
 * a per-instance `meta` (live data) or a `catalog` override; otherwise
 * the built-in catalog lookup applies.
 */
export const HkModelTag = defineComponent({
  name: "HkModelTag",
  props: {
    model: { type: String, required: true },
    /** Render size; sm matches the dense cruise badges. */
    size: { type: String as PropType<"sm" | "md">, default: "sm" },
    /** Explicit metadata override (live data from the service). */
    meta: { type: Object as PropType<HModelMeta | undefined>, default: undefined },
    /** Per-instance catalog override. */
    catalog: { type: Object as PropType<HModelCatalog | undefined>, default: undefined },
    currency: { type: String, default: "$" },
  },
  setup(props) {
    const anchorRef = ref<HTMLElement | null>(null);
    const open = ref(false);
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const meta = computed(() => props.meta ?? getModelMeta(props.model, props.catalog));

    function onEnter() {
      if (hideTimer) clearTimeout(hideTimer);
      showTimer = setTimeout(() => { open.value = true; }, 250);
    }
    function onLeave() {
      if (showTimer) clearTimeout(showTimer);
      hideTimer = setTimeout(() => { open.value = false; }, 120);
    }

    return () => (
      <span
        class="s-model-tag"
        data-size={props.size}
        ref={anchorRef}
        onMouseenter={onEnter}
        onMouseleave={onLeave}
      >
        <ModelPill model={props.model} />
        <HPopover
          modelValue={open.value}
          onUpdate:modelValue={(v: boolean) => { open.value = v; }}
          anchorRef={anchorRef.value}
          placement="top"
          offset={6}
          backdrop={false}
          closeOnBackdrop={false}
          closeOnEscape={false}
          class="s-model-card-popup"
        >
          <div onMouseenter={onEnter} onMouseleave={onLeave}>
            <ModelCard model={props.model} meta={meta.value} currency={props.currency} />
          </div>
        </HPopover>
      </span>
    );
  },
});
