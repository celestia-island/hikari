import { computed, defineComponent, onMounted, onUnmounted, ref, watch, type PropType } from "vue";
import { Check, ChevronDown, Monitor, Moon, Palette, Sun, Trash as Trash2 } from "lucide-vue-next";
import {
  DEFAULT_GEO_LOCATION,
  HDivider,
  HPopover,
  getGeolocation,
  solarAltitude,
  useI18n,
  useTheme,
  type PopupPlacement,
  type ThemeId,
} from "@celestia-island/hikari";

import { HColorSchemeDialog, type HCustomTheme } from "./HkColorSchemeDialog";
import HkSegmented, { type HkSegmentedOption } from "./HkSegmented";
import "./HkThemeToggle.scss";

/** One shared geo resolution per page load (component may mount often). */
let geoPromise: Promise<{ lat: number; lng: number }> | null = null;
function geoOnce(): Promise<{ lat: number; lng: number }> {
  geoPromise ??= getGeolocation();
  return geoPromise;
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
 * Color-mode group: a plain shared HkSegmented button group (Auto | Light
 * | Dark) — every segment stays enabled, so switching out of auto is a
 * direct segment press (the day/night side is the user's choice, no
 * separate resolve step). While AUTO is active a passive solar-altitude
 * readout rides BELOW the group in the same typography: it explains which
 * side auto currently resolves to and is deliberately non-interactive —
 * the segments remain the only control surface.
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

    // ── Solar-altitude readout (auto-mode overlay) ──────────────────────
    const geo = ref<{ lat: number; lng: number }>({ ...DEFAULT_GEO_LOCATION });
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

    onMounted(() => {
      // Fire-and-forget: failures keep the timezone fallback and are silent
      // (the aborting test/happy-dom teardown must not surface rejections).
      // Memoized per module so remounts (menu reopen, route hops) reuse the
      // resolved location instead of refetching the geo API.
      geoOnce()
        .then((g) => { geo.value = g; })
        .catch(() => {});
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
     * would re-mount the same vnode instances. Every segment stays
     * enabled: pressing Light/Dark while auto is active is itself the
     * switch to that manual side (setMode leaves "system").
     */
    function modeOptions(): HkSegmentedOption[] {
      return [
        { value: "system", label: t("hikari::theme.modeAuto"), icon: <Monitor size={12} /> },
        { value: "light", label: t("hikari::theme.modeLight"), icon: <Sun size={12} /> },
        { value: "dark", label: t("hikari::theme.modeDark"), icon: <Moon size={12} /> },
      ];
    }

    function onSelectMode(value: string) {
      setMode(value as "light" | "dark" | "system");
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
          sheetOnMobile
        >
          <div class="s-theme-menu">
            <div class="s-theme-menu-label">{t("hikari::theme.mode")}</div>
            <div class="s-theme-mode-row">
              <HkSegmented
                block
                size="sm"
                options={modeOptions()}
                modelValue={currentMode.value}
                onUpdate:modelValue={onSelectMode}
              />
              {isAutoMode.value && (
                <div class="s-theme-mode-autoalt" title={t("hikari::theme.autoAltitudeTip")}>
                  {altitudeNight.value ? <Moon size={12} /> : <Sun size={12} />}
                  <span class="s-theme-mode-autoalt-value">{altitudeText.value}</span>
                </div>
              )}
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
                  {currentTheme.value === th.id && <Check size={14} class="s-theme-item-check" />}
                  <span class="s-theme-item-name">{th.name}</span>
                </button>
                {th.isCustom ? (
                  <button
                    type="button"
                    class="s-theme-item-delete"
                    title={t("hikari::theme.deleteTheme")}
                    onClick={() => removeCustomTheme(th.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                ) : (
                  <span class="s-theme-item-slot" aria-hidden="true" />
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
