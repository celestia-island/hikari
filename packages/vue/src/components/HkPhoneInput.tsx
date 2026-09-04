import { computed, defineComponent, nextTick, ref, useAttrs, watch, type PropType } from "vue";

import { ChevronDown } from "lucide-vue-next";

import { useI18n } from "../i18n/context";

import {
  DIAL_CODES,
  dialCodeName,
  formatE164,
  normalizeDial,
  resolveDial,
  type DialCodeEntry,
} from "../data/dialCodes";

import HkAffixPicker, { type HkAffixOption } from "./HkAffixPicker";
import HkInput from "./HkInput";
import "./HkPhoneInput.scss";

/**
 * HkPhoneInput — phone-number field with a country dial-code picker.
 *
 * A leading chip inside the field (dial code + caret) opens the shared
 * HkAffixPicker (single-select, searchable): country name + dial code
 * per row, live filter on top. The chip rides the LEFT edge of the
 * field — the natural reading order for "which country, then which
 * number" — while the number itself is typed after it.
 *
 *   - `modelValue` is the NATIONAL number only ("13812345678"); the
 *     country selection lives in `dialCode` ("+86" shape, normalized on
 *     emit). Splitting the two keeps callers free to store whatever
 *     they already store (a bare "86" works too — matched by dial).
 *   - The chip shows the resolved country's dial code in canonical "+…"
 *     shape. Unknown dial codes fall back to showing the normalized
 *     code alone.
 *   - Picking a row emits `update:dialCode` ("+…"), `dialchange`
 *     (same value) and refocuses the number field. Blurring the field
 *     emits `change` with the composed E.164 — use it to validate or
 *     submit without recomputing `formatE164` yourself.
 *
 * The number input sanitizes itself: only digits, spaces and dashes
 * survive (pasted "+86 138-1234-5678" becomes "138 1234-5678"), and
 * `inputmode="tel"` raises the dial pad on touch devices. The
 * catalog defaults to the bundled dictionary (China first); pass
 * `countries` to scope the list (e.g. mainland-only deployments).
 */
export const HkPhoneInput = defineComponent({
  name: "HkPhoneInput",
  // The root wrapper carries no meaningful semantics; DOM attributes
  // (inputmode, maxlength, aria-*) belong on the inner input.
  inheritAttrs: false,
  props: {
    /** National number only — never includes the dial code. */
    modelValue: { type: String, default: "" },
    /** Dial code in any shape: "+86", "86", "0086". Kept as given
     *  (canonicalized only for matching), so v-model round-trips. */
    dialCode: { type: String, default: "+86" },
    /** Country catalog. Defaults to the bundled dictionary. */
    countries: {
      type: Array as PropType<readonly DialCodeEntry[]>,
      default: () => DIAL_CODES,
    },
    placeholder: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
    label: { type: String, default: undefined },
    error: { type: String, default: undefined },
    hint: { type: String, default: undefined },
    required: { type: Boolean, default: false },
    name: { type: String, default: undefined },
    /** Fired when Enter is pressed inside the number field (form
     *  submit). Forwarded to the inner HkInput. */
    submitOnEnter: { type: Function, default: undefined },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
    "update:dialCode": (_dial: string) => true,
    /** Country picked from the list — payload "+86" shape. */
    dialchange: (_dial: string) => true,
    /** Field blurred — payload the composed E.164 ("" when empty). */
    change: (_e164: string) => true,
    focus: (_e: FocusEvent) => true,
    blur: (_e: FocusEvent) => true,
  },
  setup(props, { emit }) {
    const { t, locale } = useI18n();
    const attrs = useAttrs();

    const rootRef = ref<HTMLElement | null>(null);

    /** Canonical "+86" derived from the prop, whatever shape it is in. */
    const canonicalDial = computed(() => {
      const bare = normalizeDial(props.dialCode);
      return bare ? `+${bare}` : "";
    });

    /** The country the current dial code resolves to (first catalog
     *  match for shared prefixes like +1). */
    const activeEntry = computed(() =>
      resolveDial(props.dialCode, undefined, props.countries),
    );

    /** Picker rows come from the shared affix catalog shape; the
     *  keywords haystack keeps the old filter reach: en/zh names, ISO
     *  code, bare and zero-prefixed dial digits ("86"/"0086"). */
    const dialOptions = computed<readonly HkAffixOption[]>(() =>
      props.countries.map((c) => ({
        key: c.iso,
        label: dialCodeName(c, locale),
        meta: `+${c.dial}`,
        keywords: `${c.en} ${c.zh} ${c.iso} +${c.dial} 00${c.dial}`,
      })),
    );

    function pickCountry(iso: string) {
      const entry = props.countries.find((c) => c.iso === iso);
      if (!entry) return;
      const dial = `+${entry.dial}`;
      emit("update:dialCode", dial);
      emit("dialchange", dial);
      // Refocus the number field so pick-then-type flows without a
      // second tap (the chip's popup is the only focusable sibling).
      nextTick(() => {
        const el = rootRef.value?.querySelector<HTMLElement>("input");
        el?.focus();
      });
    }

    /** Emit the composed E.164 on blur ("" when the number is empty). */
    function onBlur(e: FocusEvent) {
      emit("blur", e);
      emit("change", formatE164(canonicalDial.value, props.modelValue));
    }

    function onInput(value: string) {
      // Digits, spaces and dashes only; everything else (plus signs,
      // parentheses, stray letters from a paste) drops out.
      const cleaned = value.replace(/[^\d\s-]/g, "");
      emit("update:modelValue", cleaned);
    }

    function chipLabel(): string {
      const bare = normalizeDial(props.dialCode);
      return bare ? `+${bare}` : t("hikari::phoneInput.dialCode", "+…");
    }

    return () => {
      const active = activeEntry.value;
      const nameFor = (entry: DialCodeEntry) =>
        dialCodeName(entry, locale);
      const inputAttrs = {
        inputmode: "tel" as const,
        maxlength: 18,
        ...attrs,
      };
      delete (inputAttrs as Record<string, unknown>).class;
      delete (inputAttrs as Record<string, unknown>).style;
      return (
        <div class="hk-phone-input" ref={rootRef}>
          <HkInput
            modelValue={props.modelValue}
            onUpdate:modelValue={onInput}
            placeholder={props.placeholder}
            disabled={props.disabled}
            readonly={props.readonly}
            size={props.size}
            label={props.label}
            error={props.error}
            hint={props.hint}
            required={props.required}
            name={props.name}
            onBlur={onBlur}
            autocomplete="tel-national"
            submitOnEnter={props.submitOnEnter}
            {...inputAttrs}
          >
            {{
              prefix: () => (
                <HkAffixPicker
                  options={dialOptions.value}
                  mode="single"
                  side="prefix"
                  selected={active?.iso ?? ""}
                  disabled={props.disabled || props.readonly}
                  chipClass="hk-phone-chip"
                  chipLabel={
                    active
                      ? `${nameFor(active)} ${chipLabel()} — ${t("hikari::phoneInput.chooseCountry", "Choose country code")}`
                      : t("hikari::phoneInput.chooseCountry", "Choose country code")
                  }
                  title={t("hikari::phoneInput.chooseCountry", "Choose country code")}
                  searchPlaceholder={t(
                    "hikari::phoneInput.searchCountries",
                    "Search country or code",
                  )}
                  emptyText={t("hikari::phoneInput.noMatches", "No matching country")}
                  onSelect={pickCountry}
                >
                  {{
                    chip: () => (
                      <>
                        <span class="hk-phone-chip-dial">{chipLabel()}</span>
                        <ChevronDown size={12} class="hk-phone-chip-caret" aria-hidden="true" />
                      </>
                    ),
                  }}
                </HkAffixPicker>
              ),
            }}
          </HkInput>
        </div>
      );
    };
  },
});

export default HkPhoneInput;
