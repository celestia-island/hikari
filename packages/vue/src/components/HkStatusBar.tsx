import { defineComponent, type PropType } from "vue";
import "./HkStatusBar.scss";

const connectionColors: Record<string, string> = {
  connected: "var(--color-success)",
  reconnecting: "var(--color-warning)",
  disconnected: "var(--color-error)",
};

export default defineComponent({
  name: "HkStatusBar",
  props: {
    version: { type: String, default: "" },
    connectionStatus: {
      type: String as PropType<"connected" | "reconnecting" | "disconnected" | undefined>,
      default: undefined,
    },
    stats: {
      type: Array as PropType<{ label: string; value: string }[]>,
      default: undefined,
    },
    mockMode: { type: Boolean, default: false },
  },
  emits: {
    retry: () => true,
  },
  setup(props, { slots, emit }) {
    return () => (
      <footer class="hk-status-bar">
        <div class="hk-status-bar-left">
          {props.version && (
            <span class="hk-status-bar-version">v{props.version}</span>
          )}
          {props.mockMode && (
            <span class="hk-status-bar-mock">MOCK</span>
          )}
          {props.connectionStatus && (
            <button
              class={[
                "hk-status-bar-connection",
                `hk-status-bar-connection-${props.connectionStatus}`,
              ]}
              style={{
                "--dot-color": connectionColors[props.connectionStatus] ?? connectionColors.disconnected,
              }}
              onClick={() => {
                if (
                  props.connectionStatus === "reconnecting" ||
                  props.connectionStatus === "disconnected"
                ) {
                  emit("retry");
                }
              }}
              type="button"
              disabled={props.connectionStatus === "connected"}
            >
              <span class="hk-status-bar-dot" />
              <span>{props.connectionStatus}</span>
            </button>
          )}
          {props.stats?.map((stat) => (
            <span class="hk-status-bar-stat" key={stat.label}>
              <span class="hk-status-bar-stat-label">{stat.label}</span>
              <span class="hk-status-bar-stat-value">{stat.value}</span>
            </span>
          ))}
        </div>
        <div class="hk-status-bar-right">
          {slots.default?.()}
        </div>
      </footer>
    );
  },
});
