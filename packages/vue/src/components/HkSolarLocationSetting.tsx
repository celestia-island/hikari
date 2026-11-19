// AI-generated: developed with the ZCode agent (model GLM-5.3); human-directed.
import { computed, defineComponent, ref } from "vue";
import { Clock, Globe2, MapPin, Pencil } from "lucide-vue-next";

import { useI18n } from "../i18n/context";
import { useTheme } from "../theme/useTheme";
import {
  hydrateSolarLocationState,
  solarLocationStrategy,
  solarManualLocation,
  systemTimeZoneId,
  type SolarLocationStrategy,
} from "../theme/useSolarTime";
import HkCard from "./HkCard";
import HkIconButton from "./HkIconButton";
import HkSolarLocationEditor from "./HkSolarLocationEditor";
import "./HkSolarLocationSetting.scss";

// The pure helpers and the modal editor itself live with the editor
// component (2026-11-19 extraction: the editor became a standalone
// mountable surface); re-exported here for back-compat — existing
// imports keep resolving.
export { solarOffsetText, solarTimezoneDetectedRows } from "./HkSolarLocationEditor";

/** Per-instance id for the disabled-state reason text (aria-describedby).
 *  A host page may mount more than one card (settings + a popover), so a
 *  static id would collide; a module counter keeps ids unique across mounts
 *  while staying deterministic for tests. */
let nextSolarReasonId = 0;

/**
 * HkSolarLocationSetting — the solar clock's location STRATEGY card
 * (2026-10-31 product direction: strategies, not a fixed cascade;
 * 2026-11-05 polish wave: standard card + detected-value readout;
 * 2026-11-19: the modal editor moved OUT to HkSolarLocationEditor —
 * the chest's theme panel dropped this card and opens the standalone
 * editor from the mode group's auto option instead. The card itself is
 * UNCHANGED for its remaining hosts (wowsp, the ERP panels): one
 * standard card titled "Daylight location" (the `title` prop
 * overrides or, with an empty string, hides the header), its body
 * carrying the live strategy summary and an ICON-ONLY Edit button
 * (HkIconButton ghost/28) that opens the extracted editor modal.)
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
 * of the HkInput family): any host project drops ONE card at the bottom
 * of its settings page — shittim-chest, the ERP panels, wowsp — and the
 * card plus the editor modal cover the whole interaction. The engine
 * (state, persistence, resolution) lives in theme/useSolarTime.ts; the
 * card only edits it through the editor:
 *
 *  - the summary names the POLICY in a fixed shape ("Auto · By time
 *    zone" / "Auto · IP location" / "Manual · {zone} · {hemisphere}");
 *  - the modal (drafting, detected readouts, globe picker, hemisphere,
 *    apply) is HkSolarLocationEditor's surface entirely.
 *
 * The Edit affordance is AUTO-MODE ONLY (2026-11-05 user direction):
 * the solar clock only drives the theme in `currentMode === "system"`;
 * in a manual light/dark mode the button is disabled (gray) and its
 * tooltip says so. The component reads the singleton theme state
 * itself, so a host that drops it under its own mode switch gets the
 * behavior without wiring anything. (The standalone editor carries no
 * gate — gating the AFFORDANCE is the host's call.)
 */
export const HkSolarLocationSetting = defineComponent({
  name: "HkSolarLocationSetting",
  props: {
    /** Card header title. Unset → the localized default; empty string
     *  → no header (the host's own section label stands alone). */
    title: { type: String, default: undefined },
  },
  emits: {
    /** Fired after OK applied the draft (and refreshed the clock). */
    applied: (_strategy: SolarLocationStrategy) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    // AUTO-mode gate: the sun clock only drives the theme in "system".
    const { currentMode } = useTheme();
    const editorDisabled = computed(() => currentMode.value !== "system");
    const reasonId = `hk-solar-edit-reason-${(nextSolarReasonId += 1)}`;
    // The engine hydrates lazily (storage-silent imports): a host that
    // mounts this card before initTheme() still sees the stored strategy.
    hydrateSolarLocationState();
    const open = ref(false);

    function openEditor(): void {
      open.value = true;
    }

    // ── Live summary (the card's body line) ───────────────────────────
    // Fixed shapes: the policy name first ("Auto · …" / "Manual · …"),
    // then the concrete pin where the strategy HAS one (manual's stored
    // config). The timezone strategy's device zone lives in the editor's
    // detected-value readout, not the summary.
    const summaryText = computed(() => {
      const strategy = solarLocationStrategy.value;
      if (strategy === "ip") return t("hikari::theme.solar.summaryIp");
      if (strategy === "manual") {
        const loc = solarManualLocation.value;
        const hemi = (loc?.hemisphere ?? "north") === "south"
          ? t("hikari::theme.solar.south")
          : t("hikari::theme.solar.north");
        const zone = loc?.timeZone ?? systemTimeZoneId();
        return `${t("hikari::theme.solar.strategyManual")} · ${zone} · ${hemi}`;
      }
      return t("hikari::theme.solar.summaryTimezone");
    });

    function summaryIcon() {
      const strategy = solarLocationStrategy.value;
      if (strategy === "ip") return <Globe2 size={16} />;
      if (strategy === "manual") return <MapPin size={16} />;
      return <Clock size={16} />;
    }

    // The card header: the localized default unless the host overrides
    // (empty string hides the header entirely).
    const cardTitle = computed(() =>
      props.title !== undefined ? props.title : t("hikari::theme.solar.cardTitle"),
    );

    return () => (
      <HkCard class="hk-solar-setting" title={cardTitle.value || undefined}>
        <div class="hk-solar-row">
          <div class="hk-solar-summary" data-strategy={solarLocationStrategy.value}>
            <span class="hk-solar-summary-icon" aria-hidden="true">{summaryIcon()}</span>
            <span class="hk-solar-summary-text">{summaryText.value}</span>
          </div>
          {/* Icon-only Edit (2026-11-05): the row's action is the standard
              ghost icon-button square, not a text pill. Disabled outside
              auto mode; the wrapper owns the tooltip because a disabled
              button drops pointer events, and — since a natively disabled
              control is also UNFOCUSABLE, so keyboard/AT users never see a
              tooltip — the same explanation rides a visually hidden span
              referenced through aria-describedby. */}
          <span
            class="hk-solar-edit-wrap"
            title={
              editorDisabled.value
                ? t("hikari::theme.solar.editAutoOnly")
                : t("hikari::theme.solar.edit")
            }
          >
            <HkIconButton
              size={28}
              variant="ghost"
              class="hk-solar-edit"
              aria-label={t("hikari::theme.solar.edit")}
              aria-describedby={editorDisabled.value ? reasonId : undefined}
              disabled={editorDisabled.value}
              onClick={openEditor}
            >
              {{ icon: () => <Pencil size={16} /> }}
            </HkIconButton>
            {editorDisabled.value && (
              <span id={reasonId} class="hk-solar-edit-reason">
                {t("hikari::theme.solar.editAutoOnly")}
              </span>
            )}
          </span>
        </div>

        <HkSolarLocationEditor
          modelValue={open.value}
          onUpdate:modelValue={(v: boolean) => { open.value = v; }}
          onApplied={(strategy: SolarLocationStrategy) => emit("applied", strategy)}
        />
      </HkCard>
    );
  },
});

export default HkSolarLocationSetting;
