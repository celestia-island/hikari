import { computed, defineComponent, onUnmounted, ref, watch, type PropType } from "vue";
import { Check, ChevronDown, Monitor, MoonStar, Palette, Sun, Trash as Trash2 } from "lucide-vue-next";
import {
  HDivider,
  HPopover,
  solarAltitude,
  themePresets,
  useI18n,
  useTheme,
  type CustomThemePreset,
  type PopupPlacement,
  type ThemeId,
  type ThemePreset,
} from "@celestia-island/hikari";

import { HColorSchemeDialog, type HCustomTheme } from "./HkColorSchemeDialog";
import HTabs, { type TabItem } from "./HkTabs";
import "./HkThemeToggle.scss";

/** The auto-mode merged run, hoisted: a fresh array literal per render
 *  would re-fire HTabs' mergeKeys watcher (one redundant geometry
 *  refresh) on every altitude tick. */
const AUTO_MERGE_KEYS = ["light", "dark"];

/** Scoped payload handed to the `item-leading` / `item-trailing` slots:
 *  one object per theme row, carrying enough identity for the host to
 *  render swatches or affordances without re-deriving the preset. */
export interface ThemeItemScope {
  id: ThemeId;
  name: string;
  isCustom: boolean;
  /** The row's full definition — the built-in preset table entry for
   *  stock/registered themes, the user's stored scheme for customs. */
  preset: ThemePreset | CustomThemePreset | undefined;
}

/**
 * HkThemeToggle — light/dark/auto theme control over hikari's theme engine.
 *
 * Composes hikari's `useTheme()` (theme presets + custom themes + mode
 * persistence); it does NOT reimplement the theme engine. A main button
 * cycles light/dark (auto keeps a Monitor glyph); the popover offers the
 * color-mode group and preset/custom theme selection (custom themes are
 * removable), and opens HColorSchemeDialog to create a new custom scheme.
 *
 * Theme rows are host-customizable through two scoped slots (both render
 * in the popover AND the mobile bottom sheet — same DOM):
 *  · `item-leading` — replaces the selected-check cell; renders for
 *    every row in the fixed icon cell so names align regardless of the
 *    active row. Scope: `ThemeItemScope` (id/name/isCustom/preset).
 *  · `item-trailing` — reserves a trailing column on every row and owns
 *    it entirely; the built-in custom-delete overlay is suppressed, so
 *    the host renders delete/edit itself where it wants them.
 *
 * `mode-extra` — a host strip rendered directly under the color-mode
 * group (before the divider). Mode-adjacent host chrome that is NOT a
 * theme-editor concern lives here (e.g. display-scale control).
 *
 * Color-mode group: the unified HTabs strip in segmented (radiogroup)
 * working mode (Auto | Light | Dark) — same pill chrome as every other
 * group. In AUTO mode the Light/Dark halves merge into the strip's
 * merged cell (`mergeKeys` + `#merged`): a passive-looking
 * solar-altitude strip in the strip's own trigger typography — pressing
 * it drops to manual on whichever side auto currently resolves to (day
 * → light, night → dark), so no separate resolve step is ever needed.
 * The cell is NAKED like every unselected option (no border/surface of
 * its own) and joins the group's animation context (swap transitions +
 * the sliding indicator).
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
    const { currentTheme, currentMode, effectiveMode, geo, setTheme, setMode, toggleMode, allThemeList, addCustomTheme, removeCustomTheme, customThemes } = useTheme();

    /** Resolve a row's full definition for the item slots: the user's
     *  stored custom schemes first, then the live preset table — the SAME
     *  precedence getAllThemePresets applies at apply time, so a row that
     *  shadows a builtin id (in-place preset override) shows the anatomy
     *  of the scheme that actually renders, not the shadowed factory. */
    function presetOf(id: ThemeId): ThemePreset | CustomThemePreset | undefined {
      const custom = customThemes.value.find((c) => c.id === id);
      if (custom) return custom;
      if (id in themePresets) return themePresets[id as keyof typeof themePresets];
      return undefined;
    }

    const menuOpen = ref(false);
    const triggerRef = ref<HTMLElement | null>(null);
    const schemeDialogOpen = ref(false);

    // ── Solar-altitude readout (auto-mode merged cell) ──────────────
    // `geo` comes from the theme clock (timezone estimate until the real
    // fix lands) — the engine and this readout share one resolution.
    const altTick = ref(0);

    let altTimer: ReturnType<typeof setInterval> | null = null;
    watch(menuOpen, (open) => {
      if (open) {
        if (!altTimer) altTimer = setInterval(() => { altTick.value += 1; }, 60000);
      } else if (altTimer) {
        clearInterval(altTimer);
        altTimer = null;
      }
    });
    onUnmounted(() => {
      if (altTimer) clearInterval(altTimer);
    });

    /** Current sun altitude formatted like "+32.5°". */
    const altitudeText = computed(() => {
      void menuOpen.value;
      void altTick.value;
      void geo.value;
      const alt = solarAltitude(geo.value.lat, geo.value.lng, new Date());
      return `${alt >= 0 ? "+" : ""}${alt.toFixed(1)}°`;
    });

    /** Glyph hints which side a press will land on: sun while auto
     *  resolves light, moon once dusk/night flip it to dark. */
    const altitudeNight = computed(() => {
      void menuOpen.value;
      void altTick.value;
      void geo.value;
      return effectiveMode.value === "dark";
    });

    const isAutoMode = computed(() => currentMode.value === "system");

    const modeLabel = computed(() => {
      const map: Record<string, string> = {
        system: t("hikari::theme.modeAuto"),
        light: t("hikari::theme.modeLight"),
        dark: t("hikari::theme.modeDark"),
      };
      return map[currentMode.value] ?? currentMode.value;
    });

    /**
     * Fresh option objects (and fresh icon vnodes) on every call — never
     * cache icon vnodes across renders, or closing/reopening the popover
     * would re-mount the same vnode instances. In AUTO mode the Light/
     * Dark options collapse into the group's merged cell (the altitude
     * strip) via `mergeKeys`; they stay flagged disabled for the
     * degradation path (merge requested without the #merged slot) and
     * for semantic clarity.
     */
    function modeOptions(): TabItem[] {
      const auto = isAutoMode.value;
      return [
        { key: "system", label: t("hikari::theme.modeAuto"), icon: <Monitor size={16} /> },
        { key: "light", label: t("hikari::theme.modeLight"), icon: <Sun size={16} />, disabled: auto },
        { key: "dark", label: t("hikari::theme.modeDark"), icon: <MoonStar size={16} />, disabled: auto },
      ];
    }

    function onSelectMode(value: string) {
      setMode(value as "light" | "dark" | "system");
    }

    /**
     * Pressing the altitude strip in auto mode drops back to manual and
     * selects whichever side auto currently resolves to (day → light,
     * night → dark). Debounced: input synthesis may deliver both a
     * pointer sequence and a click for one physical press.
     */
    let lastManualSwitchAt = 0;
    function resolveAutoToManual() {
      const now = Date.now();
      if (now - lastManualSwitchAt < 700) return;
      lastManualSwitchAt = now;
      setMode(effectiveMode.value);
    }

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
            <Monitor size={16} />
          ) : effectiveMode.value === "dark" ? (
            <MoonStar size={16} />
          ) : (
            <Sun size={16} />
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
          sheetOnMobile
          // Names the breadcrumb layer / sheet heading when this menu
          // blocks as a mobile bottom sheet.
          title={t("hikari::theme.themes")}
        >
          <div class="s-theme-menu">
            <div class="s-theme-menu-label">{t("hikari::theme.mode")}</div>
            <div class="s-theme-mode-row">
              <HTabs
                variant="segmented"
                block
                tabs={modeOptions()}
                modelValue={currentMode.value}
                onUpdate:modelValue={onSelectMode}
                mergeKeys={isAutoMode.value ? AUTO_MERGE_KEYS : undefined}
              >
                {{
                  merged: () => (
                    <button
                      type="button"
                      class="s-theme-mode-autoalt"
                      title={t("hikari::theme.autoAltitudeTip")}
                      aria-label={t("hikari::theme.autoAltitudeTip")}
                      onClick={resolveAutoToManual}
                    >
                      {altitudeNight.value ? <MoonStar size={16} /> : <Sun size={16} />}
                      <span class="s-theme-mode-autoalt-value">{altitudeText.value}</span>
                    </button>
                  ),
                }}
</HTabs>
            </div>

            {/* Host extension point directly under the mode group (P98: the
                 chest DPI control lives here — mode-adjacent chrome, not a theme
                 editor tab). Rendered only when the host provides the slot. */}
            {slots["mode-extra"] ? (
              <div class="s-theme-mode-extra">{slots["mode-extra"]()}</div>
            ) : null}

            <HDivider spacing="md" />

            <div class="s-theme-menu-label">{t("hikari::theme.themes")}</div>
            {allThemeList.value.map((th) => {
              // Host-customizable row anatomy. `item-leading` replaces the
              // selected-check cell and renders for EVERY row (fixed icon
              // cell, so names stay aligned); `item-trailing` reserves a
              // real trailing column for every row and takes full
              // ownership of the affordances there — the built-in custom
              // delete overlay is suppressed in that mode, so the host
              // renders delete (and anything else) itself. Without the
              // slots the rows behave exactly as before: check only on
              // the active row, delete overlaid on custom rows only.
              const scope: ThemeItemScope = {
                id: th.id,
                name: th.name,
                isCustom: th.isCustom,
                preset: presetOf(th.id),
              };
              const leadingSlot = slots["item-leading"];
              const trailingSlot = slots["item-trailing"];
              return (
                <div
                  key={th.id}
                  class="s-theme-item-row"
                  data-custom={th.isCustom || undefined}
                  data-trailing={trailingSlot ? "slot" : undefined}
                >
                  <button
                    type="button"
                    class="s-theme-item-btn"
                    data-active={currentTheme.value === th.id || undefined}
                    onClick={() => onSelectTheme(th.id)}
                  >
                    {leadingSlot ? (
                      <span class="hk-menu-item-icon s-theme-item-lead">
                        {leadingSlot(scope)}
                      </span>
                    ) : currentTheme.value === th.id ? (
                      <span class="hk-menu-item-icon s-theme-item-check"><Check size={14} /></span>
                    ) : null}
                    <span class="s-theme-item-name">{th.name}</span>
                  </button>
                  {trailingSlot ? (
                    <span class="s-theme-item-trailing">{trailingSlot(scope)}</span>
                  ) : th.isCustom ? (
                    <button
                      type="button"
                      class="s-theme-item-delete"
                      title={t("hikari::theme.deleteTheme")}
                      onClick={() => removeCustomTheme(th.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  ) : null}
                </div>
              );
            })}

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
              <span class="hk-menu-item-icon"><Palette size={14} /></span>
              <span class="s-theme-item-name">{t("hikari::theme.customize")}</span>
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
