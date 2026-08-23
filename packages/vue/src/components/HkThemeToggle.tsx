import { computed, defineComponent, onMounted, ref, type PropType } from "vue";
import { Check, ChevronDown, Monitor, Moon, Palette, Sun, Trash as Trash2 } from "lucide-vue-next";
import { HDivider, HPopover, useI18n, useTheme, type PopupPlacement, type ThemeId } from "@celestia-island/hikari";

import { HColorSchemeDialog, type HCustomTheme } from "./HkColorSchemeDialog";
import "./HkThemeToggle.scss";


/**
 * HkThemeToggle — light/dark/auto theme control over hikari's theme engine.
 *
 * Composes hikari's `useTheme()` (theme presets + custom themes + mode
 * persistence); it does NOT reimplement the theme engine. A main button
 * cycles light/dark (auto keeps a Monitor glyph); the popover offers
 * explicit Light/Dark/Auto modes, preset/custom theme selection (custom
 * themes are removable), and opens HColorSchemeDialog to create a new
 * custom scheme.
 */
export const HkThemeToggle = defineComponent({
  name: "HkThemeToggle",
  props: {
    /** Popover placement. */
    popoverPlacement: { type: String as PropType<PopupPlacement>, default: "bottom-end" },
    /**
     * When true, the "Customize" button emits `open-customize` and closes
     * the popover instead of opening the built-in HColorSchemeDialog — the
     * host app then owns the customization surface (e.g. its own tabs
     * dialog). The internal dialog is not rendered in this mode.
     */
    externalCustomize: { type: Boolean, default: false },
  },
  emits: {
    "update:scheme": (_theme: HCustomTheme) => true,
    "open-customize": () => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const { currentTheme, currentMode, effectiveMode, setTheme, setMode, toggleMode, allThemeList, addCustomTheme, removeCustomTheme } = useTheme();

    const menuOpen = ref(false);
    const triggerRef = ref<HTMLElement | null>(null);
    const schemeDialogOpen = ref(false);

    const modeLabel = computed(() => {
      const map: Record<string, string> = {
        system: t("hikari::theme.modeAuto"),
        light: t("hikari::theme.modeLight"),
        dark: t("hikari::theme.modeDark"),
      };
      return map[currentMode.value] ?? currentMode.value;
    });

    const modeOptions = computed(() => [
      { key: "light", label: t("hikari::theme.modeLight"), icon: () => <Sun size={12} /> },
      { key: "dark", label: t("hikari::theme.modeDark"), icon: () => <Moon size={12} /> },
      { key: "system", label: t("hikari::theme.modeAuto"), icon: () => <Monitor size={12} /> },
    ]);

    function onSelectTheme(id: ThemeId) {
      setTheme(id);
      menuOpen.value = false;
    }

    function onConfirmScheme(theme: HCustomTheme) {
      addCustomTheme(theme);
      setTheme(theme.id);
      emit("update:scheme", theme);
    }

    return () => (
      <div class="s-theme-toggle" ref={triggerRef}>
        <button
          type="button"
          class="s-theme-toggle-btn"
          data-variant="main"
          onClick={toggleMode}
          title={modeLabel.value}
          aria-label={t("hikari::theme.mode")}
        >
          {currentMode.value === "system" ? (
            <Monitor size={14} />
          ) : effectiveMode.value === "dark" ? (
            <Moon size={14} />
          ) : (
            <Sun size={14} />
          )}
        </button>
        <button
          type="button"
          class="s-theme-toggle-btn"
          data-variant="arrow"
          onClick={() => { menuOpen.value = !menuOpen.value; }}
          aria-label={t("hikari::theme.themes")}
        >
          <ChevronDown size={12} />
        </button>

        <HPopover
          modelValue={menuOpen.value}
          onUpdate:modelValue={(v: boolean) => { menuOpen.value = v; }}
          placement={props.popoverPlacement}
          anchorRef={triggerRef.value ?? null}
        >
          <div class="s-theme-menu">
            <div class="s-theme-menu-label">{t("hikari::theme.mode")}</div>
            <div class="s-theme-mode-row">
              {modeOptions.value.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  class="s-theme-mode-btn"
                  data-active={currentMode.value === opt.key || undefined}
                  onClick={() => setMode(opt.key as "light" | "dark" | "system")}
                >
                  {opt.icon()}
                  {opt.label}
                </button>
              ))}
            </div>

            <HDivider spacing="md" />

            <div class="s-theme-menu-label">{t("hikari::theme.themes")}</div>
            {allThemeList.value.map((th) => (
              <div key={th.id} class="s-theme-item-row">
                <button
                  type="button"
                  class="s-theme-item-btn"
                  data-active={currentTheme.value === th.id || undefined}
                  onClick={() => onSelectTheme(th.id)}
                >
                  <span>{th.name}</span>
                  {currentTheme.value === th.id && <Check size={14} />}
                </button>
                {th.isCustom && (
                  <button
                    type="button"
                    class="s-theme-item-delete"
                    title={t("hikari::theme.deleteTheme")}
                    onClick={() => removeCustomTheme(th.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              class="s-theme-item-btn"
              onClick={() => {
                menuOpen.value = false;
                if (props.externalCustomize) {
                  emit("open-customize");
                } else {
                  schemeDialogOpen.value = true;
                }
              }}
            >
              <Palette size={14} />
              <span>{t("hikari::theme.customize")}</span>
            </button>
          </div>
          {slots["menu-extra"]?.()}
        </HPopover>

        {!props.externalCustomize && (
          <HColorSchemeDialog
            modelValue={schemeDialogOpen.value}
            onUpdate:modelValue={(v: boolean) => { schemeDialogOpen.value = v; }}
            onConfirm={onConfirmScheme}
          />
        )}
      </div>
    );
  },
});
