import { computed, defineComponent, nextTick, ref, type PropType } from "vue";

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
   *  switcher shows (e.g. the autonym "简体中文" / "English"), so the
   *  chip and the system picker never disagree. */
  label: string;
}

/** Marker key for the "Add language" cascade root (never a real locale). */
const ADD_LANGUAGE_KEY = "__hkLocalizedInputAdd";

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
 *       · last row "Add language" cascades into the full locale catalog;
 *         picking one closes the menu and drops the field straight into
 *         edit state for the freshly added language.
 *
 * The chip label is `{label} ({code})` using the app-provided label, and
 * the popup participates in the shared modal/dropdown stacking contexts
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
 */
export const HkLocalizedInput = defineComponent({
  name: "HkLocalizedInput",
  props: {
    modelValue: { type: String, default: "" },
    /** Language the field edits until the user picks another from the
     *  chip menu. Defaults to `sourceLang` (usually the app locale). */
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
    const inputRef = ref<{ focus: () => void } | HTMLElement | null>(null);

    /** Non-empty translation codes, insertion-ordered. */
    const filledCodes = computed(() =>
      Object.keys(props.translations).filter(
        (k) => (props.translations[k] ?? "").trim().length > 0,
      ),
    );

    function localeLabel(code: string): string {
      return props.localeOptions.find((o) => o.code === code)?.label ?? code;
    }

    /** Chip text: app label + parenthesized code, e.g. "English (en)". */
    const chipLabel = computed(
      () => `${localeLabel(editLang.value)} (${editLang.value})`,
    );

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

    const menuItems = computed<HkMenuItem[]>(() => [
      ...switchableCodes.value.map((code) => ({
        key: code,
        label: localeLabel(code),
      })),
      ...(addableOptions.value.length > 0
        ? [
            {
              key: ADD_LANGUAGE_KEY,
              label: t("hikari::localizedInput.addLanguage", "Add language"),
              children: addableOptions.value.map((o) => ({
                key: o.code,
                label: o.label,
              })),
            },
          ]
        : []),
    ]);

    function commitTranslations(code: string, value: string) {
      const next = { ...props.translations };
      const trimmed = value.trim();
      if (trimmed) {
        next[code] = value;
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
        const el = inputRef.value as HTMLElement | null;
        el?.focus?.();
      });
    }

    /** Switch the edited language (existing row or freshly added one):
     *  commit the current text, swap the field to the target language,
     *  close the menu, and resume editing focused. */
    function switchLanguage(code: string) {
      if (!code || code === editLang.value || code === ADD_LANGUAGE_KEY) return;
      commitTranslations(editLang.value, props.modelValue);
      editLang.value = code;
      emit("update:modelValue", (props.translations[code] ?? "").trim());
      menuOpen.value = false;
      emit("languagechange", code);
      focusField();
    }

    function onMenuSelect(key: string) {
      switchLanguage(key);
    }

    return () => (
      <div class="hk-localized-input">
        {props.label && (
          <label class="hk-localized-input-label">{props.label}</label>
        )}
        <HkInput
          ref={inputRef}
          modelValue={props.modelValue}
          onUpdate:modelValue={onInput}
          placeholder={props.placeholder}
          disabled={props.disabled}
          size={props.size}
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
