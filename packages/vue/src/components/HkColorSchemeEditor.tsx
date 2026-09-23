import { computed, defineComponent, nextTick, onMounted, reactive, ref, watch, type PropType } from "vue";
import {
  HColorPicker,
  HExpansionPanel,
  HInput,
  HSlider,
  HTabs,

  useI18n,
  useTheme,
  allGroupSlots,
  clampToSlot,
  getTokenGroups,
  resolveGroupTokens,
  resolveLocalizedText,
  tokenGroupsVersion,
  type ThemeSchemeTokens,
  type ThemeTokenRGB,
  type ThemeTokenGroupModes,
  type ThemeTokenGroupValues,
  type ThemeTokenValue,
  type TokenGroupDefinition,
  type TokenGroupSection,
  type TokenGroupSlot,
} from "@celestia-island/hikari";

// Relative on purpose. The package root re-exports this component, so reading
// the preset table through "@celestia-island/hikari" would close a loop whose
// module-init order decides whether the table exists yet. Theme-internal
// modules never import components, so this edge cannot loop.
import { stockDefaultPreset, themePresets } from "../theme";

import "./HkColorSchemeDialog.scss";


/**
 * Seed palette for a NEW custom scheme, read from the live preset table
 * instead of kept as a second hand-copied palette. The copies that used to
 * live here had drifted from the schemes they mirrored and then outlived
 * them — the "second copy of a palette decision" failure class the shipped
 * sheet guard in styles/channelFallbacks.test.ts exists to catch.
 *
 * The table is CONSUMER-OWNED, so `default` is not guaranteed to be there:
 * chest clears every stock key at boot and registers only its brand line
 * (brandPresets.ts). Hence the three-step resolution — the stock entry, then
 * whatever the consumer registered, then the shipped palette, which
 * `stockDefaultPreset` keeps reachable by name (same object, not a copy). An
 * unconditional `themePresets.default[mode]` here mounts fine in every test
 * in this repo and throws at mount inside chest.
 *
 * Resolved PER CALL rather than frozen into a module-scope constant. A frozen
 * copy hides the seed from any test that mutates the table, which is exactly
 * how the provenance case in HkColorSchemeEditor.test.ts pins the invariant:
 * it moves the table and requires the editor to follow.
 */
function seedScheme(mode: "dark" | "light"): ThemeSchemeTokens {
  const preset =
    themePresets.default ?? Object.values(themePresets)[0] ?? stockDefaultPreset;
  return { ...preset[mode] };
}

type ColorTokenKey = keyof ThemeSchemeTokens;
/** Required (always-present) token slots — excludes the optional on-solid content colors. */
type RequiredTokenKey = Exclude<ColorTokenKey, "onSolidText" | "onSolidIcon">;

const editableTokens: RequiredTokenKey[] = ["primary", "secondary", "accent", "success", "error", "warning", "info"];
const derivedTokens: RequiredTokenKey[] = ["background", "surface", "text", "muted", "border", "focusedBorder", "selectedBackground", "selectedText", "statusBarBackground"];
/** Content colors ON solid brand fills: user-choosable, never derived. */
const contentTokens: Array<"onSolidText" | "onSolidIcon"> = ["onSolidText", "onSolidIcon"];
const WHITE: ThemeTokenRGB = { r: 255, g: 255, b: 255 };

function clamp(v: number): number {
  return Math.max(0, Math.min(255, v));
}

function deriveSurface(tokens: ThemeSchemeTokens, isDark: boolean): ThemeSchemeTokens {
  const p = tokens.primary;
  const base = isDark ? 14 : 245;
  return {
    ...tokens,
    background: { r: clamp(base), g: clamp(base), b: clamp(base + (isDark ? 16 : -5)) },
    surface: { r: clamp(base + (isDark ? 10 : 10)), g: clamp(base + (isDark ? 10 : 10)), b: clamp(base + (isDark ? 18 : 5)) },
    text: { r: clamp(isDark ? 228 : 30), g: clamp(isDark ? 228 : 30), b: clamp(isDark ? 231 : 30) },
    muted: { r: clamp(isDark ? 180 : 80), g: clamp(isDark ? 180 : 80), b: clamp(isDark ? 180 : 80) },
    border: { r: clamp(isDark ? 255 : 0), g: clamp(isDark ? 255 : 0), b: clamp(isDark ? 255 : 0) },
    focusedBorder: { r: p.r, g: p.g, b: p.b },
    selectedBackground: { r: clamp(p.r * 0.27), g: clamp(p.g * 0.27), b: clamp(p.b * 0.35) },
    selectedText: { r: clamp(isDark ? 240 : 40), g: clamp(isDark ? 240 : 40), b: clamp(isDark ? 240 : 45) },
    statusBarBackground: { r: clamp(base + (isDark ? 10 : -15)), g: clamp(base + (isDark ? 10 : -15)), b: clamp(base + (isDark ? 18 : -5)) },
  };
}

interface HkTabItem {
  key: string;
  label: string;
}

/**
 * HCustomTheme — custom color scheme payload, structurally identical to
 * hikari's `CustomThemePreset` (which hikari does not re-export from its
 * root yet). `useTheme().addCustomTheme(theme)` accepts it directly.
 */
export interface HCustomTheme {
  id: string;
  name: string;
  dark: ThemeSchemeTokens;
  light: ThemeSchemeTokens;
  /** Extension token group values (both modes), present when groups are registered. */
  groups?: ThemeTokenGroupModes;
}

/**
 * HkColorSchemeEditor — the editable body of the custom color scheme form,
 * extracted from HkColorSchemeDialog so downstream apps can host it inside
 * their own surface (tabs, drawers, panels) instead of the built-in modal.
 *
 * Edits the seven accent tokens (primary/secondary/accent/success/error/
 * warning/info) per mode (dark/light); the remaining surface tokens are
 * derived. The on-solid content colors (onSolidText — text on brand
 * fills, onSolidIcon — icons/shapes such as the switch thumb) are
 * user-choosable too and edit as the FIRST group of the "Extended
 * colors" section (2026-09-11 user direction: moved out of the accent
 * row). When extension token groups are registered
 * (`registerTokenGroup` / `registerTokenGroupConfig`), the section
 * renders one Material expansion panel per group — sub-sectioned groups
 * get one panel per section — with the slots laid out on a 2–3 column
 * grid: hue-clamped pickers showing full localized color names for color
 * slots, unit-formatted sliders for number slots and segmented tab strips
 * for enum slots.
 *
 * Exposes `reset()` (re-seed from props + current effective mode) and
 * `getDraft()` (snapshot the current edits as a `HCustomTheme`) for the
 * host surface to wire to its own save/close controls.
 */
export const HkColorSchemeEditor = defineComponent({
  name: "HkColorSchemeEditor",
  props: {
    /** Prefill dark tokens; defaults to the stock default preset's dark scheme. */
    initialDark: { type: Object as PropType<ThemeSchemeTokens>, default: undefined },
    /** Prefill light tokens; defaults to the stock default preset's light scheme. */
    initialLight: { type: Object as PropType<ThemeSchemeTokens>, default: undefined },
    /** Prefill extension token groups (per mode); defaults to registry defaults. */
    initialGroups: { type: Object as PropType<ThemeTokenGroupModes>, default: undefined },
    /** Prefill the scheme name input (edit/fork flows); empty by default. */
    initialName: { type: String, default: "" },
    /**
     * Render the built-in name input. Hosts that own the name field
     * elsewhere (e.g. a "basic" tab above the editor) hide it and feed the
     * value through `setThemeName()` — getDraft() still carries it.
     */
    showName: { type: Boolean, default: true },
  },
  setup(props, { expose }) {
    const { t } = useI18n();
    // Reactive locale: `locale` from useI18n() is a snapshot string, but
    // runtime setLocale() swaps messages reactively — resolve LocalizedText
    // through a computed so config-file labels follow the live locale.
    const activeLocale = computed(() => useI18n().locale);
    const modeTab = ref<string>("dark");
    const themeName = ref(props.initialName ?? "");

    const dark = reactive<ThemeSchemeTokens>({ ...seedScheme("dark") });
    const light = reactive<ThemeSchemeTokens>({ ...seedScheme("light") });

    // Extension token groups, edited per mode like the accent tokens.
    // Seeded from the prefilled custom theme (if any) falling back to the
    // registry defaults; empty (and rendered nowhere) while no downstream
    // app has registered a group.
    const groupDark = reactive<ThemeTokenGroupValues>({});
    const groupLight = reactive<ThemeTokenGroupValues>({});
    // Depends on the registry's reactive version so groups registered
    // after this editor first rendered appear without a remount.
    const registeredGroups = computed<readonly TokenGroupDefinition[]>(() => {
      void tokenGroupsVersion.value;
      return getTokenGroups();
    });

    const currentTokens = computed(() => (modeTab.value === "dark" ? dark : light));
    const currentGroupValues = computed(() => (modeTab.value === "dark" ? groupDark : groupLight));

    function seedGroups(
      target: ThemeTokenGroupValues,
      mode: "dark" | "light",
      overrides?: ThemeTokenGroupValues,
    ) {
      const resolved = resolveGroupTokens(mode, overrides);
      for (const key of Object.keys(target)) delete target[key];
      for (const [groupId, slots] of Object.entries(resolved)) {
        target[groupId] = slots;
      }
    }

    function rederiveSurface() {
      const target = modeTab.value === "dark" ? dark : light;
      const derived = deriveSurface(target, modeTab.value === "dark");
      derivedTokens.forEach((k) => {
        target[k] = { ...derived[k] };
      });
    }

    function reset(): void {
      modeTab.value = useTheme().effectiveMode.value;
      themeName.value = props.initialName ?? t("hikari::theme.customThemeName");
      Object.assign(dark, props.initialDark ?? seedScheme("dark"));
      Object.assign(light, props.initialLight ?? seedScheme("light"));
      // Optional slots: a legacy prefill omitting them must reset to white
      // (Object.assign alone leaves stale in-editor values in place).
      for (const k of contentTokens) {
        dark[k] = props.initialDark?.[k] ?? WHITE;
        light[k] = props.initialLight?.[k] ?? WHITE;
      }
      seedGroups(groupDark, "dark", props.initialGroups?.dark);
      seedGroups(groupLight, "light", props.initialGroups?.light);
      rederiveSurface();
    }

    onMounted(() => reset());

    function setThemeName(name: string): void {
      themeName.value = name;
    }

    expose({ reset, getDraft, setThemeName });

    watch(
      () => [
        dark.primary, dark.secondary, dark.accent, dark.success, dark.error, dark.warning, dark.info,
        light.primary, light.secondary, light.accent, light.success, light.error, light.warning, light.info,
      ],
      () => rederiveSurface(),
      { deep: true },
    );

    watch(modeTab, () => nextTick(() => rederiveSurface()));

    function updateToken(key: ColorTokenKey, rgb: { r: number; g: number; b: number }) {
      const target = modeTab.value === "dark" ? dark : light;
      target[key] = { ...rgb };
    }

    /**
     * Write one slot edit. Which primitive arrives depends on the slot's
     * kind (triplet / number / string); `clampToSlot` dispatches on the slot
     * itself, so picker, slider and tab strip all funnel through the same
     * defense-in-depth clamp before the value reaches the draft.
     */
    function updateGroupToken(groupId: string, slot: TokenGroupSlot, value: ThemeTokenValue) {
      const values = currentGroupValues.value;
      const group = values[groupId] ?? (values[groupId] = {});
      group[slot.key] = clampToSlot(slot, value);
    }

    function clampGroups(
      source: ThemeTokenGroupValues,
      mode: "dark" | "light",
    ): ThemeTokenGroupValues {
      const out: ThemeTokenGroupValues = {};
      for (const group of registeredGroups.value) {
        const slots: Record<string, ThemeTokenValue> = {};
        for (const slot of allGroupSlots(group)) {
          const value = source[group.id]?.[slot.key] ?? slot.defaults[mode];
          slots[slot.key] = clampToSlot(slot, value);
        }
        out[group.id] = slots;
      }
      return out;
    }

    function getDraft(): HCustomTheme {
      return {
        id: `custom-theme-${Date.now()}`,
        name: themeName.value || t("hikari::theme.customThemeName"),
        dark: { ...dark },
        light: { ...light },
        ...(registeredGroups.value.length > 0
          ? { groups: { dark: clampGroups(groupDark, "dark"), light: clampGroups(groupLight, "light") } }
          : {}),
      };
    }

    const modeTabs = computed<HkTabItem[]>(() => [
      { key: "dark", label: t("hikari::theme.modeDark") },
      { key: "light", label: t("hikari::theme.modeLight") },
    ]);

    // ── Extension group rendering ────────────────────────────────────
    // Label resolution order: hikari i18n message (apps may override via
    // mergeMessages) → LocalizedText entry for the active locale → the
    // definition's `en` → first defined locale.

    function slotLabel(groupId: string, slot: TokenGroupSlot): string {
      return t(
        `hikari::theme.groups.${groupId}.${slot.key}`,
        resolveLocalizedText(slot.label, activeLocale.value),
      );
    }

    function sectionLabel(groupId: string, section: TokenGroupSection): string {
      return t(
        `hikari::theme.groups.${groupId}.sections.${section.key}`,
        resolveLocalizedText(section.label, activeLocale.value),
      );
    }

    function groupLabel(group: TokenGroupDefinition): string {
      return t(
        `hikari::theme.groups.${group.id}.title`,
        resolveLocalizedText(group.label, activeLocale.value),
      );
    }

    function countLabel(count: number): string {
      return t("hikari::theme.groupCount", "{count} colors").replace("{count}", String(count));
    }

    /**
     * One slot cell of a group grid. The control follows the slot's kind:
     *   color  → the hue-clamped picker (unchanged, label included),
     *   number → a slider bound to the slot's min/max/step, formatting its
     *            value with the slot's unit,
     *   enum   → the segmented tab strip already used for the mode switch.
     * A picker carries its own label; a slider and a tab strip do not, so
     * non-color slots get a field wrapper with the slot label (and, for a
     * slider, the value in the same unit the cssvar is written with).
     */
    function renderGroupSlot(group: TokenGroupDefinition, slot: TokenGroupSlot) {
      const mode = modeTab.value === "dark" ? "dark" : "light";
      const value = currentGroupValues.value[group.id]?.[slot.key] ?? slot.defaults[mode];
      const label = slotLabel(group.id, slot);
      if (slot.kind === "number") {
        // A stale/foreign draft value of the wrong type falls back to the
        // registry default rather than feeding the slider a NaN.
        const current = typeof value === "number" ? value : slot.defaults[mode];
        return (
          <div key={slot.key} class="s-scheme-group-field">
            <span class="s-scheme-group-field-label">{label}</span>
            <HSlider
              modelValue={current}
              min={slot.min}
              max={slot.max}
              step={slot.step}
              size="sm"
              ariaLabel={label}
              formatValue={(v: number) => `${v}${slot.unit ?? ""}`}
              onUpdate:modelValue={(v: number) => updateGroupToken(group.id, slot, v)}
            />
            <span class="s-scheme-group-field-value">{`${current}${slot.unit ?? ""}`}</span>
          </div>
        );
      }
      if (slot.kind === "enum") {
        const current = typeof value === "string" ? value : slot.defaults[mode];
        return (
          <div key={slot.key} class="s-scheme-group-field">
            <span class="s-scheme-group-field-label">{label}</span>
            <HTabs
              variant="segmented"
              modelValue={current}
              onUpdate:modelValue={(v: string) => updateGroupToken(group.id, slot, v)}
              tabs={slot.options.map((option) => ({
                key: option.value,
                label: resolveLocalizedText(option.label, activeLocale.value),
              }))}
            />
          </div>
        );
      }
      const rgb = typeof value === "number" || typeof value === "string" ? slot.defaults[mode] : value;
      return (
        <HColorPicker
          key={slot.key}
          r={rgb.r}
          g={rgb.g}
          b={rgb.b}
          label={label}
          layout="row"
          hueClamp={slot.hueClamp}
          sRange={slot.sRange}
          lRange={slot.lRange}
          onChange={(next: { r: number; g: number; b: number }) => updateGroupToken(group.id, slot, next)}
        />
      );
    }

    function renderSlotGrid(group: TokenGroupDefinition, slots: TokenGroupSlot[]) {
      return (
        <div class="s-scheme-group-grid">
          {slots.map((slot) => renderGroupSlot(group, slot))}
        </div>
      );
    }

    /** One expansion panel per section, then one for any flat slots. */
    function renderGroup(group: TokenGroupDefinition) {
      const panels = (group.sections ?? []).map((section) => (
        <HExpansionPanel
          key={`${group.id}--${section.key}`}
          title={sectionLabel(group.id, section)}
          subtitle={countLabel(section.slots.length)}
        >
          {renderSlotGrid(group, section.slots)}
        </HExpansionPanel>
      ));
      const flat = group.slots ?? [];
      if (flat.length > 0) {
        panels.push(
          <HExpansionPanel
            key={`${group.id}--flat`}
            title={groupLabel(group)}
            subtitle={countLabel(flat.length)}
          >
            {renderSlotGrid(group, flat)}
          </HExpansionPanel>,
        );
      }
      return panels;
    }

    // ── On-brand content colors as their own extended group ──────────
    // The two content tokens (text / icons on solid brand fills) USED to
    // sit in the top accent row (2026-09-11 user direction: they are
    // niche, rarely-tuned colors — they belong with the other extension
    // palettes, as the section's FIRST group). Editing them here writes
    // the exact same draft slots as before; only the location moved.
    function renderOnSolidGroup() {
      return (
        <HExpansionPanel
          key="on-solid-content"
          title={t("hikari::theme.onSolidGroupTitle", "On-brand content")}
          subtitle={countLabel(contentTokens.length)}
        >
          <div class="s-scheme-group-grid">
            {contentTokens.map((key) => {
              // Optional slots: an older prefilled custom theme may omit them.
              const rgb = currentTokens.value[key] ?? WHITE;
              return (
                <HColorPicker
                  key={key}
                  r={rgb.r}
                  g={rgb.g}
                  b={rgb.b}
                  label={t(`hikari::theme.tokens.${key}`)}
                  layout="row"
                  onChange={(next: { r: number; g: number; b: number }) => updateToken(key, next)}
                />
              );
            })}
          </div>
        </HExpansionPanel>
      );
    }

    return () => (
      <div class="s-scheme-dialog">
        {props.showName && (
          <HInput
            modelValue={themeName.value}
            onUpdate:modelValue={(v: string) => { themeName.value = v; }}
            label={t("hikari::theme.themeName")}
            placeholder={t("hikari::theme.customThemeName")}
          />
        )}
        <HTabs
          variant="segmented"
          class="s-scheme-mode-switch"
          modelValue={modeTab.value}
          onUpdate:modelValue={(v: string) => { modeTab.value = v; }}
          tabs={modeTabs.value}
        />
        <p class="s-scheme-mode-hint">{t("hikari::theme.modeTabHint")}</p>
        <div class="s-scheme-colors">
          {editableTokens.map((key) => (
            <HColorPicker
              key={key}
              r={currentTokens.value[key].r}
              g={currentTokens.value[key].g}
              b={currentTokens.value[key].b}
              label={t(`hikari::theme.tokens.${key}`)}
              onChange={(rgb: { r: number; g: number; b: number }) => updateToken(key, rgb)}
            />
          ))}
        </div>
        {/* Always rendered now: the on-brand content group lives here even
            when no extension token group is registered. */}
        <div class="s-scheme-groups">
          <div class="s-scheme-groups-title">
            {t("hikari::theme.extendedColors", "Extended colors")}
          </div>
          <div class="s-scheme-group-panels">
            {renderOnSolidGroup()}
            {registeredGroups.value.map((group) => renderGroup(group))}
          </div>
        </div>
      </div>
    );
  },
});
