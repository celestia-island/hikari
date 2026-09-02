import { computed, defineComponent, nextTick, ref, watch, type PropType } from "vue";

import { ChevronDown, Languages } from "lucide-vue-next";

import { useI18n } from "../i18n/context";

import HkAffixPicker, { type HkAffixOption } from "./HkAffixPicker";
import HkBadge from "./HkBadge";
import HkInput from "./HkInput";
import "./HkLocalizedInput.scss";

/** One selectable language in the editor's language menu. */
export interface HkLocaleOption {
  code: string;
  /** Display label — apps pass the SAME text their global language
   *  switcher shows (e.g. the autonym "简体中文" / "English"). The chip
   *  renders the bare label; the menu's language tags render the label
   *  plus a small code suffix, so the code lives only in the opened
   *  menu. */
  label: string;
  /** Optional flag glyph rendered in the menu tags, matching the app's
   *  language switcher rows when they carry one. */
  flag?: string;
}

/**
 * HkLocalizedInput — single-field multilingual text editor.
 *
 * One input that edits ONE language at a time. The text is centered (the
 * base `HkInput` element style), a leading `Languages` glyph balances the
 * field's left cushion against the wrapped language chip on the RIGHT
 * edge (both affixes are measured, so the centered line stays on the box
 * axis), and a small badge-like language chip rides the right edge:
 *
 *   - Click the field itself → normal text editing for the chip's language.
 *   - Click the chip → the shared HkAffixPicker (multi-select, right
 *     anchored, closes on pick so the field is immediately editable):
 *       · a TAG LIST of every language currently present — the one being
 *         edited carries the active dot. The × on a tag arms the delete
 *         (danger tint) and a second tap erases; the popup stays open
 *         after removals so several translations can be wiped in one
 *         pass, with squeeze-in / squeeze-out list transitions
 *         (HkListTransition, animation-context aware);
 *       · a SEARCHABLE list of the languages NOT yet present — typing
 *         filters, picking adds the language and drops the field
 *         straight into edit state for it. This replaces the old
 *         "Add language" cascade: same coverage, one fewer navigation
 *         step, and it scales to large locale catalogs.
 *
 *   - Deleting the language being edited moves the field to `sourceLang`
 *     if that still holds a translation, else to the first remaining
 *     translation (or `sourceLang` itself once the map is empty).
 *
 * The chip shows ONLY the language label (the app-provided autonym,
 * e.g. "简体中文"); the locale code appears ONLY inside the opened menu
 * (as a muted suffix on each tag) so the code never burns space inside
 * the field. The popup participates in the shared modal/dropdown stacking
 * contexts via HkMenu's popup-manager integration — safe inside modals.
 *
 * Set `multiline` to edit long-form translations: the field becomes an
 * auto-growing textarea (`rows` seeds the height, `autoGrow` lets it
 * stretch with the content) and the language chip pins to the field's
 * top-right corner.
 *
 * Contract:
 *   - `modelValue` is ALWAYS the text of the language being edited.
 *   - every keystroke also emits `update:translations` with that
 *     language's value merged in (empty values prune the key), so a
 *     parent can persist drafts without listening to blur.
 *   - switching languages commits the current text, swaps `modelValue`
 *     to the target language's stored text ("" when none), and refocuses
 *     the field.
 *   - erasing a language via its armed × emits `update:translations`
 *     without that key; erasing the language being edited additionally
 *     swaps `modelValue` and emits `languagechange` for the fallback
 *     language (sourceLang first, then the first remaining translation,
 *     else sourceLang).
 */
export const HkLocalizedInput = defineComponent({
  name: "HkLocalizedInput",
  props: {
    modelValue: { type: String, default: "" },
    /** Language the field edits until the user picks another from the
     *  chip menu. Defaults to the app locale ("en" when unset). */
    sourceLang: { type: String, default: "en" },
    /** Per-language values. Keys follow the app's locale codes. */
    translations: {
      type: Object as PropType<Record<string, string>>,
      default: () => ({}),
    },
    /** The app's locale catalog — same list its language switcher uses. */
    localeOptions: {
      type: Array as PropType<HkLocaleOption[]>,
      default: () => [],
    },
    /** Render the editor as an auto-growing textarea (long-form
     *  translations) instead of a single-line input. */
    multiline: { type: Boolean, default: false },
    /** Grow the multiline field with its content (multiline only). */
    autoGrow: { type: Boolean, default: false },
    /** Visible row count of the multiline field. */
    rows: { type: Number, default: 3 },
    label: { type: String, default: undefined },
    placeholder: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
    "update:translations": (_value: Record<string, string>) => true,
    /** Emitted after the edited language changes (switch or add). */
    languagechange: (_code: string) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();

    const editLang = ref(props.sourceLang);
    const rootRef = ref<HTMLElement | null>(null);

    // Follow the app locale: whenever the parent's sourceLang changes
    // (the app-level language switch moved), commit the current text
    // and move the field to the new language — same semantics as a
    // menu-driven switch, minus the focus grab (the user is busy
    // operating the app-level picker, not this field).
    watch(
      () => props.sourceLang,
      (lang) => {
        if (lang && lang !== editLang.value) switchLanguage(lang, { viaWatch: true });
      },
    );

    /** Non-empty translation codes, insertion-ordered. */
    const filledCodes = computed(() =>
      Object.keys(props.translations).filter(
        (k) => (props.translations[k] ?? "").trim().length > 0,
      ),
    );

    function localeLabel(code: string): string {
      return props.localeOptions.find((o) => o.code === code)?.label ?? code;
    }

    /** Chip text: the bare language label, e.g. "English" — the locale
     *  code appears only inside the opened menu. */
    const chipLabel = computed(() => localeLabel(editLang.value));

    /** Tags of the picker: EVERY language that holds a translation —
     *  the currently edited one included, even while it is still empty.
     *  Filled entries keep their insertion order; the edited language is
     *  appended when it has no text yet (or moves with the order it was
     *  filled in otherwise). */
    const selectedCodes = computed<readonly string[]>(() => {
      const codes = [...filledCodes.value];
      if (!codes.includes(editLang.value)) codes.push(editLang.value);
      return codes;
    });

    /** Catalog entries not yet present — the picker's add rows. */
    const addableCount = computed(
      () =>
        props.localeOptions.filter(
          (o) =>
            o.code !== editLang.value &&
            !filledCodes.value.includes(o.code),
        ).length,
    );

    /** The chip is useful while ANY interaction remains: at least one
     *  row to switch to / erase, or one language left to add. */
    const chipDisabled = computed(
      () =>
        props.disabled ||
        (filledCodes.value.length === 0 &&
          addableCount.value === 0 &&
          selectedCodes.value.length <= 1),
    );

    /** The shared picker catalog: autonym label, locale code as the
     *  muted meta suffix, flag when the app provides one. */
    const affixOptions = computed<readonly HkAffixOption[]>(() =>
      props.localeOptions.map((o) => ({
        key: o.code,
        label: o.label,
        meta: o.code,
        flag: o.flag,
      })),
    );

    function commitTranslations(code: string, value: string) {
      const next = { ...props.translations };
      const trimmed = value.trim();
      if (trimmed) {
        // Store trimmed so the stored map and the field content can
        // never diverge on whitespace-only padding.
        next[code] = trimmed;
      } else {
        delete next[code];
      }
      emit("update:translations", next);
    }

    function onInput(value: string) {
      emit("update:modelValue", value);
      commitTranslations(editLang.value, value);
    }

    function focusField() {
      nextTick(() => {
        // HkInput does not expose a focus method; its element is the
        // only input/textarea inside this component's root (the popup
        // teleports to body), so a scoped query resolves it reliably.
        const el = rootRef.value?.querySelector<HTMLElement>("input, textarea");
        el?.focus();
      });
    }

    /** Switch the edited language (tag body or a freshly added one):
     *  commit the current text, swap the field to the target language,
     *  close the picker, and resume editing focused. */
    function switchLanguage(code: string, opts: { viaWatch?: boolean } = {}) {
      if (!code) return;
      if (code === editLang.value) {
        // Already editing it (tag body click on the active tag): just
        // dismiss the picker and hand focus back to the field.
        if (!opts.viaWatch) {
          focusField();
        }
        return;
      }
      commitTranslations(editLang.value, props.modelValue);
      editLang.value = code;
      emit("update:modelValue", (props.translations[code] ?? "").trim());
      if (!opts.viaWatch) {
        focusField();
      }
      emit("languagechange", code);
    }

    /** Erase a language's translation via its armed tag ×: drop the key
     *  from `translations`, and when the erased language is the one
     *  being edited move the field to a fallback — the source language
     *  if it still holds a translation, else the first remaining
     *  translation, else the source language itself. Erasing another
     *  language never disturbs the edit state. The picker STAYS open so
     *  the tag list updates live (with the squeeze-out transition) and
     *  further tags can be erased. */
    function eraseLanguage(code: string) {
      // A ghost tag (mid-leave after an earlier erase, or a stale ×
      // from a parent re-render) can still be clicked — erasing an
      // already absent key must not re-emit or disturb the edit state.
      if (!(code in props.translations)) return;
      const next = { ...props.translations };
      delete next[code];
      emit("update:translations", next);
      if (code === editLang.value) {
        const remaining = Object.keys(next).filter(
          (k) => (next[k] ?? "").trim().length > 0,
        );
        const target =
          (next[props.sourceLang] ?? "").trim().length > 0
            ? props.sourceLang
            : (remaining[0] ?? props.sourceLang);
        editLang.value = target;
        emit("update:modelValue", (next[target] ?? "").trim());
        emit("languagechange", target);
      }
    }

    return () => {
      return (
        <div class="hk-localized-input" ref={rootRef} data-multiline={props.multiline || undefined}>
          <HkInput
            modelValue={props.modelValue}
            onUpdate:modelValue={onInput}
            placeholder={props.placeholder}
            placeholderVariant={props.multiline ? "truncate" : "marquee"}
            disabled={props.disabled}
            size={props.size}
            label={props.label}
            type={props.multiline ? "textarea" : "text"}
            rows={props.rows}
            autoGrow={props.autoGrow}
          >
            {{
              prefixIcon: () => (
                <Languages size={15} class="hk-localized-input-lead" aria-hidden="true" />
              ),
              suffix: () => (
                <HkAffixPicker
                  options={affixOptions.value}
                  mode="multi"
                  side="suffix"
                  selected={selectedCodes.value}
                  activeKey={editLang.value}
                  disabled={chipDisabled.value}
                  closeOnSelect={true}
                  chipClass="hk-localized-input-chip"
                  chipLabel={t(
                    "hikari::localizedInput.chooseLanguage",
                    "Choose editing language",
                  )}
                  title={t("hikari::localizedInput.chooseLanguage", "Choose editing language")}
                  searchPlaceholder={t(
                    "hikari::localizedInput.addLanguage",
                    "Add language",
                  )}
                  emptyText={t("hikari::localizedInput.noMatches", "No matching language")}
                  onSelect={(code: string) => switchLanguage(code)}
                  onRemove={(code: string) => eraseLanguage(code)}
                >
                  {{
                    chip: () => (
                      <>
                        <HkBadge variant="primary" size="sm" class="hk-localized-input-chip-badge">
                          {chipLabel.value}
                        </HkBadge>
                        <ChevronDown size={12} class="hk-localized-input-chip-caret" />
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

export default HkLocalizedInput;
