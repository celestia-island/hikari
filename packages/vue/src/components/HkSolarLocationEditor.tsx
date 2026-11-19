// AI-generated: developed with the ZCode agent (model GLM-5.3); human-directed.
import { computed, defineAsyncComponent, defineComponent, ref, watch } from "vue";
import { Clock, Globe2, MapPin } from "lucide-vue-next";

import { useI18n } from "../i18n/context";
import { refreshThemeClock } from "../theme/useTheme";
import {
  hydrateSolarLocationState,
  manualLocationOf,
  probeSolarIpInsight,
  setSolarLocationStrategy,
  setSolarManualLocation,
  solarIpInsight,
  solarIpProbeState,
  solarLocationStrategy,
  solarManualLocation,
  systemTimeZoneId,
  type SolarHemisphere,
  type SolarLocationStrategy,
} from "../theme/useSolarTime";
import {
  cityKey,
  sectorForZone,
  sectorNameKey,
  standardOffsetHours,
} from "../theme/solarTimeZones";
import HkButton from "./HkButton";
import HkCopyBadge from "./HkCopyBadge";
import HkModal, { type ModalAction } from "./HkModal";
import HTabs, { type TabItem } from "./HkTabs";
import "./HkSolarLocationSetting.scss";

// The globe picker loads lazily (defineAsyncComponent, module level —
// the async wrapper is created once, import() is module-cached):
// three.js and the board only enter the bundle graph when a host
// actually opens the manual pane — the settings card stays weightless.
const HkTimeZoneGlobe = defineAsyncComponent(() => import("./HkTimeZoneGlobe"));

/** One copyable value of the editor's detected-value readout. `mono`
 *  faces technical ids (zone ids, IPs, ASNs) in the badge mono face;
 *  `wrap` renders the rectangular, soft-wrapping chip for long prose
 *  values (city lists, region chains) instead of a pill. */
interface SolarDetectedBadge {
  text: string;
  mono?: boolean;
  wrap?: boolean;
}

/** One "label → value tags" line of the readout — one info item per
 *  line, so long values keep their own row and the column stays tidy. */
interface SolarDetectedRow {
  label: string;
  badges: SolarDetectedBadge[];
}

/** Exact UTC offset label ("UTC+08:00", "UTC+05:30", "UTC") — the
 *  offset is language-independent, so no locale key needed. Exported
 *  for the unit pins on the sign/fraction formatting (negative and
 *  half-quarter offsets never render on a UTC CI runner through the
 *  component path alone). */
export function solarOffsetText(hours: number): string {
  if (hours === 0) return "UTC";
  const sign = hours > 0 ? "+" : "-";
  const abs = Math.abs(hours);
  const whole = Math.floor(abs + 1e-9);
  const minutes = Math.round((abs - whole) * 60);
  return `UTC${sign}${String(whole).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Pure row builder for the timezone pane (exported for tests). The
 *  translated band name + example cities appear ONLY for zones whose
 *  whole-hour standard offset IS one of the 24 wheel sectors (−11 …
 *  +12): half-hour zones (Asia/Kolkata +5.5) AND whole-hour zones
 *  outside the wheel (Pacific/Apia +13, Pacific/Kiritimati +14,
 *  Etc/GMT+12 at standard −12) fall back to the exact UTC offset
 *  instead of a mislabeled nearest band. */
export function solarTimezoneDetectedRows(
  zone: string,
  translate: (key: string) => string,
): SolarDetectedRow[] {
  const rows: SolarDetectedRow[] = [
    {
      label: translate("hikari::theme.solar.detectedZone"),
      badges: [{ text: zone, mono: true }],
    },
  ];
  const hours = standardOffsetHours(zone);
  const sector = sectorForZone(zone);
  if (sector && sector.offset === hours) {
    rows.push({
      label: translate("hikari::theme.solar.detectedBand"),
      badges: [{ text: translate(sectorNameKey(sector.offset)) }],
    });
    if (sector.cities.length > 0) {
      const separator = translate("hikari::theme.solar.citySeparator");
      const text = sector.cities.map((slug) => translate(cityKey(slug))).join(separator);
      rows.push({
        label: translate("hikari::theme.solar.detectedCities"),
        badges: [{ text, wrap: true }],
      });
    }
  } else {
    rows.push({
      label: translate("hikari::theme.solar.detectedOffset"),
      badges: [{ text: solarOffsetText(hours) }],
    });
  }
  return rows;
}

/**
 * HkSolarLocationEditor — the solar clock's location STRATEGY EDITOR,
 * extracted from HkSolarLocationSetting's modal (2026-11-19 user
 * direction: the settings card retires from the chest's theme panel
 * and the entry moves onto the mode group's auto option — the editor
 * becomes a standalone mountable surface any host can open from its
 * own affordance). The strategy ladder and its engine wiring are
 * unchanged:
 *
 *  1. "timezone" (default, highest priority) — fully offline: derive
 *     the longitude from the device's IANA time zone;
 *  2. "ip" — the classic web cascade (granted geolocation → ipapi
 *     lookup → time-zone estimate fallback);
 *  3. "manual" — an explicitly picked IANA time zone plus hemisphere.
 *
 * The modal drafts a strategy (segmented Clock/Globe2/MapPin tabs).
 * The first line under the tabs states the strategy's PRINCIPLE; for
 * the non-manual strategies a detected-value readout follows, one
 * info item per line as HkCopyBadge tags (click copies, hover says
 * so): timezone shows the device zone id + its translated band and
 * example cities; ip probes the lookup engine on tab entry and shows
 * IP / autonomous system / organization / network region / IP time
 * zone, with a retry affordance when the probe fails. The manual pane
 * exposes the IANA globe picker and an explicit hemisphere segmented
 * group — hemisphere is NEVER inferred from the zone.
 *
 * OK applies setSolarManualLocation (manual only) →
 * setSolarLocationStrategy → refreshThemeClock() (the setters drop the
 * engine's geo memo but do not re-resolve on their own), closes the
 * modal and fires `applied`. The draft is re-seeded from the engine
 * every time the modal OPENS, so a host that leaves it mounted gets a
 * fresh draft each visit. Unlike the card, the editor carries NO
 * auto-mode gate: gating the AFFORDANCE (grey vs hidden) is the
 * host's call — the component is the editing surface itself.
 */
export const HkSolarLocationEditor = defineComponent({
  name: "HkSolarLocationEditor",
  props: {
    /** Open state of the modal. */
    modelValue: { type: Boolean, default: false },
  },
  emits: {
    "update:modelValue": (_open: boolean) => true,
    /** Fired after OK applied the draft (and refreshed the clock). */
    applied: (_strategy: SolarLocationStrategy) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    // The engine hydrates lazily (storage-silent imports): a host that
    // opens the editor before initTheme() still sees the stored strategy.
    hydrateSolarLocationState();

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

    // Opening re-seeds (the card's openEditor grammar moved here).
    watch(
      () => props.modelValue,
      (isOpen) => {
        if (isOpen) seedDraft();
      },
      { immediate: true },
    );

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

    // ── Detected-value readout (timezone / ip tabs) ───────────────────
    const detectedRows = computed<SolarDetectedRow[]>(() => {
      if (draftStrategy.value === "timezone") {
        return solarTimezoneDetectedRows(systemTimeZoneId(), (key) => t(key));
      }
      if (draftStrategy.value === "ip") {
        const insight = solarIpInsight.value;
        if (!insight) return [];
        // One valid info item per line — the readout only renders the
        // fields the lookup service actually reported.
        const rows: SolarDetectedRow[] = [
          { label: t("hikari::theme.solar.detectedIp"), badges: [{ text: insight.ip, mono: true }] },
        ];
        if (insight.asn) {
          rows.push({
            label: t("hikari::theme.solar.detectedAsn"),
            badges: [{ text: insight.asn, mono: true }],
          });
        }
        if (insight.org) {
          rows.push({ label: t("hikari::theme.solar.detectedOrg"), badges: [{ text: insight.org }] });
        }
        const region = [insight.countryName, insight.region, insight.city]
          .filter((part): part is string => Boolean(part))
          .join(" · ");
        if (region) {
          rows.push({
            label: t("hikari::theme.solar.detectedRegion"),
            badges: [{ text: region, wrap: true }],
          });
        }
        if (insight.timeZone) {
          rows.push({
            label: t("hikari::theme.solar.detectedIpZone"),
            badges: [{ text: insight.timeZone, mono: true }],
          });
        }
        return rows;
      }
      return [];
    });

    // Entering the IP pane asks the engine for insight (fresh snapshots
    // report without touching the network; the probe is purely
    // informational and never changes strategy or geo memo).
    watch(
      () => [props.modelValue, draftStrategy.value] as const,
      ([isOpen, strategy]) => {
        if (isOpen && strategy === "ip") void probeSolarIpInsight();
      },
      { immediate: true },
    );

    /** The probe's status line (IP pane only): a muted progress note
     *  while nothing has been detected yet, or the failure line with its
     *  retry affordance. A visible readout stays quiet while a refresh
     *  probe is in flight. */
    const probeStatus = computed<{ kind: "probing" | "failed"; text: string } | null>(() => {
      if (draftStrategy.value !== "ip") return null;
      const state = solarIpProbeState.value;
      if (state === "failed") {
        // A failed FIRST probe has nothing to show but the failure; a
        // failed REFRESH leaves the last known values on the rows — the
        // copy must say so instead of contradicting them.
        return {
          kind: "failed",
          text: detectedRows.value.length > 0
            ? t("hikari::theme.solar.detectedRefreshFailed")
            : t("hikari::theme.solar.detectedFailed"),
        };
      }
      if (detectedRows.value.length === 0 && (state === "probing" || state === "idle")) {
        return { kind: "probing", text: t("hikari::theme.solar.detectedProbing") };
      }
      return null;
    });

    function retryProbe(): void {
      void probeSolarIpInsight(true);
    }

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

    function renderDetected() {
      if (draftStrategy.value === "manual") return null;
      return (
        <div class="hk-solar-detected" data-test="hk-solar-detected">
          {detectedRows.value.map((row) => (
            <div class="hk-solar-detected-row" key={row.label}>
              <span class="hk-solar-detected-label">{row.label}</span>
              <div class="hk-solar-detected-value">
                {row.badges.map((badge) => (
                  <HkCopyBadge
                    key={badge.text}
                    mono={badge.mono ?? false}
                    pill={!badge.wrap}
                    value={badge.text}
                  >
                    {badge.text}
                  </HkCopyBadge>
                ))}
              </div>
            </div>
          ))}
          {probeStatus.value && (
            <div class="hk-solar-detected-status" data-state={probeStatus.value.kind}>
              <span>{probeStatus.value.text}</span>
              {probeStatus.value.kind === "failed" && (
                <HkButton
                  size="sm"
                  variant="ghost"
                  class="hk-solar-detected-retry"
                  onClick={retryProbe}
                >
                  {t("hikari::theme.solar.detectedRetry")}
                </HkButton>
              )}
            </div>
          )}
        </div>
      );
    }

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
      emit("update:modelValue", false);
      emit("applied", draftStrategy.value);
    }

    const footerActions = computed<ModalAction[]>(() => [
      {
        label: t("hikari::theme.solar.cancel"),
        variant: "secondary" as const,
        onClick: () => emit("update:modelValue", false),
      },
      {
        label: t("hikari::theme.solar.apply"),
        variant: "primary" as const,
        onClick: applyDraft,
      },
    ]);

    return () => (
      <HkModal
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: boolean) => emit("update:modelValue", v)}
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
          {renderDetected()}
          {draftStrategy.value === "manual" && (
            <div class="hk-solar-manual">
              {/* The globe picker (2026-10-31): 24 equal time-sector
                  wedges on a spinning, borderless world-plates sphere,
                  an always-on top-center readout included — the IANA
                  dropdown it replaced listed hundreds of raw zone ids.
                  Still writes the same draftTimeZone the engine applies. */}
              <HkTimeZoneGlobe
                modelValue={draftTimeZone.value}
                onUpdate:modelValue={onSelectTimeZone}
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
    );
  },
});

export default HkSolarLocationEditor;
