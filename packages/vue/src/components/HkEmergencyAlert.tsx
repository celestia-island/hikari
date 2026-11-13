/**
 * HkEmergencyAlert — renderer/host for the emergency-alert context
 * (`useEmergencyAlert` / `raiseEmergencyAlert`).
 *
 * The toast family's full-screen takeover member: when a condition
 * invalidates normal work until resolved (quota exhausted, every
 * platform link down), a fixed dimming layer plus ONE full-width
 * signal-striped band takes the screen — the cinematic FUI alert
 * stripe, tuned down to the family's visual language: the tone
 * circular badge, headline and actions reuse the HkErrorLanding
 * vocabulary (its `__icon` recipe, tone washes, HkBadge chip,
 * HkButton actions) scaled up for a band that spans edge to edge.
 *
 * Layering (scale.scss z bands, the documented top order):
 *   floating layers (90000) < ambient HUD (90050) < error landing
 *   (95000) < EMERGENCY (96000) < window titlebar (100001). The layer
 *   teleports to <body> (not #hk-overlay-root) so the document-space
 *   band applies, and its top edge insets below the host's chrome
 *   band via `--hk-chrome-band-inset` — the same two-legged contract
 *   HkModal uses, so in a native shell the titlebar stays visible,
 *   draggable and clickable (user direction 2026-11-13: the alert
 *   must never cover the titlebar).
 *
 * The scrim never blocks: the layer is pointer-events:none and only
 * the band itself is interactive, so work underneath continues
 * (user direction 2026-11-13); the built-in snooze button ("hide for
 *   now") is rendered when the item is dismissible — snoozing hides
 *   the band until the CONDITION clears (see useEmergencyAlert for
 *   the episode contract).
 *
 * Mount once at the shell level, next to `<HToast />`. When several
 * alerts are active only the most severe takes the band (danger >
 * warning, then raise order) and a "+N more" line counts the rest.
 */
import { TriangleAlert } from "lucide-vue-next";
import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  ref,
  Teleport,
  Transition,
  watch,
} from "vue";

import { useI18n } from "../i18n/context";
import {
  emergencySeverityRank,
  snoozeEmergencyAlert,
  useEmergencyAlert,
  type EmergencyAlertItem,
} from "../runtime/useEmergencyAlert";
import HkBadge from "./HkBadge";
import HkButton from "./HkButton";

import "./HkEmergencyAlert.scss";

/** The one band-worthy alert: most severe first, raise order breaks
 *  ties. Snoozed alerts never take the band (they are invisible by
 *  definition — the "+N" count below also ignores them). */
function pickVisible(alerts: EmergencyAlertItem[]): EmergencyAlertItem | null {
  let best: EmergencyAlertItem | null = null;
  for (const item of alerts) {
    if (item.snoozed) continue;
    if (
      best === null ||
      emergencySeverityRank(item.severity) > emergencySeverityRank(best.severity) ||
      (emergencySeverityRank(item.severity) === emergencySeverityRank(best.severity) && item.seq < best.seq)
    ) {
      best = item;
    }
  }
  return best;
}

export default defineComponent({
  name: "HkEmergencyAlert",
  setup() {
    const { alerts } = useEmergencyAlert();
    const { t } = useI18n();

    const visible = computed(() => pickVisible(alerts));
    /** Active, un-snoozed alerts that lost the band to a more severe
     *  one — rendered as the "+N" line so nothing silently disappears. */
    const suppressed = computed(() => alerts.filter((a) => !a.snoozed && a !== visible.value).length);

    const layerRef = ref<HTMLElement | null>(null);
    let prevFocus: HTMLElement | null = null;

    // Focus choreography: the band demands attention, so on raise the
    // focus moves onto its primary action (keyboard users land on
    // "handle now", not wherever they were); when the last alert
    // clears, the focus returns to what held it before — the same
    // give-back contract HkModal's trap uses, minus the trap: the
    // page below stays focusable by design (non-blocking scrim).
    watch(
      visible,
      async (item) => {
        if (item) {
          if (document.activeElement instanceof HTMLElement && layerRef.value?.contains(document.activeElement) === false) {
            prevFocus = document.activeElement;
          }
          await nextTick();
          const primary = layerRef.value?.querySelector<HTMLElement>(".hk-emergency-actions button");
          primary?.focus();
        } else if (prevFocus?.isConnected) {
          prevFocus.focus();
          prevFocus = null;
        } else {
          prevFocus = null;
        }
      },
      { immediate: false },
    );

    onBeforeUnmount(() => {
      if (prevFocus?.isConnected) prevFocus.focus();
      prevFocus = null;
    });

    // Esc snoozes — but only while the focus is inside the band, so
    // the key never races a modal stack's own Esc handling (popup
    // manager owns Esc elsewhere; this handler is band-scoped).
    function onKeydown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const item = visible.value;
      if (!item?.dismissible) return;
      e.stopPropagation();
      snoozeEmergencyAlert(item.id);
    }

    return () => {
      const item = visible.value;
      if (!item) return null;

      const kicker = item.kicker || t(`hikari::emergencyAlert.kicker.${item.severity}`, item.severity === "danger" ? "CRITICAL ALERT" : "WARNING");
      const primaryVariant = item.severity === "danger" ? "danger" : "primary";

      return (
        <Teleport to="body">
          <Transition name="hk-emergency" appear>
            <div
              ref={layerRef}
              class={["hk-emergency", `is-${item.severity}`]}
              role="alert"
              aria-live="assertive"
              data-severity={item.severity}
              onKeydown={onKeydown}
            >
              <div class="hk-emergency-scrim" aria-hidden="true" />
              <div class="hk-emergency-band">
                <div class="hk-emergency-inner">
                  <div class="hk-emergency-icon" aria-hidden="true">
                    <TriangleAlert size={32} />
                  </div>

                  {item.code && (
                    <div class="hk-emergency-meta">
                      <HkBadge variant={item.severity === "danger" ? "error" : "warning"} size="sm" mono>
                        {item.code}
                      </HkBadge>
                    </div>
                  )}

                  <div class="hk-emergency-kicker" aria-hidden="true">{kicker}</div>
                  <h1 class="hk-emergency-title">{item.title}</h1>
                  {item.description && <p class="hk-emergency-desc">{item.description}</p>}

                  {suppressed.value > 0 && (
                    <p class="hk-emergency-more" aria-live="polite">
                      +{suppressed.value} · {t("hikari::emergencyAlert.more", "more alert(s) pending")}
                    </p>
                  )}

                  <div class="hk-emergency-actions">
                    {item.actions.map((action, i) => (
                      <HkButton
                        key={`${item.id}-${i}-${action.label}`}
                        variant={action.kind === "ghost" ? "ghost" : i === 0 ? primaryVariant : "ghost"}
                        size="md"
                        onClick={() => action.onClick?.()}
                      >
                        {action.label}
                      </HkButton>
                    ))}
                    {item.dismissible && (
                      <HkButton variant="secondary" size="md" onClick={() => snoozeEmergencyAlert(item.id)}>
                        {t("hikari::emergencyAlert.dismiss", "Hide for now")}
                      </HkButton>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </Teleport>
      );
    };
  },
});
