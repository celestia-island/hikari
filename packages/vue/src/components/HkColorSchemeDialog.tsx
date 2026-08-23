import { computed, defineComponent, nextTick, reactive, ref, watch, type PropType } from "vue";
import {
  HColorPicker,
  HExpansionPanel,
  HInput,
  HModal,
  HMorphingTabs,

  useI18n,
  useTheme,
  allGroupSlots,
  clampToSlot,
  getTokenGroups,
  resolveGroupTokens,
  resolveLocalizedText,
  tokenGroupsVersion,
  type ModalAction,
  type ThemeSchemeTokens,
  type ThemeTokenGroupModes,
  type ThemeTokenGroupValues,
  type TokenGroupDefinition,
  type TokenGroupSection,
  type TokenGroupSlot,
} from "@celestia-island/hikari";

import "./HkColorSchemeDialog.scss";


const defaultDark: ThemeSchemeTokens = {
  primary: { r: 255, g: 107, b: 157 },
  secondary: { r: 199, g: 146, b: 234 },
  accent: { r: 253, g: 235, b: 139 },
  text: { r: 228, g: 228, b: 231 },
  muted: { r: 180, g: 180, b: 180 },
  border: { r: 255, g: 255, b: 255 },
  focusedBorder: { r: 255, g: 107, b: 157 },
  background: { r: 14, g: 14, b: 30 },
  surface: { r: 24, g: 24, b: 42 },
  selectedBackground: { r: 70, g: 70, b: 85 },
  selectedText: { r: 240, g: 240, b: 240 },
  statusBarBackground: { r: 24, g: 24, b: 42 },
  success: { r: 114, g: 241, b: 184 },
  error: { r: 255, g: 107, b: 107 },
  warning: { r: 253, g: 235, b: 139 },
  info: { r: 110, g: 231, b: 239 },
};

const defaultLight: ThemeSchemeTokens = {
  primary: { r: 214, g: 51, b: 132 },
  secondary: { r: 156, g: 106, b: 222 },
  accent: { r: 230, g: 167, b: 0 },
  text: { r: 30, g: 30, b: 30 },
  muted: { r: 80, g: 80, b: 80 },
  border: { r: 0, g: 0, b: 0 },
  focusedBorder: { r: 214, g: 51, b: 132 },
  background: { r: 245, g: 245, b: 240 },
  surface: { r: 255, g: 255, b: 255 },
  selectedBackground: { r: 200, g: 200, b: 205 },
  selectedText: { r: 40, g: 40, b: 45 },
  statusBarBackground: { r: 230, g: 230, b: 225 },
  success: { r: 16, g: 185, b: 129 },
  error: { r: 239, g: 68, b: 68 },
  warning: { r: 245, g: 158, b: 11 },
  info: { r: 6, g: 182, b: 212 },
};

type ColorTokenKey = keyof ThemeSchemeTokens;

const editableTokens: ColorTokenKey[] = ["primary", "secondary", "accent", "success", "error", "warning", "info"];
const derivedTokens: ColorTokenKey[] = ["background", "surface", "text", "muted", "border", "focusedBorder", "selectedBackground", "selectedText", "statusBarBackground"];

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
 * HColorSchemeDialog — custom color scheme editor over hikari's theme
 * presets/custom themes.
 *
 * Edits the seven accent tokens (primary/secondary/accent/success/error/
 * warning/info) per mode (dark/light); surface tokens are derived. When
 * extension token groups are registered (`registerTokenGroup` /
 * `registerTokenGroupConfig`), the "Extended colors" section renders one
 * Material expansion panel per group — sub-sectioned groups (config-file
 * palettes like chest's scada set) get one panel per section — with the
 * slots laid out on a 2–3 column grid of hue-clamped pickers showing
 * full localized color names. Emits `confirm` with a `HCustomTheme`
 * (a hikari `CustomThemePreset`); the caller persists it via
 * `useTheme().addCustomTheme()` and applies it with `setTheme()`.
 */
export const HColorSchemeDialog = defineComponent({
  name: "HkColorSchemeDialog",
  props: {
    modelValue: { type: Boolean, required: true },
    /** Prefill dark tokens; defaults to the hikari synthwave dark scheme. */
    initialDark: { type: Object, default: undefined },
    /** Prefill light tokens; defaults to the hikari synthwave light scheme. */
    initialLight: { type: Object, default: undefined },
    /** Prefill extension token groups (per mode); defaults to registry defaults. */
    initialGroups: { type: Object as PropType<ThemeTokenGroupModes>, default: undefined },
  },
  emits: {
    "update:modelValue": (_v: boolean) => true,
    confirm: (_theme: HCustomTheme) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    // Reactive locale: `locale` from useI18n() is a snapshot string, but
    // runtime setLocale() swaps messages reactively — resolve LocalizedText
    // through a computed so config-file labels follow the live locale.
    const activeLocale = computed(() => useI18n().locale);
    const { effectiveMode } = useTheme();
    const modeTab = ref<string>(effectiveMode.value);
    const themeName = ref("");

    const dark = reactive<ThemeSchemeTokens>({ ...defaultDark });
    const light = reactive<ThemeSchemeTokens>({ ...defaultLight });

    // Extension token groups, edited per mode like the accent tokens.
    // Seeded from the prefilled custom theme (if any) falling back to the
    // registry defaults; empty (and rendered nowhere) while no downstream
    // app has registered a group.
    const groupDark = reactive<ThemeTokenGroupValues>({});
    const groupLight = reactive<ThemeTokenGroupValues>({});
    // Depends on the registry's reactive version so groups registered
    // after this dialog first rendered appear without a remount.
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

    watch(
      () => [
        dark.primary, dark.secondary, dark.accent, dark.success, dark.error, dark.warning, dark.info,
        light.primary, light.secondary, light.accent, light.success, light.error, light.warning, light.info,
      ],
      () => rederiveSurface(),
      { deep: true },
    );

    watch(modeTab, () => nextTick(() => rederiveSurface()));

    watch(
      () => props.modelValue,
      (open) => {
        if (!open) return;
        modeTab.value = effectiveMode.value;
        themeName.value = t("hikari::theme.customThemeName");
        const initialDark = props.initialDark as ThemeSchemeTokens | undefined;
        const initialLight = props.initialLight as ThemeSchemeTokens | undefined;
        Object.assign(dark, initialDark ?? defaultDark);
        Object.assign(light, initialLight ?? defaultLight);
        const initialGroups = props.initialGroups as ThemeTokenGroupModes | undefined;
        seedGroups(groupDark, "dark", initialGroups?.dark);
        seedGroups(groupLight, "light", initialGroups?.light);
        rederiveSurface();
      },
    );

    function updateToken(key: ColorTokenKey, rgb: { r: number; g: number; b: number }) {
      const target = modeTab.value === "dark" ? dark : light;
      target[key] = { ...rgb };
    }

    function updateGroupToken(groupId: string, slot: TokenGroupSlot, rgb: { r: number; g: number; b: number }) {
      const values = currentGroupValues.value;
      const group = values[groupId] ?? (values[groupId] = {});
      // Defense in depth: the picker already clamps, clamp again on write.
      group[slot.key] = clampToSlot(slot, rgb);
    }

    function clampGroups(
      source: ThemeTokenGroupValues,
      mode: "dark" | "light",
    ): ThemeTokenGroupValues {
      const out: ThemeTokenGroupValues = {};
      for (const group of registeredGroups.value) {
        const slots: Record<string, { r: number; g: number; b: number }> = {};
        for (const slot of allGroupSlots(group)) {
          const value = source[group.id]?.[slot.key] ?? slot.defaults[mode];
          slots[slot.key] = clampToSlot(slot, value);
        }
        out[group.id] = slots;
      }
      return out;
    }

    function handleConfirm() {
      const id = `custom-theme-${Date.now()}`;
      emit("confirm", {
        id,
        name: themeName.value || t("hikari::theme.customThemeName"),
        dark: { ...dark },
        light: { ...light },
        ...(registeredGroups.value.length > 0
          ? { groups: { dark: clampGroups(groupDark, "dark"), light: clampGroups(groupLight, "light") } }
          : {}),
      });
      emit("update:modelValue", false);
    }

    const footerActions = computed<ModalAction[]>(() => [
      {
        label: t("hikari::protocol.decline"),
        variant: "secondary" as const,
        onClick: () => emit("update:modelValue", false),
      },
      {
        label: t("hikari::theme.save"),
        variant: "primary" as const,
        onClick: handleConfirm,
      },
    ]);

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

    function renderGroupSlot(group: TokenGroupDefinition, slot: TokenGroupSlot) {
      const mode = modeTab.value === "dark" ? "dark" : "light";
      const rgb = currentGroupValues.value[group.id]?.[slot.key] ?? slot.defaults[mode];
      return (
        <HColorPicker
          key={slot.key}
          r={rgb.r}
          g={rgb.g}
          b={rgb.b}
          label={slotLabel(group.id, slot)}
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

    return () => (
      <HModal
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: boolean) => emit("update:modelValue", v)}
        title={t("hikari::theme.editScheme")}
        width="36rem"
        footerActions={footerActions.value}
      >
        <div class="s-scheme-dialog">
          <HInput
            modelValue={themeName.value}
            onUpdate:modelValue={(v: string) => { themeName.value = v; }}
            label={t("hikari::theme.themeName")}
            placeholder={t("hikari::theme.customThemeName")}
          />
          <HMorphingTabs
            tag="div"
            class="s-scheme-mode-switch"
            modelValue={modeTab.value}
            onUpdate:modelValue={(v: string) => { modeTab.value = v; }}
            tabs={modeTabs.value}
          />
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
          {registeredGroups.value.length > 0 && (
            <div class="s-scheme-groups">
              <div class="s-scheme-groups-title">
                {t("hikari::theme.extendedColors", "Extended colors")}
              </div>
              <div class="s-scheme-group-panels">
                {registeredGroups.value.map((group) => renderGroup(group))}
              </div>
            </div>
          )}
        </div>
      </HModal>
    );
  },
});
