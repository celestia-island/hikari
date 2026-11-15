/**
 * HEmergencySnoozeTray — the persistent home for SNOOZED emergency
 * alerts ("hide for now" must not make an alert vanish: it minimizes
 * to a persistent chip in the chrome bar's trailing corner — the same
 * strip the desktop titlebar and the browser header share; the HOST
 * mounts this component there, next to the window controls).
 *
 * Pure composition over upstream members — the chips ARE
 * HkPersistentToast (severity tone icon + label + hover/pin detail
 * card), the row is HkPersistentToastGroup (first N visible, the rest
 * collapse into the "+N" counter — the mobile single-icon + count
 * shape falls out of maxVisible=1 + the chips' iconOnly mode). No
 * bespoke chip markup here.
 *
 * Chip contract:
 * - tone = the alert's severity (warning amber / danger red);
 * - label = the alert title; the detail card mirrors the original
 *   toast text (icon + title + description — no extra affordances;
 *   the tray's own Show-again button was retired 2026-11-15 — restore
 *   lives in the notification-center bell panel).
 * - Narrow chrome bars (host passes `iconOnly`, e.g. via
 *   useBreakpoint().isMobile) collapse each chip to its tone icon;
 *   the group counter takes over from there.
 *
 * Mount once in the chrome bar; renders NOTHING while no alert is
 * snoozed.
 */
import { TriangleAlert } from "lucide-vue-next";
import { computed, defineComponent } from "vue";

import {
  useEmergencyAlert,
  type EmergencyAlertItem,
} from "../runtime/useEmergencyAlert";
import HkPersistentToast from "./HkPersistentToast";
import HkPersistentToastGroup from "./HkPersistentToastGroup";

export default defineComponent({
  name: "HEmergencySnoozeTray",
  props: {
    /** Icon-only chips (narrow chrome bars). The host decides via its
     *  own breakpoint read (useBreakpoint().isMobile is the expected
     *  driver). */
    iconOnly: { type: Boolean, default: false },
    /** Visible chips before the "+N" counter takes over (1 on mobile,
     *  3 otherwise, when the host leaves it to the tray). */
    maxVisible: { type: Number, default: 0 },
  },
  setup(props) {
    const { alerts } = useEmergencyAlert();

    const snoozed = computed(() => alerts.filter((a) => a.snoozed));
    const resolvedMaxVisible = computed(() =>
      props.maxVisible > 0 ? props.maxVisible : props.iconOnly ? 1 : 3,
    );

    function renderChip(item: EmergencyAlertItem, iconOnly: boolean) {
      return (
        <HkPersistentToast
          key={item.id}
          tone={item.severity === "danger" ? "error" : "warning"}
          label={item.title}
          iconOnly={iconOnly}
        >
          {{
            detail: () => (
              <div class={["hk-emergency-snooze-card", `is-${item.severity}`]}>
                <TriangleAlert
                  size={14}
                  class="hk-emergency-snooze-card__icon"
                  aria-hidden="true"
                />
                <p class="hk-emergency-snooze-card__title">{item.title}</p>
                {item.description && (
                  <p class="hk-emergency-snooze-card__desc">{item.description}</p>
                )}
              </div>
            ),
          }}
        </HkPersistentToast>
      );
    }

    return () => {
      if (snoozed.value.length === 0) return null;
      return (
        <span class="hk-emergency-snooze-tray">
          <HkPersistentToastGroup maxVisible={resolvedMaxVisible.value}>
            {snoozed.value.map((item) => renderChip(item, props.iconOnly))}
          </HkPersistentToastGroup>
        </span>
      );
    };
  },
});
