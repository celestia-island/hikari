// AI-generated: developed with the ZCode agent (model GLM-5.3); human-directed.
import { computed, defineComponent, ref } from "vue";
import { Clock, Globe2, MapPin } from "lucide-vue-next";

import { useI18n } from "../i18n/context";
import { refreshThemeClock } from "../theme/useTheme";
import {
  hydrateSolarLocationState,
  listTimeZones,
  manualLocationOf,
  setSolarLocationStrategy,
  setSolarManualLocation,
  solarLocationStrategy,
  solarManualLocation,
  systemTimeZoneId,
  type SolarHemisphere,
  type SolarLocationStrategy,
  type SolarManualLocation,
} from "../theme/useSolarTime";
import HkButton from "./HkButton";
import HkModal, { type ModalAction } from "./HkModal";
import HkSelect, { type HkSelectOption } from "./HkSelect";
import HTabs, { type TabItem } from "./HkTabs";
import "./HkSolarLocationSetting.scss";

/**
 * HkSolarLocationSetting — the solar clock's location STRATEGY row
 * (2026-10-31 product direction: strategies, not a fixed cascade).
 *
 * hikari's sun-driven theming resolves a geographic fix through a
 * user-visible, user-editable strategy ladder:
 *
 *  1. "timezone" (default, highest priority) — fully offline: derive the
 *     longitude from the device's IANA time zone. No network request and
 *     no permission prompt, ever;
 *  2. "ip" — the classic web cascade (already-granted browser
 *     geolocation → ipapi lookup → time-zone estimate fallback);
 *  3. "manual" — an explicitly picked IANA time zone plus hemisphere,
 *     for users who want the sun clock pinned regardless of device or
 *     network.
 *
 * The component is a generic business part (peer of HkTemplateText, not
 * of the HkInput family): any host project drops ONE row at the bottom
 * of its settings page — shittim-chest, the ERP panels, wowsp — and the
 * row plus its secondary HkModal editor cover the whole interaction.
 * The engine (state, persistence, resolution) lives in
 * theme/useSolarTime.ts; this component only edits it:
 *
 *  - the row shows the live strategy summary (timezone → system zone id,
 *    manual → zone + hemisphere, ip → the IP label) and an Edit button;
 *  - the modal drafts a strategy (segmented Clock/Globe2/MapPin tabs),
 *    with the manual pane exposing the IANA zone select and an explicit
 *    hemisphere segmented group — hemisphere is NEVER inferred from the
 *    zone: picking it is the entire point of the manual knob;
 *  - OK applies setSolarManualLocation (manual only) →
 *    setSolarLocationStrategy → refreshThemeClock() (the setters drop
 *    the engine's geo memo but do not re-resolve on their own), and the
 *    row's summary reflects the new state immediately.
 */
export const HkSolarLocationSetting = defineComponent({
  name: "HkSolarLocationSetting",
  emits: {
    /** Fired after OK applied the draft (and refreshed the clock). */
    applied: (_strategy: SolarLocationStrategy) => true,
  },
  setup(_props, { emit }) {
    const { t } = useI18n();
    // The engine hydrates lazily (storage-silent imports): a host that
    // mounts this row before initTheme() still sees the stored strategy.
    hydrateSolarLocationState();
    const open = ref(false);

    // ── Draft state (seeded from the engine on every open) ───────────
    const draftStrategy = ref<SolarLocationStrategy>(solarLocationStrategy.value);
    const draftTimeZone = ref<string>(systemTimeZoneId());
    // Hemisphere default is the explicit-pick contract's neutral start;
    // the segmented group is one tap away from "south".
    const draftHemisphere = ref<SolarHemisphere>("north");

    function seedDraft(): void {
      draftStrategy.value = solarLocationStrategy.value;
      const stored = solarManualLocation.value;
      draftTimeZone.value = stored?.timeZone ?? systemTimeZoneId();
      draftHemisphere.value = stored?.hemisphere ?? "north";
    }

    function openEditor(): void {
      seedDraft();
      open.value = true;
    }

    /** IANA zone list for the manual pane's select. Plain data (no
     * vnodes), static for the process lifetime — cached once. */
    let timeZoneOptionsCache: HkSelectOption[] | null = null;
    function timeZoneOptions(): HkSelectOption[] {
      timeZoneOptionsCache ??= listTimeZones().map((id) => ({ value: id, label: id }));
      return timeZoneOptionsCache;
    }

    // ── Live summary (the row's label) ────────────────────────────────
    const summaryText = computed(() => {
      const strategy = solarLocationStrategy.value;
      if (strategy === "ip") return t("hikari::theme.solar.strategyIp");
      if (strategy === "manual") {
        const loc = solarManualLocation.value;
        const hemi = (loc?.hemisphere ?? "north") === "south"
          ? t("hikari::theme.solar.south")
          : t("hikari::theme.solar.north");
        const zone = loc?.timeZone ?? systemTimeZoneId();
        return `${t("hikari::theme.solar.strategyManual")} · ${zone} · ${hemi}`;
      }
      return `${t("hikari::theme.solar.strategyTimezone")} · ${systemTimeZoneId()}`;
    });

    function summaryIcon() {
      const strategy = solarLocationStrategy.value;
      if (strategy === "ip") return <Globe2 size={16} />;
      if (strategy === "manual") return <MapPin size={16} />;
      return <Clock size={16} />;
    }

    // ── Editor: strategy tabs ─────────────────────────────────────────
    // Fresh option objects and icon vnodes per call (house rule from
    // HkThemePanelContent: caching vnodes re-mounts them on re-render).
    function strategyOptions(): TabItem[] {
      return [
        { key: "timezone", label: t("hikari::theme.solar.strategyTimezone"), icon: <Clock size={16} /> },
        { key: "ip", label: t("hikari::theme.solar.strategyIp"), icon: <Globe2 size={16} /> },
        { key: "manual", label: t("hikari::theme.solar.strategyManual"), icon: <MapPin size={16} /> },
      ];
    }

    function hemisphereOptions(): TabItem[] {
      return [
        { key: "north", label: t("hikari::theme.solar.north") },
        { key: "south", label: t("hikari::theme.solar.south") },
      ];
    }

    function onSelectStrategy(value: string): void {
      draftStrategy.value = value as SolarLocationStrategy;
    }

    function onSelectHemisphere(value: string): void {
      draftHemisphere.value = value as SolarHemisphere;
    }

    /** Zone change only moves the zone — the hemisphere is the user's
     * explicit pick and is never re-derived from the zone. */
    function onSelectTimeZone(value: string): void {
      draftTimeZone.value = value;
    }

    const hintText = computed(() => {
      if (draftStrategy.value === "ip") return t("hikari::theme.solar.ipHint");
      if (draftStrategy.value === "manual") return t("hikari::theme.solar.manualHint");
      return t("hikari::theme.solar.timezoneHint");
    });

    /** Resolved-coordinates readout for the manual pane, from the same
     * resolver the engine feeds the sun clock — so the number the user
     * reads here IS the number that drives the theme. */
    const resolvedHint = computed(() => {
      if (draftStrategy.value !== "manual") return null;
      const geo = manualLocationOf({
        timeZone: draftTimeZone.value,
        hemisphere: draftHemisphere.value,
      });
      return t("hikari::theme.solar.resolvedAt")
        .replace("{lat}", geo.lat.toFixed(1))
        .replace("{lng}", geo.lng.toFixed(1));
    });

    // ── Apply ─────────────────────────────────────────────────────────
    function applyDraft(): void {
      if (draftStrategy.value === "manual") {
        setSolarManualLocation({
          timeZone: draftTimeZone.value,
          hemisphere: draftHemisphere.value,
        });
      }
      setSolarLocationStrategy(draftStrategy.value);
      // Setters drop the engine's geo memo; resolution is the caller's
      // job — refresh so the theme clock re-resolves immediately.
      void refreshThemeClock();
      open.value = false;
      emit("applied", draftStrategy.value);
    }

    const footerActions = computed<ModalAction[]>(() => [
      {
        label: t("hikari::theme.solar.cancel"),
        variant: "secondary" as const,
        onClick: () => { open.value = false; },
      },
      {
        label: t("hikari::theme.solar.apply"),
        variant: "primary" as const,
        onClick: applyDraft,
      },
    ]);

    return () => (
      <div class="hk-solar-setting">
        <div class="hk-solar-summary" data-strategy={solarLocationStrategy.value}>
          <span class="hk-solar-summary-icon" aria-hidden="true">{summaryIcon()}</span>
          <span class="hk-solar-summary-text">{summaryText.value}</span>
        </div>
        <HkButton
          size="sm"
          variant="outline"
          class="hk-solar-edit"
          onClick={openEditor}
        >
          {t("hikari::theme.solar.edit")}
        </HkButton>

        <HkModal
          modelValue={open.value}
          onUpdate:modelValue={(v: boolean) => { open.value = v; }}
          title={t("hikari::theme.solar.title")}
          width="sm"
          footerActions={footerActions.value}
        >
          <div class="hk-solar-editor" data-strategy={draftStrategy.value}>
            <HTabs
              variant="segmented"
              block
              tabs={strategyOptions()}
              modelValue={draftStrategy.value}
              onUpdate:modelValue={onSelectStrategy}
              ariaLabel={t("hikari::theme.solar.title")}
            />
            <p class="hk-solar-hint">{hintText.value}</p>
            {draftStrategy.value === "manual" && (
              <div class="hk-solar-manual">
                <HkSelect
                  modelValue={draftTimeZone.value}
                  onUpdate:modelValue={onSelectTimeZone}
                  options={timeZoneOptions()}
                  label={t("hikari::theme.solar.strategyTimezone")}
                  panelTitle={t("hikari::theme.solar.strategyTimezone")}
                />
                <div class="hk-solar-hemisphere">
                  <label class="hk-solar-field-label">{t("hikari::theme.solar.hemisphere")}</label>
                  <HTabs
                    variant="segmented"
                    block
                    tabs={hemisphereOptions()}
                    modelValue={draftHemisphere.value}
                    onUpdate:modelValue={onSelectHemisphere}
                    ariaLabel={t("hikari::theme.solar.hemisphere")}
                  />
                </div>
                {resolvedHint.value && (
                  <p class="hk-solar-resolved" data-test="hk-solar-resolved">{resolvedHint.value}</p>
                )}
              </div>
            )}
          </div>
        </HkModal>
      </div>
    );
  },
});

export default HkSolarLocationSetting;
