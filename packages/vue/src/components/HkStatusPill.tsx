import { defineComponent, type PropType } from "vue";

import { useI18n } from "../i18n/context";
import "./HkStatusPill.scss";

export type PillState = "ok" | "warn" | "error" | "unknown";

/**
 * HkStatusPill — compact health indicator with optional latency and
 * version readouts. Used for hub connections, edge nodes, stations:
 * anywhere a service's liveness is summarized inline.
 *
 * ```tsx
 * <HStatusPill state="ok" label="online" latencyMs={34} version="0.2.0" />
 * ```
 */
export const HkStatusPill = defineComponent({
  name: "HkStatusPill",
  props: {
    state: { type: String as PropType<PillState>, default: "unknown" },
    /** Text beside the dot (e.g. "online" / a service name). */
    label: { type: String, default: "" },
    /** Round-trip latency in milliseconds; omitted when unknown. */
    latencyMs: { type: Number, default: undefined },
    /** Service version string; omitted when unknown. */
    version: { type: String, default: undefined },
  },
  setup(props) {
    const { t } = useI18n();
    return () => (
      <span class={["hk-status-pill", `hk-status-pill-${props.state}`]} role="status">
        <span class="hk-status-pill-dot" aria-hidden="true" />
        {props.label && <span class="hk-status-pill-label">{props.label}</span>}
        {props.latencyMs != null && (
          <span class="hk-status-pill-latency">{props.latencyMs}{t("hikari::statusPill.ms", " ms")}</span>
        )}
        {props.version && <span class="hk-status-pill-version">{props.version}</span>}
      </span>
    );
  },
});
