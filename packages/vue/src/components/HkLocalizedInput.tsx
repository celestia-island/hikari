import { computed, defineComponent, nextTick, ref, watch, type PropType } from "vue";

import { ChevronDown } from "lucide-vue-next";

import { useI18n } from "../i18n/context";

import HkBadge from "./HkBadge";
import HkInput from "./HkInput";
import HkMenu, { type HkMenuItem } from "./HkMenu";
import "./HkLocalizedInput.scss";

/** One selectable language in the editor's language menu. */
export interface HkLocaleOption {
  code: string;
  /** Display label — apps pass the SAME text their global language
   *  switcher shows (e.g. the autonym "简体中文" / "English"). The chip
   *  renders the bare label; menu rows render the label plus the
   *  parenthesized code, so the code lives only in the opened menu. */
  label: string;
  /** Optional flag glyph rendered in the menu rows, matching the app's
   *  language switcher rows when they carry one. */
  flag?: string;
}

/** Marker key for the "Add language" cascade root (never a real locale). */
const ADD_LANGUAGE_KEY = "__hkLocalizedInputAdd";

/** Marker prefix for the "Delete language" cascade: children use the
 *  synthetic key `<prefix>:<code>` so they can never collide with the
 *  first-level switch rows (whose keys are bare locale codes). */
const DELETE_LANGUAGE_KEY = "__hkLocalizedInputDelete";

/**
 * HkLocalizedInput — single-field multilingual text editor.
 *
 * One input that edits ONE language at a time. The text is centered (the
 * base `HkInput` element style) and a small badge-like language chip sits
 * wrapped on the RIGHT edge of the field:
 *
 *   - Click the field itself → normal text editing for the chip's language.
 *   - Click the chip → a cascading language menu (`HkMenu`, so desktop
 *     gets an anchored submenu and mobile a bottom-up sheet — identical
 *     behavior to the app-level language switcher):
 *       · rows for every language that already has a translation
 *         (click → switch the field to that language and keep editing);
 *       · an "Add language" cascade into the full locale catalog;
 *         picking one closes the menu and drops the field straight into
 *         edit state for the freshly added language;
 *       · a "Delete language" cascade (shown only when at least one
 *         translation exists) listing EVERY filled language — including
 *         the one being edited — as danger rows keyed by the synthetic
 *         `__hkLocalizedInputDelete:<code>` form. Deleting a language
 *         removes it from `translations`; when it is the language being
 *         edited the field falls back to `sourceLang` if that still
 *         holds a translation, else to the first remaining translation
 *         (or `sourceLang` itself once the map is empty).
 *
 * The chip shows ONLY the language label (the app-provided autonym,
 * e.g. "简体中文"); the locale code appears ONLY in the opened menu rows
 * ("简体中文 (zh-Hans)") so the code never burns space inside the field.
 * The popup participates in the shared modal/dropdown stacking contexts
 * via HkMenu's popup-manager integration — safe inside modals.
 *
 * Contract:
 *   - `modelValue` is ALWAYS the text of the language being edited.
 *   - every keystroke also emits `update:translations` with that
 *     language's value merged in (empty values prune the key), so a
 *     parent can persist drafts without listening to blur.
 *   - switching languages commits the current text, swaps `modelValue`
 *     to the target language's stored text ("" when none), and refocuses
 *     the field.
 *   - deleting a language emits `update:translations` without that key;
 *     deleting the language being edited additionally swaps `modelValue`
 *     and emits `languagechange` for the fallback language (sourceLang
 *     first, then the first remaining translation, else sourceLang).
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
    const menuOpen = ref(false);
    const chipRef = ref<HTMLElement | null>(null);
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
     *  code appears only in the menu rows. */
    const chipLabel = computed(() => localeLabel(editLang.value));

    /** Menu-row text: label + parenthesized code, e.g. "English (en)". */
    function menuLabel(code: string): string {
      return `${localeLabel(code)} (${code})`;
    }

    /** Languages with an existing translation, excluding the one being
     *  edited — those are the switch targets in the menu's first level. */
    const switchableCodes = computed(() =>
      filledCodes.value.filter((c) => c !== editLang.value),
    );

    /** Catalog entries not yet present in the translations map (and not
     *  currently being edited) — the "Add language" cascade children. */
    const addableOptions = computed(() =>
      props.localeOptions.filter(
        (o) =>
          o.code !== editLang.value &&
          !filledCodes.value.includes(o.code),
      ),
    );

    /** Key of a delete-cascade child for a locale code. */
    function deleteKey(code: string): string {
      return `${DELETE_LANGUAGE_KEY}:${code}`;
    }

    const menuItems = computed<HkMenuItem[]>(() => [
      ...switchableCodes.value.map((code) => ({
        key: code,
        label: menuLabel(code),
        flag: props.localeOptions.find((o) => o.code === code)?.flag,
      })),
      ...(addableOptions.value.length > 0
        ? [
            {
              key: ADD_LANGUAGE_KEY,
              label: t("hikari::localizedInput.addLanguage", "Add language"),
              children: addableOptions.value.map((o) => ({
                key: o.code,
                label: menuLabel(o.code),
                flag: o.flag,
              })),
            },
          ]
        : []),
      // Every filled language is deletable — including the one being
      // edited (deleting it falls back to another language, see
      // `deleteLanguage`).
      ...(filledCodes.value.length > 0
        ? [
            {
              key: DELETE_LANGUAGE_KEY,
              label: t("hikari::localizedInput.deleteLanguage", "Delete language"),
              danger: true,
              children: filledCodes.value.map((code) => ({
                key: deleteKey(code),
                label: menuLabel(code),
                flag: props.localeOptions.find((o) => o.code === code)?.flag,
                danger: true,
              })),
            },
          ]
        : []),
    ]);

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
        // only input/textarea inside this component's root (the menu
        // teleports to body), so a scoped query resolves it reliably.
        const el = rootRef.value?.querySelector<HTMLElement>("input, textarea");
        el?.focus();
      });
    }

    /** Switch the edited language (existing row or freshly added one):
     *  commit the current text, swap the field to the target language,
     *  close the menu, and resume editing focused. */
    function switchLanguage(code: string, opts: { viaWatch?: boolean } = {}) {
      if (!code || code === editLang.value || code === ADD_LANGUAGE_KEY) return;
      commitTranslations(editLang.value, props.modelValue);
      editLang.value = code;
      emit("update:modelValue", (props.translations[code] ?? "").trim());
      if (!opts.viaWatch) {
        menuOpen.value = false;
        focusField();
      }
      emit("languagechange", code);
    }

    /** Remove a language's translation via the menu's delete cascade:
     *  drop the key from `translations`, and when the deleted language
     *  is the one being edited move the field to a fallback — the
     *  source language if it still holds a translation, else the first
     *  remaining translation, else the source language itself. Deleting
     *  another language never disturbs the edit state. Either way the
     *  menu closes and the field regains focus. */
    function deleteLanguage(code: string) {
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
      menuOpen.value = false;
      focusField();
    }

    function onMenuSelect(key: string) {
      if (key.startsWith(`${DELETE_LANGUAGE_KEY}:`)) {
        deleteLanguage(key.slice(`${DELETE_LANGUAGE_KEY}:`.length));
        return;
      }
      switchLanguage(key);
    }

    return () => (
      <div class="hk-localized-input" ref={rootRef}>
        <HkInput
          modelValue={props.modelValue}
          onUpdate:modelValue={onInput}
          placeholder={props.placeholder}
          disabled={props.disabled}
          size={props.size}
          label={props.label}
        >
          {{
            suffix: () => (
              <button
                ref={(el: unknown) => {
                  chipRef.value = (el as HTMLElement) ?? null;
                }}
                type="button"
                class="hk-localized-input-chip"
                disabled={props.disabled || menuItems.value.length === 0}
                data-empty={filledCodes.value.length === 0 || undefined}
                aria-haspopup="menu"
                aria-expanded={menuOpen.value}
                aria-label={t(
                  "hikari::localizedInput.chooseLanguage",
                  "Choose editing language",
                )}
                title={t("hikari::localizedInput.chooseLanguage", "Choose editing language")}
                onClick={(e: MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  menuOpen.value = !menuOpen.value;
                }}
                onMousedown={(e: MouseEvent) => e.preventDefault()}
              >
                <HkBadge variant="primary" size="sm" class="hk-localized-input-chip-badge">
                  {chipLabel.value}
                </HkBadge>
                <ChevronDown size={12} class="hk-localized-input-chip-caret" />
              </button>
            ),
          }}
        </HkInput>
        <HkMenu
          variant="popup"
          items={menuItems.value}
          open={menuOpen.value}
          onUpdate:open={(v: boolean) => {
            menuOpen.value = v;
          }}
          onSelect={onMenuSelect}
          anchorRef={chipRef.value}
          placement="bottom-end"
          title={t("hikari::localizedInput.chooseLanguage", "Choose editing language")}
        />
      </div>
    );
  },
});

export default HkLocalizedInput;
