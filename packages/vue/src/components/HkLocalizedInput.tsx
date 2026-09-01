import { computed, defineComponent, nextTick, ref, watch, type PropType } from "vue";

import { ChevronDown, X } from "lucide-vue-next";

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
   *  renders the bare label; the menu's language tags render the label
   *  plus a small code suffix, so the code lives only in the opened
   *  menu. */
  label: string;
  /** Optional flag glyph rendered in the menu tags, matching the app's
   *  language switcher rows when they carry one. */
  flag?: string;
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
 *   - Click the chip → the language menu (`HkMenu`, so desktop gets an
 *     anchored popout and mobile a bottom-up sheet — identical behavior
 *     to the app-level language switcher). The menu body is a TAG CLOUD:
 *       · one pill tag per language that already holds a translation —
 *         INCLUDING the one being edited (marked active). Clicking the
 *         tag body switches the field to that language and keeps editing;
 *       · an × on each tag's right edge ERASES that translation straight
 *         away — no separate "delete language" cascade anymore. The menu
 *         stays open so several translations can be wiped in one pass;
 *         the cloud updates live. Deleting the language being edited
 *         moves the field to `sourceLang` if that still holds a
 *         translation, else to the first remaining translation (or
 *         `sourceLang` itself once the map is empty);
 *       · an "Add language" cascade into the full locale catalog; picking
 *         one closes the menu and drops the field straight into edit
 *         state for the freshly added language.
 *
 * The chip shows ONLY the language label (the app-provided autonym,
 * e.g. "简体中文"); the locale code appears ONLY inside the opened menu
 * (as a small suffix on each tag) so the code never burns space inside
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
 *   - erasing a language via a tag × emits `update:translations` without
 *     that key; erasing the language being edited additionally swaps
 *     `modelValue` and emits `languagechange` for the fallback language
 *     (sourceLang first, then the first remaining translation, else
 *     sourceLang).
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
     *  code appears only inside the opened menu. */
    const chipLabel = computed(() => localeLabel(editLang.value));

    /** Catalog entries not yet present in the translations map (and not
     *  currently being edited) — the "Add language" cascade children. */
    const addableOptions = computed(() =>
      props.localeOptions.filter(
        (o) =>
          o.code !== editLang.value &&
          !filledCodes.value.includes(o.code),
      ),
    );

    /** The menu's action rows: only the "Add language" cascade remains —
     *  existing translations live in the tag cloud above it. */
    const menuItems = computed<HkMenuItem[]>(() =>
      addableOptions.value.length > 0
        ? [
            {
              key: ADD_LANGUAGE_KEY,
              label: t("hikari::localizedInput.addLanguage", "Add language"),
              children: addableOptions.value.map((o) => ({
                key: o.code,
                label: `${localeLabel(o.code)} (${o.code})`,
                flag: o.flag,
              })),
            },
          ]
        : [],
    );

    /** The chip is useful while ANY interaction remains: at least one
     *  translation to switch to / erase, or one language left to add. */
    const chipDisabled = computed(
      () => props.disabled || (filledCodes.value.length === 0 && menuItems.value.length === 0),
    );

    /** Accessible label of a tag's erase button, e.g.
     *  "Remove translation — English (en)". */
    function eraseLabel(code: string): string {
      return `${t("hikari::localizedInput.removeTranslation", "Remove translation")} — ${localeLabel(code)} (${code})`;
    }

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

    /** Switch the edited language (tag body or freshly added one):
     *  commit the current text, swap the field to the target language,
     *  close the menu, and resume editing focused. */
    function switchLanguage(code: string, opts: { viaWatch?: boolean } = {}) {
      if (!code || code === ADD_LANGUAGE_KEY) return;
      if (code === editLang.value) {
        // Already editing it (tag body click on the active tag): just
        // dismiss the menu and hand focus back to the field.
        if (!opts.viaWatch) {
          menuOpen.value = false;
          focusField();
        }
        return;
      }
      commitTranslations(editLang.value, props.modelValue);
      editLang.value = code;
      emit("update:modelValue", (props.translations[code] ?? "").trim());
      if (!opts.viaWatch) {
        menuOpen.value = false;
        focusField();
      }
      emit("languagechange", code);
    }

    /** Erase a language's translation via its tag's ×: drop the key
     *  from `translations`, and when the erased language is the one
     *  being edited move the field to a fallback — the source language
     *  if it still holds a translation, else the first remaining
     *  translation, else the source language itself. Erasing another
     *  language never disturbs the edit state. The menu STAYS open so
     *  the cloud updates live and further tags can be erased. */
    function eraseLanguage(code: string) {
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

    function onMenuSelect(key: string) {
      switchLanguage(key);
    }

    return () => (
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
            suffix: () => (
              <button
                ref={(el: unknown) => {
                  chipRef.value = (el as HTMLElement) ?? null;
                }}
                type="button"
                class="hk-localized-input-chip"
                disabled={chipDisabled.value}
                data-empty={filledCodes.value.length === 0 || undefined}
                aria-haspopup="menu"
                aria-expanded={menuOpen.value}
                aria-label={t(
                  "hikari::localizedInput.chooseLanguage",
                  "Choose editing language",
                )}
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
        >
          {{
            header: () =>
              filledCodes.value.length > 0 ? (
                <div
                  class="hk-localized-input-tags"
                  role="group"
                  aria-label={t(
                    "hikari::localizedInput.translations",
                    "Existing translations",
                  )}
                >
                  {filledCodes.value.map((code) => {
                    const active = code === editLang.value;
                    const option = props.localeOptions.find((o) => o.code === code);
                    return (
                      <span
                        key={code}
                        class="hk-localized-input-tag"
                        data-active={active || undefined}
                      >
                        <button
                          type="button"
                          class="hk-localized-input-tag-body"
                          title={`${localeLabel(code)} (${code})`}
                          onClick={() => switchLanguage(code)}
                        >
                          {option?.flag && (
                            <span class="hk-localized-input-tag-flag">{option.flag}</span>
                          )}
                          <span class="hk-localized-input-tag-label">{localeLabel(code)}</span>
                          <span class="hk-localized-input-tag-code">{code}</span>
                          {active && <span class="hk-localized-input-tag-dot" aria-hidden="true" />}
                        </button>
                        <button
                          type="button"
                          class="hk-localized-input-tag-x"
                          aria-label={eraseLabel(code)}
                          title={eraseLabel(code)}
                          onClick={(e: MouseEvent) => {
                            e.stopPropagation();
                            eraseLanguage(code);
                          }}
                        >
                          <X size={11} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : null,
          }}
        </HkMenu>
      </div>
    );
  },
});

export default HkLocalizedInput;
