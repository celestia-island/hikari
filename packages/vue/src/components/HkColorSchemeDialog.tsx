import { computed, defineComponent, nextTick, reactive, ref, watch } from "vue";
import {
  HColorPicker,
  HInput,
  HModal,
  HMorphingTabs,
  
  useI18n,
  useTheme,
  type ModalAction,
  type ThemeSchemeTokens,
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
}

/**
 * HColorSchemeDialog — custom color scheme editor over hikari's theme
 * presets/custom themes.
 *
 * Edits the seven accent tokens (primary/secondary/accent/success/error/
 * warning/info) per mode (dark/light); surface tokens are derived. Emits
 * `confirm` with a `HCustomTheme` (a hikari `CustomThemePreset`); the
 * caller persists it via `useTheme().addCustomTheme()` and applies it
 * with `setTheme()`.
 */
export const HColorSchemeDialog = defineComponent({
  name: "HkColorSchemeDialog",
  props: {
    modelValue: { type: Boolean, required: true },
    /** Prefill dark tokens; defaults to the hikari synthwave dark scheme. */
    initialDark: { type: Object, default: undefined },
    /** Prefill light tokens; defaults to the hikari synthwave light scheme. */
    initialLight: { type: Object, default: undefined },
  },
  emits: {
    "update:modelValue": (_v: boolean) => true,
    confirm: (_theme: HCustomTheme) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const { effectiveMode } = useTheme();
    const modeTab = ref<string>(effectiveMode.value);
    const themeName = ref("");

    const dark = reactive<ThemeSchemeTokens>({ ...defaultDark });
    const light = reactive<ThemeSchemeTokens>({ ...defaultLight });

    const currentTokens = computed(() => (modeTab.value === "dark" ? dark : light));

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
        rederiveSurface();
      },
    );

    function updateToken(key: ColorTokenKey, rgb: { r: number; g: number; b: number }) {
      const target = modeTab.value === "dark" ? dark : light;
      target[key] = { ...rgb };
    }

    function handleConfirm() {
      const id = `custom-theme-${Date.now()}`;
      emit("confirm", {
        id,
        name: themeName.value || t("hikari::theme.customThemeName"),
        dark: { ...dark },
        light: { ...light },
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
        </div>
      </HModal>
    );
  },
});
