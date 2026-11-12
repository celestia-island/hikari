// AI-generated: developed with the DeepSeek Harness agent (model DeepSeek V4.1 Flash); human-directed.
import { computed, defineComponent, type PropType } from "vue";

import { useI18n } from "../i18n/context";
import {
  canonicalMoneyText,
  currencySymbol,
  formatMoney,
  normalizeCurrency,
  type HkCurrency,
} from "../utils/currency";
import HkTooltip from "./HkTooltip";
import "./HkPrice.scss";

/** A secondary display currency plus the rate that converts the primary
 *  amount into it. `rate` is "how many reference units one primary unit
 *  buys"; `asOf` is an opaque, host-formatted timestamp (the component
 *  never parses or localizes dates it did not create). */
export interface HkPriceReference {
  currency: HkCurrency;
  rate: number;
  asOf?: string;
}

/**
 * HkPrice — the money-display atom: a currency code's minor-unit digits (or
 * an explicit `precision`), an optional unit suffix (`/1M`), an optional
 * reference conversion, and `tabular-nums` so a column of figures aligns
 * digit-for-digit.
 *
 * The reference conversion is STRICTLY OPTIONAL BY EVIDENCE: it renders only
 * when a reference is present AND its rate is a finite number above zero.
 * A missing, zero, negative or `NaN` rate renders the primary amount alone —
 * an amount is never converted by a guessed or defaulted rate, and the
 * approximate value always carries the rate and the as-of stamp that
 * produced it (tooltip + `title` fallback), so the number can be audited on
 * screen.
 *
 * A `null` / `undefined` / non-finite amount renders a calm em dash with a
 * "Not set" accessible name — never `0`, `NaN` or an empty box, because an
 * unfilled price and a zero price are different statements.
 */
export default defineComponent({
  name: "HkPrice",
  props: {
    /** The amount, in `currency`'s major units. `null` / `undefined` =
     *  not set. */
    amount: { type: Number as PropType<number | null | undefined>, default: undefined },
    currency: { type: Object as PropType<HkCurrency>, required: true },
    /** Fraction-digit override for the primary amount (defaults to the
     *  currency's minor-unit digits). */
    precision: { type: Number, default: undefined },
    /** Unit suffix rendered after the amount, e.g. `"/1M"`. */
    unit: { type: String, default: undefined },
    reference: {
      type: Object as PropType<HkPriceReference | null>,
      default: null,
    },
    variant: { type: String as PropType<"text" | "chip">, default: "text" },
    size: { type: String as PropType<"sm" | "md">, default: "md" },
  },
  setup(props) {
    const { t } = useI18n();

    const currency = computed(() => normalizeCurrency(props.currency));
    const precision = computed(() =>
      props.precision === undefined ? currency.value.decimals : props.precision,
    );
    const hasAmount = computed(
      () => typeof props.amount === "number" && Number.isFinite(props.amount),
    );
    const amount = computed(() => (typeof props.amount === "number" ? props.amount : 0));
    const primaryText = computed(() =>
      hasAmount.value ? formatMoney(amount.value, currency.value, { precision: precision.value }) : "",
    );
    const unitText = computed(() => String(props.unit ?? "").trim());
    const symbol = computed(() => currencySymbol(currency.value));

    /** Evidence for the conversion: finite, strictly positive rate. */
    const conversion = computed(() => {
      const reference = props.reference;
      if (!reference) return null;
      const rate = reference.rate;
      if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return null;
      const referenceCurrency = normalizeCurrency(reference.currency);
      if (referenceCurrency.code === "") return null;
      return {
        currency: referenceCurrency,
        rate,
        asOf: String(reference.asOf ?? "").trim(),
      };
    });

    const referenceText = computed(() => {
      const source = conversion.value;
      if (!source) return "";
      return formatMoney(amount.value * source.rate, source.currency, {
        precision: source.currency.decimals,
      });
    });

    /** The audit line: localized "approximate" + the rate + the as-of stamp.
     *  Rendered in the tooltip AND as the native `title` fallback so the
     *  figure is auditable without hover. */
    const referenceHint = computed(() => {
      const source = conversion.value;
      if (!source) return "";
      const approximate = t("hikari::money.approximate", "Approximate");
      const rate = t("hikari::money.rate", "1 {from} = {rate} {to}")
        .replace("{from}", currency.value.code)
        .replace("{rate}", canonicalMoneyText(source.rate, 8))
        .replace("{to}", source.currency.code);
      const asOf = source.asOf
        ? t("hikari::money.rateAsOf", "As of {date}").replace("{date}", source.asOf)
        : "";
      return [approximate, rate, asOf].filter((part) => part !== "").join(" · ");
    });

    const unsetLabel = computed(() => t("hikari::money.unset", "Not set"));

    const wrapperClass = computed(() => [
      "hk-price",
      props.variant === "chip" ? "hk-price-chip" : "hk-price-text",
      props.size === "sm" ? "hk-price-sm" : "hk-price-md",
    ]);

    const showReference = computed(
      () => hasAmount.value && conversion.value !== null && referenceText.value !== "",
    );

    return () => (
      <span class={wrapperClass.value}>
        {hasAmount.value ? (
          <span class="hk-price-primary">
            <span class="hk-price-symbol" aria-hidden="true">
              {symbol.value}
            </span>
            {/* Speech carries the CODE (a bare "$" is ambiguous — USD/CAD/
             *  AUD all use it), so the digits always name their currency. */}
            <span class="hk-price-sr">{currency.value.code}</span>
            <span class="hk-price-amount">{primaryText.value}</span>
            {unitText.value !== "" && <span class="hk-price-unit">{unitText.value}</span>}
          </span>
        ) : (
          <span class="hk-price-empty">
            <span class="hk-price-sr">{unsetLabel.value}</span>
            <span aria-hidden="true">—</span>
          </span>
        )}
        {showReference.value && (
          <HkTooltip text={referenceHint.value}>
            <span
              class="hk-price-reference"
              tabindex={0}
              // Native fallback for the popup's audit line (touch, SSR
              // snapshots, and any host that disables the overlay).
              title={referenceHint.value}
            >
              <span class="hk-price-sr">{t("hikari::money.approximate", "Approximate")}</span>
              <span class="hk-price-approx" aria-hidden="true">
                ≈
              </span>
              <span class="hk-price-ref-symbol" aria-hidden="true">
                {currencySymbol(conversion.value!.currency)}
              </span>
              <span class="hk-price-sr">{conversion.value!.currency.code}</span>
              <span class="hk-price-ref-amount">{referenceText.value}</span>
            </span>
          </HkTooltip>
        )}
      </span>
    );
  },
});
