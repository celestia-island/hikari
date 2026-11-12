// AI-generated: developed with the DeepSeek Harness agent (model DeepSeek V4.1 Flash); human-directed.
import { computed, defineComponent, nextTick, ref, useId, watch, type PropType } from "vue";
import { Check, ChevronDown, Search } from "lucide-vue-next";

import { activeLocale, useI18n } from "../i18n/context";
import { useBreakpoint } from "../runtime/useBreakpoint";
import {
  currencyDisplayName,
  currencySymbol,
  normalizeCurrency,
  type HkCurrency,
} from "../utils/currency";
import HkSelectPanel from "./HkSelectPanel";
import "./HkCurrencySelect.scss";

/**
 * One labeled section of the currency list.
 *
 * Membership is expressed by the group itself or by the currency, because
 * `HkCurrency` is deliberately a four-field value type (code / symbol / name
 * / decimals) that hosts reuse verbatim from their own models:
 *
 *  - `codes` — explicit members (case-insensitive currency codes). The usual
 *    shape for a "common currencies" band in front of the full list.
 *  - a `group` field attached to the currency object (an accepted structural
 *    extension, read as `{ ...currency, group?: string }`) — for hosts whose
 *    own model row already carries a category.
 *
 * The first declared group that claims a currency wins (declared order is
 * render order); anything unclaimed lands in a trailing localized "other"
 * section. Empty sections are not rendered, so a "custom currencies" band
 * simply disappears when the host has not added any.
 */
export interface HkCurrencyGroup {
  key: string;
  label: string;
  /** Explicit members by currency code (case-insensitive). */
  codes?: string[];
}

interface DecoratedCurrency {
  /** Normalized value object handed to the display helpers. */
  currency: HkCurrency;
  /** The host's original object (kept for the optional `group` field). */
  source: HkCurrency;
  /** Localized display name, resolved once per render. */
  name: string;
  /** Lower-cased search haystack (code + symbol + both names). */
  haystack: string;
}

interface CurrencyRow {
  currency: HkCurrency;
  /** Localized display name (already resolved for the active locale). */
  name: string;
  /** Position in the visible flat list — the keyboard/`data-select-index`
   *  index space. */
  index: number;
}

interface CurrencySection {
  key: string;
  label: string;
  items: CurrencyRow[];
}

/**
 * HkCurrencySelect — the rich currency picker: every row carries the symbol,
 * the code and the localized name, the list searches across all three, and
 * the keyboard drives it (arrows / Home / End / Enter, Escape from the
 * surface). The opened surface is HkSelectPanel — the SAME dropdown the
 * house select uses (desktop popout with anchor placement and auto-flip,
 * phone bottom sheet, popup stacking, back-gesture guard, outside-click and
 * Escape dismissal) — so this component owns only the field chrome, the row
 * model and its keyboard actives; it never hand-rolls an overlay.
 *
 * `modelValue` is the currency code (canonical: trimmed, upper-cased on
 * comparison) and `update:modelValue` emits a code — the amount's own
 * precision travels with the `HkCurrency` the host resolves from that code,
 * never through this component.
 */
export default defineComponent({
  name: "HkCurrencySelect",
  props: {
    /** Selected currency code. `""` means nothing selected yet. */
    modelValue: { type: String, default: "" },
    currencies: {
      type: Array as PropType<HkCurrency[]>,
      default: () => [] as HkCurrency[],
    },
    /** Optional labeled bands (see HkCurrencyGroup). Omitted: one flat
     *  searchable list. */
    groups: {
      type: Array as PropType<HkCurrencyGroup[]>,
      default: undefined,
    },
    label: { type: String, default: undefined },
    placeholder: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    error: { type: String, default: undefined },
    /** Search field inside the opened surface. Default true — a currency
     *  list is long by nature. */
    searchable: { type: Boolean, default: true },
  },
  emits: {
    "update:modelValue": (_code: string) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const { isMobile } = useBreakpoint();

    const open = ref(false);
    const query = ref("");
    const highlighted = ref(-1);
    const triggerRef = ref<HTMLElement>();
    const searchRef = ref<HTMLInputElement>();
    const panelExpose = ref<{ panelEl: () => HTMLElement | null }>();
    /** Stable id base for the trigger's option ids (aria-activedescendant).
     *  `useId` keeps SSR and client ids identical, so a hydrated page does
     *  not swap every option id on first paint. */
    const baseId = `hk-currency-select-${useId()}`;
    const errorId = `${baseId}-error`;

    const normalizedCode = computed(() => String(props.modelValue ?? "").trim().toUpperCase());

    /** Normalized rows with their localized display name and search tokens. */
    const decorated = computed<DecoratedCurrency[]>(() =>
      (props.currencies ?? []).map((source) => {
        const currency = normalizeCurrency(source);
        const localized = currencyDisplayName(
          currency.code,
          activeLocale(),
          currency.name ?? currency.code,
        );
        return {
          currency,
          source,
          name: localized,
          haystack: [currency.code, currency.symbol ?? "", currency.name ?? "", localized]
            .join(" ")
            .toLowerCase(),
        };
      }),
    );

    const filtered = computed<DecoratedCurrency[]>(() => {
      const tokens = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return decorated.value;
      return decorated.value.filter((entry) => tokens.every((token) => entry.haystack.includes(token)));
    });

    const otherLabel = computed(() => t("hikari::currency.otherGroup", "Other currencies"));

    /** Render plan: flat list, or the declared bands in order plus the
     *  trailing "other" bucket for unclaimed rows. */
    const sections = computed<CurrencySection[]>(() => {
      const declared = props.groups ?? [];
      if (declared.length === 0) {
        return [
          {
            key: "hk-currency-all",
            label: "",
            items: filtered.value.map((entry, index) => ({
              currency: entry.currency,
              name: entry.name,
              index,
            })),
          },
        ];
      }
      const claimed = new Set<string>();
      const out: CurrencySection[] = [];
      let cursor = 0;
      for (const group of declared) {
        const codes = new Set((group.codes ?? []).map((code) => String(code).trim().toUpperCase()));
        const members = filtered.value.filter((entry) => {
          if (claimed.has(entry.currency.code)) return false;
          const byCode = codes.has(entry.currency.code);
          const byField = (entry.source as HkCurrency & { group?: unknown }).group === group.key;
          if (byCode || byField) {
            claimed.add(entry.currency.code);
            return true;
          }
          return false;
        });
        if (members.length === 0) continue;
        out.push({
          key: group.key,
          label: group.label,
          items: members.map((entry) => ({
            currency: entry.currency,
            name: entry.name,
            index: cursor++,
          })),
        });
      }
      const rest = filtered.value.filter((entry) => !claimed.has(entry.currency.code));
      if (rest.length > 0) {
        out.push({
          key: "hk-currency-other",
          label: otherLabel.value,
          items: rest.map((entry) => ({
            currency: entry.currency,
            name: entry.name,
            index: cursor++,
          })),
        });
      }
      return out;
    });

    /** The visible rows in render order — the index space keyboard
     *  navigation and `data-select-index` both use. */
    const flat = computed(() => sections.value.flatMap((section) => section.items));

    const selectedEntry = computed(() => {
      const code = normalizedCode.value;
      if (code === "") return null;
      const found = decorated.value.find((entry) => entry.currency.code === code);
      if (found) return found;
      // A code the host has not listed still renders (Intl name, code glyph).
      const currency = normalizeCurrency({ code, decimals: 2 });
      return {
        currency,
        source: currency,
        name: currencyDisplayName(currency.code, activeLocale(), currency.code),
        haystack: currency.code.toLowerCase(),
      } satisfies DecoratedCurrency;
    });

    const placeholderText = computed(
      () => props.placeholder ?? t("hikari::currency.placeholder", "Select currency"),
    );
    const panelTitle = computed(() => props.label ?? placeholderText.value);
    const searchPlaceholder = computed(() => t("hikari::currency.search", "Search currencies"));
    const emptyText = computed(() => t("hikari::currency.empty", "No currencies found"));

    const activeDescendant = computed(() => {
      if (!open.value || highlighted.value < 0) return undefined;
      return `${baseId}-option-${highlighted.value}`;
    });

    const triggerClass = computed(() => [
      "hk-currency-select-trigger",
      props.error ? "hk-currency-select-trigger-error" : "",
    ]);

    function selectedIndexOf(): number {
      return flat.value.findIndex((item) => item.currency.code === normalizedCode.value);
    }

    function close() {
      open.value = false;
    }

    function toggle() {
      if (props.disabled) return;
      open.value = !open.value;
    }

    function select(code: string) {
      if (code !== normalizedCode.value) emit("update:modelValue", code);
      open.value = false;
      // The trigger is the focus anchor for the removed surface.
      void nextTick(() => triggerRef.value?.focus());
    }

    function move(delta: number) {
      const count = flat.value.length;
      if (count === 0) {
        highlighted.value = -1;
        return;
      }
      const current = highlighted.value;
      if (current < 0) {
        highlighted.value = delta > 0 ? 0 : count - 1;
        return;
      }
      highlighted.value = (current + delta + count) % count;
    }

    function scrollToHighlighted() {
      // Scope the row query to OUR panel: another open surface's rows may
      // carry the same data attribute (HkSelect's rule).
      const root = panelExpose.value?.panelEl() ?? null;
      if (!root) return;
      const row = root.querySelector<HTMLElement>(`[data-select-index="${highlighted.value}"]`);
      row?.scrollIntoView?.({ block: "nearest" });
    }

    function onTriggerKeydown(event: KeyboardEvent) {
      if (props.disabled) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!open.value) {
          open.value = true;
          const selected = selectedIndexOf();
          highlighted.value = selected >= 0 ? selected : 0;
        } else {
          move(event.key === "ArrowDown" ? 1 : -1);
        }
      } else if (event.key === "Escape" && open.value) {
        // Consume the key only when it actually closes something: the
        // trigger may sit inside a dialog that also closes on Escape.
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    }

    function onPanelKeydown(event: KeyboardEvent) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        move(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "Home") {
        event.preventDefault();
        highlighted.value = flat.value.length > 0 ? 0 : -1;
      } else if (event.key === "End") {
        event.preventDefault();
        highlighted.value = flat.value.length - 1;
      } else if (event.key === "Enter") {
        event.preventDefault();
        const item = flat.value[highlighted.value];
        if (item) select(item.currency.code);
      }
    }

    watch(open, (isOpen) => {
      if (isOpen) {
        const selected = selectedIndexOf();
        highlighted.value = selected >= 0 ? selected : flat.value.length > 0 ? 0 : -1;
        // The panel mounts on this tick (its surface machine owns the DOM),
        // so focus/scroll wait for the teleported content.
        void nextTick(() => {
          void nextTick(() => {
            if (!open.value) return;
            if (props.searchable) searchRef.value?.focus();
            scrollToHighlighted();
          });
        });
      } else {
        highlighted.value = -1;
        query.value = "";
      }
    });

    watch(
      () => flat.value.length,
      (count) => {
        if (!open.value) return;
        if (count === 0) {
          highlighted.value = -1;
          return;
        }
        if (highlighted.value < 0 || highlighted.value >= count) highlighted.value = 0;
      },
    );

    watch(highlighted, () => scrollToHighlighted());

    /** Pointer-hover highlighting is a desktop affordance only (a touch
     *  press on a sheet row must not paint a hover state). */
    const hoverHighlight = computed(() => !isMobile.value);

    function renderRow(item: CurrencyRow) {
      const selected = item.currency.code === normalizedCode.value;
      return (
        <div
          key={item.currency.code}
          id={`${baseId}-option-${item.index}`}
          class="hk-currency-select-option"
          role="option"
          aria-selected={selected ? "true" : "false"}
          data-select-index={item.index}
          data-highlighted={highlighted.value === item.index ? "" : undefined}
          data-checked={selected ? "" : undefined}
          onClick={() => select(item.currency.code)}
          {...(open.value && hoverHighlight.value
            ? {
                onPointerenter: () => {
                  highlighted.value = item.index;
                },
              }
            : {})}
        >
          <span class="hk-currency-select-symbol" aria-hidden="true">
            {currencySymbol(item.currency)}
          </span>
          <span class="hk-currency-select-code">{item.currency.code}</span>
          <span class="hk-currency-select-name">{item.name}</span>
          {selected && <Check size={14} class="hk-currency-select-check" aria-hidden="true" />}
        </div>
      );
    }

    const panelContent = () => (
      <div class="hk-currency-select-panel">
        {props.searchable && (
          <div class="hk-currency-select-search-row">
            <Search size={14} class="hk-currency-select-search-icon" aria-hidden="true" />
            <input
              ref={searchRef}
              class="hk-currency-select-search"
              type="text"
              autocomplete="off"
              spellcheck={false}
              value={query.value}
              placeholder={searchPlaceholder.value}
              aria-label={searchPlaceholder.value}
              onInput={(event: Event) => {
                query.value = (event.target as HTMLInputElement).value;
              }}
            />
          </div>
        )}
        {flat.value.length === 0 ? (
          <div class="hk-currency-select-empty" role="status">
            {emptyText.value}
          </div>
        ) : (
          <div
            class="hk-currency-select-list"
            role="listbox"
            aria-label={panelTitle.value}
            aria-activedescendant={activeDescendant.value}
          >
            {sections.value.map((section) =>
              section.label === "" ? (
                <div key={section.key} class="hk-currency-select-group" role="presentation">
                  {section.items.map(renderRow)}
                </div>
              ) : (
                <div
                  key={section.key}
                  class="hk-currency-select-group"
                  role="group"
                  aria-label={section.label}
                >
                  <div class="hk-currency-select-group-label" aria-hidden="true">
                    {section.label}
                  </div>
                  {section.items.map(renderRow)}
                </div>
              ),
            )}
          </div>
        )}
      </div>
    );

    return () => (
      <div class="hk-currency-select">
        {props.label && (
          <label class="hk-currency-select-label" for={`${baseId}-trigger`}>
            {props.label}
            {props.required && <span class="hk-currency-select-required">*</span>}
          </label>
        )}
        <button
          ref={triggerRef}
          id={`${baseId}-trigger`}
          type="button"
          class={triggerClass.value}
          data-disabled={props.disabled ? "" : undefined}
          data-state={open.value ? "open" : "closed"}
          data-error={props.error || undefined}
          disabled={props.disabled}
          aria-haspopup="listbox"
          aria-expanded={open.value ? "true" : "false"}
          aria-invalid={props.error ? "true" : undefined}
          aria-describedby={props.error ? errorId : undefined}
          onClick={toggle}
          onKeydown={onTriggerKeydown}
        >
          {selectedEntry.value ? (
            <span class="hk-currency-select-value">
              <span class="hk-currency-select-symbol" aria-hidden="true">
                {currencySymbol(selectedEntry.value.currency)}
              </span>
              <span class="hk-currency-select-code">{selectedEntry.value.currency.code}</span>
              <span class="hk-currency-select-name">{selectedEntry.value.name}</span>
            </span>
          ) : (
            <span class="hk-currency-select-value hk-currency-select-placeholder">
              {placeholderText.value}
            </span>
          )}
          <ChevronDown size={16} class="hk-currency-select-arrow" aria-hidden="true" />
        </button>
        <HkSelectPanel
          ref={panelExpose}
          open={open.value}
          onUpdate:open={(value: boolean) => {
            open.value = value;
          }}
          anchorRef={triggerRef.value ?? null}
          title={panelTitle.value}
          placement="bottom-start"
          offset={4}
          onKeydown={onPanelKeydown}
        >
          {panelContent()}
        </HkSelectPanel>
        {props.error ? (
          <p class="hk-currency-select-error" id={errorId} role="alert">
            {props.error}
          </p>
        ) : null}
      </div>
    );
  },
});
