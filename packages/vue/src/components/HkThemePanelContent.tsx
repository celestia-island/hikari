import { computed, defineComponent, onUnmounted, ref, watch, type PropType } from "vue";
import { Check, Monitor, MoonStar, Palette, Sun, Trash as Trash2 } from "lucide-vue-next";
import {
  HDivider,
  solarAltitude,
  themePresets,
  useI18n,
  useTheme,
  type CustomThemePreset,
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
 *  render swatches or affordances without re-deriving the preset.
 *  `name` is the RAW stored string — it may be a message key (see
 *  `ThemePreset.name`); the row cell resolves it through the catalog. */
export interface ThemeItemScope {
  id: ThemeId;
  name: string;
  isCustom: boolean;
  /** The row's full definition — the built-in preset table entry for
   *  stock/registered themes, the user's stored scheme for customs. */
  preset: ThemePreset | CustomThemePreset | undefined;
}

/**
 * HkThemePanelContent — the theme panel's CONTENT, extracted from
 * HkThemeToggle's popover (2026-10-15 user direction: hosts embed the
 * panel in their own settings surfaces; the trigger+popover chrome and
 * the content are separate concerns and must be separately usable).
 *
 * Everything between the popover's padding lives here: the color-mode
 * group (HTabs segmented with the solar-altitude merged cell), the
 * `mode-extra` host strip, the preset/custom theme rows (three scoped
 * host slots), the customize entry and the `menu-extra` slot. The
 * built-in HColorSchemeDialog rides along when `externalCustomize` is
 * false — dialogs teleport, so hosting this inside any surface is safe.
 *
 * The component talks to `useTheme()` directly (the composable is a
 * singleton); the owning surface only supplies slots and reacts to the
 * two events:
 *  · `request-close` — a theme was applied or the customize entry was
 *    pressed; a popover host closes its layer, an inline host ignores it.
 *  · `open-customize` — pressed with `externalCustomize: true`.
 */
export const HkThemePanelContent = defineComponent({
  name: "HkThemePanelContent",
  props: {
    /**
     * When true, the "Customize" entry emits `open-customize` (and
     * `request-close`) instead of opening the built-in HColorSchemeDialog
     * — the host then owns the customization surface. The internal
     * dialog is not rendered in this mode.
     */
    externalCustomize: { type: Boolean, default: false },
  },
  emits: {
    "update:scheme": (_theme: HCustomTheme) => true,
    "open-customize": () => true,
    "request-close": () => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const {
      currentTheme,
      currentMode,
      effectiveMode,
      geo,
      setTheme,
      setMode,
      allThemeList,
      addCustomTheme,
      removeCustomTheme,
      customThemes,
    } = useTheme();

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

    const schemeDialogOpen = ref(false);

    // ── Solar-altitude readout (auto-mode merged cell) ──────────────
    // `geo` comes from the theme clock (timezone estimate until the real
    // fix lands) — the engine and this readout share one resolution.
    // The timer runs only while this content is MOUNTED (a popover host
    // unmounts it on close; an inline host keeps it live — the readout
    // staying current there is a feature, not a leak).
    const altTick = ref(0);
    let altTimer: ReturnType<typeof setInterval> | null = null;
    watch(
      () => props.externalCustomize,
      () => void 0,
    );
    onUnmounted(() => {
      if (altTimer) clearInterval(altTimer);
    });
    // Mounted ⇒ ticking (see the comment above).
    altTimer = setInterval(() => { altTick.value += 1; }, 60000);

    /** Current sun altitude formatted like "+32.5°". */
    const altitudeText = computed(() => {
      void altTick.value;
      void geo.value;
      const alt = solarAltitude(geo.value.lat, geo.value.lng, new Date());
      return `${alt >= 0 ? "+" : ""}${alt.toFixed(1)}°`;
    });

    /** Glyph hints which side a press will land on: sun while auto
     *  resolves light, moon once dusk/night flip it to dark. */
    const altitudeNight = computed(() => {
      void altTick.value;
      void geo.value;
      return effectiveMode.value === "dark";
    });

    const isAutoMode = computed(() => currentMode.value === "system");

    /**
     * Fresh option objects (and fresh icon vnodes) on every call — never
     * cache icon vnodes across renders, or re-mounting this content
     * would re-mount the same vnode instances. In AUTO mode the Light/
     * Dark options collapse into the group's merged cell (the altitude
     * strip) via `mergeKeys`. They stay ENABLED (2026-10-01 user report:
     * disabled Light/Dark read as the mode being locked to the sun): in
     * the merged rendering they are not rendered at all, and on the
     * degradation path (merge requested without the #merged slot) a
     * click must drop OUT of auto onto the pressed side instead of
     * doing nothing.
     */
    function modeOptions(): TabItem[] {
      return [
        { key: "system", label: t("hikari::theme.modeAuto"), icon: <Monitor size={16} /> },
        { key: "light", label: t("hikari::theme.modeLight"), icon: <Sun size={16} /> },
        { key: "dark", label: t("hikari::theme.modeDark"), icon: <MoonStar size={16} /> },
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
      emit("request-close");
    }

    function onConfirmScheme(theme: HCustomTheme) {
      addCustomTheme(theme);
      setTheme(theme.id);
      emit("update:scheme", theme);
    }

    return () => (
      <>
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
            // cell, so names stay aligned); `item-name-suffix` renders
            // INSIDE the row button right after the name, so a host mark
            // (e.g. a provenance/sync glyph) reads as part of the name
            // instead of as an affordance; `item-trailing` reserves a
            // real trailing column for every row and takes full
            // ownership of the affordances there — the built-in custom
            // delete overlay is suppressed in that mode, so the host
            // renders delete (and anything else) itself. Without the
            // slots the rows behave exactly as before: check only on the
            // active row, delete overlaid on custom rows only.
            const scope: ThemeItemScope = {
              id: th.id,
              name: th.name,
              isCustom: th.isCustom,
              preset: presetOf(th.id),
            };
            const leadingSlot = slots["item-leading"];
            const nameSuffixSlot = slots["item-name-suffix"];
            const trailingSlot = slots["item-trailing"];
            // A preset/custom name may be a message key into hikari's own
            // catalog (the documented ThemePreset.name convention — hosts
            // ship localized built-ins like "hikari::theme.defaultThemeName").
            // `t()` falls back to the raw string for anything that is not a
            // key, so literal display names pass through unchanged, and the
            // reactive message lookup re-renders rows on locale switches.
            const displayName = t(th.name);
            return (
              <div
                key={th.id}
                class="s-theme-item-row"
                data-custom={th.isCustom || undefined}
                data-trailing={trailingSlot ? "slot" : undefined}
                data-name-suffix={nameSuffixSlot ? "slot" : undefined}
                // The ROW is the pill: the highlight state lives here so
                // the hover/active wash spans the full row width — a
                // trailing slot column must not shrink it (2026-10-01
                // user report: theme rows and the 自定义 row hovered at
                // different widths). The button keeps the click/focus
                // semantics; the stylesheet strips its own chrome.
                data-active={currentTheme.value === th.id || undefined}
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
                  <span class="s-theme-item-name">{displayName}</span>
                  {nameSuffixSlot ? (
                    <span class="s-theme-item-name-suffix">{nameSuffixSlot(scope)}</span>
                  ) : null}
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
            class="s-theme-item-btn s-theme-item-customize"
            onClick={() => {
              if (props.externalCustomize) {
                emit("request-close");
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
        {(() => {
          const extra = slots["menu-extra"]?.() ?? [];
          return extra.length ? (
            <div class="hk-menu-slot hk-menu-slot--extra">{extra}</div>
          ) : null;
        })()}

        {!props.externalCustomize && (
          <HColorSchemeDialog
            modelValue={schemeDialogOpen.value}
            onUpdate:modelValue={(v: boolean) => { schemeDialogOpen.value = v; }}
            onConfirm={onConfirmScheme}
          />
        )}
      </>
    );
  },
});
