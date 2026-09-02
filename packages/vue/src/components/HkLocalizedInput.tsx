import { computed, defineComponent, nextTick, ref, watch, type PropType } from "vue";

import { ChevronDown, Languages, X } from "lucide-vue-next";

import { useI18n } from "../i18n/context";

import HkBadge from "./HkBadge";
import HkInput from "./HkInput";
import HkListTransition from "./HkListTransition";
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
 * base `HkInput` element style), a leading `Languages` glyph balances the
 * field's left cushion against the wrapped language chip on the RIGHT
 * edge (both affixes are measured, so the centered line stays on the box
 * axis), and a small badge-like language chip rides the right edge:
 *
 *   - Click the field itself → normal text editing for the chip's language.
 *   - Click the chip → the language menu (`HkMenu`, so desktop gets an
 *     anchored popout and mobile a bottom-up sheet — identical behavior
 *     to the app-level language switcher). The menu body is a LANGUAGE
 *     LIST — one row per language currently present, INCLUDING the one
 *     being edited (its row carries the active tint and shows an italic
 *     "enter text" hint while it holds no text):
 *       · LEFT side of a row = the already-edited translation text;
 *       · RIGHT side = the same language chip as the closed field —
 *         click it to ARM deletion: the row turns danger-red and an ×
 *         button appears IN PLACE of the chip (no slide, no layout
 *         shift — just an instant swap in the same slot);
 *       · clicking the × erases the translation for real. On TOUCH the
 *         arm is the guard (tap the chip, then tap the × that appears);
 *         on DESKTOP hovering the row swaps in the × and a single click
 *         on it erases — the hover IS the preview, the click the
 *         confirm. The menu stays open so several translations can be
 *         wiped in one pass; the list updates live with squeeze-in /
 *         squeeze-out list transitions (HkListTransition, which reports
 *         to the animation context and honors reduced motion). Deleting
 *         the language being edited moves the field to `sourceLang` if
 *         that still holds a translation, else to the first remaining
 *         translation (or `sourceLang` itself once the map is empty);
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
 *   - erasing a language via the armed × emits `update:translations`
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
    const menuOpen = ref(false);
    const chipRef = ref<HTMLElement | null>(null);
    const rootRef = ref<HTMLElement | null>(null);
    /** Code of the tag whose delete is ARMED (chip tapped but the × not
     *  confirmed yet). At most one row is armed at a time. */
    const armedCode = ref<string | null>(null);

    // Closing the menu disarms any armed row — the next open starts
    // calm instead of showing a red delete waiting to fire.
    watch(menuOpen, (open) => {
      if (!open) armedCode.value = null;
    });

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
     *  existing translations live in the tag list above it. */
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

    /** Rows of the language list: EVERY language that holds a translation
     *  — the currently edited one included, even while it is still empty.
     *  Filled entries keep their insertion order; the edited language is
     *  appended when it has no text yet (or moves with the order it was
     *  filled in otherwise). */
    const langRows = computed(() => {
      const codes = [...filledCodes.value];
      if (!codes.includes(editLang.value)) codes.push(editLang.value);
      return codes;
    });

    /** The chip is useful while ANY interaction remains: at least one
     *  row to switch to / erase, or one language left to add. */
    const chipDisabled = computed(
      () =>
        props.disabled ||
        (filledCodes.value.length === 0 &&
          addableOptions.value.length === 0 &&
          langRows.value.length <= 1),
    );

    /** Accessible label of a row's language chip: arming the delete for
     *  this language (the × that then appears confirms it). */
    function armLabel(code: string): string {
      return `${t("hikari::localizedInput.removeTranslation", "Remove translation")} — ${localeLabel(code)} (${code})`;
    }

    /** Accessible label of the SAME chip while the row is armed: clicking
     *  it again cancels — the label must follow the actual action (the ×
     *  on top of it owns the confirm). */
    function cancelLabel(code: string): string {
      return `${t("hikari::localizedInput.cancelDelete", "Cancel delete")} — ${localeLabel(code)} (${code})`;
    }

    /** Accessible label of the confirm ×: erases the translation for
     *  real after the arm step. */
    function confirmLabel(code: string): string {
      return `${t("hikari::localizedInput.confirmDelete", "Confirm delete")} — ${localeLabel(code)} (${code})`;
    }

    /** Accessible name of a row body: the control switches the field to
     *  that language — the raw translation text is visible content (and
     *  the empty hint reads as a passive prompt, not the action), so the
     *  name must identify the ACTION (title is ignored by the accname
     *  algorithm once the element has text content). */
    function switchLabel(code: string): string {
      return `${t("hikari::localizedInput.switchLanguage", "Switch to")} ${localeLabel(code)} (${code})`;
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

    /** Switch the edited language (row body or freshly added one):
     *  commit the current text, swap the field to the target language,
     *  close the menu, and resume editing focused. */
    function switchLanguage(code: string, opts: { viaWatch?: boolean } = {}) {
      if (!code || code === ADD_LANGUAGE_KEY) return;
      if (code === editLang.value) {
        // Already editing it (row body click on the active row): just
        // dismiss the menu and hand focus back to the field.
        if (!opts.viaWatch) {
          menuOpen.value = false;
          focusField();
        }
        return;
      }
      commitTranslations(editLang.value, props.modelValue);
      editLang.value = code;
      armedCode.value = null;
      emit("update:modelValue", (props.translations[code] ?? "").trim());
      if (!opts.viaWatch) {
        menuOpen.value = false;
        focusField();
      }
      emit("languagechange", code);
    }

    /** Arm (or disarm) a row's delete: the chip click turns the row red
     *  and swaps the chip slot for the confirm ×. One armed row at a
     *  time — arming a sibling disarms the previous one. */
    function toggleArm(code: string) {
      armedCode.value = armedCode.value === code ? null : code;
    }

    /** Erase a language's translation via its armed row's ×: drop the key
     *  from `translations`, and when the erased language is the one
     *  being edited move the field to a fallback — the source language
     *  if it still holds a translation, else the first remaining
     *  translation, else the source language itself. Erasing another
     *  language never disturbs the edit state. The menu STAYS open so
     *  the list updates live (with the squeeze-out transition) and
     *  further rows can be erased. */
    function eraseLanguage(code: string) {
      // A ghost row (mid-leave after an earlier erase, or a stale × from
      // a parent re-render) can still be clicked — erasing an already
      // absent key must not re-emit or disturb the edit state.
      if (!(code in props.translations)) return;
      const next = { ...props.translations };
      delete next[code];
      armedCode.value = null;
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

    return () => {
      const rows = langRows.value;
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
              header: () => (
                <div
                  class="hk-localized-input-tags"
                  role="group"
                  aria-label={t(
                    "hikari::localizedInput.translations",
                    "Existing translations",
                  )}
                >
                  <HkListTransition
                    tag="div"
                    variant="reveal"
                    move
                    appear
                    class="hk-localized-input-tag-list"
                  >
                    {rows.map((code) => {
                    const active = code === editLang.value;
                    const option = props.localeOptions.find((o) => o.code === code);
                    const value = (props.translations[code] ?? "").trim();
                    return (
                      <div
                        key={code}
                        class="hk-localized-input-tag"
                        data-active={active || undefined}
                        data-armed={armedCode.value === code || undefined}
                      >
                        <button
                          type="button"
                          class="hk-localized-input-tag-body"
                          title={`${localeLabel(code)} (${code})`}
                          aria-label={switchLabel(code)}
                          onClick={() => switchLanguage(code)}
                        >
                          {option?.flag && (
                            <span class="hk-localized-input-tag-flag">{option.flag}</span>
                          )}
                          <span
                            class="hk-localized-input-tag-text"
                            data-empty={!value || undefined}
                          >
                            {value ||
                              t(
                                "hikari::localizedInput.emptyRow",
                                "Enter text in the field",
                              )}
                          </span>
                        </button>
                        <span class="hk-localized-input-tag-slot">
                          <button
                            type="button"
                            class="hk-localized-input-tag-locale"
                            aria-label={armedCode.value === code ? cancelLabel(code) : armLabel(code)}
                            title={armedCode.value === code ? cancelLabel(code) : armLabel(code)}
                            // While armed the confirm × covers this chip and
                            // owns the confirmation; the chip becomes the
                            // cancel control — and leaves the tab order (the
                            // × takes its tab stop) so the armed row exposes
                            // exactly one actionable control at a time.
                            tabindex={armedCode.value === code ? -1 : 0}
                            onClick={(e: MouseEvent) => {
                              e.stopPropagation();
                              toggleArm(code);
                            }}
                            onMousedown={(e: MouseEvent) => e.preventDefault()}
                          >
                            <span class="hk-localized-input-tag-label">{localeLabel(code)}</span>
                            <span class="hk-localized-input-tag-code">{code}</span>
                            {active && (
                              <span class="hk-localized-input-tag-dot" aria-hidden="true" />
                            )}
                          </button>
                          <button
                            type="button"
                            class="hk-localized-input-tag-x"
                            aria-label={confirmLabel(code)}
                            title={confirmLabel(code)}
                            // Hidden via CSS until armed/hovered; keep it out
                            // of the tab order while it is invisible, so
                            // keyboard users cannot fire the delete on an
                            // unseen control — the chip arms first, then the
                            // × becomes the next tab stop (focus-visible
                            // reveals it, see scss). It OVERLAYS the chip in
                            // the same slot: the row never reflows.
                            tabindex={armedCode.value === code ? 0 : -1}
                            aria-hidden={armedCode.value === code ? undefined : true}
                            onClick={(e: MouseEvent) => {
                              e.stopPropagation();
                              eraseLanguage(code);
                            }}
                          >
                            <X size={11} />
                          </button>
                        </span>
                      </div>
                    );
                  })}
                  </HkListTransition>
                </div>
              ),
            }}
          </HkMenu>
        </div>
      );
    };
  },
});

export default HkLocalizedInput;
