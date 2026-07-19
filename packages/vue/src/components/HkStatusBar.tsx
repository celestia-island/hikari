import { defineComponent } from "vue";

export default defineComponent({
  name: "HkStatusBar",
  props: {
    version: { type: String, default: "" },
  },
  setup(props, { slots }) {
    return () => (
      <footer style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: "1.75rem", padding: "0 0.75rem", flexShrink: 0,
        background: "rgb(var(--color-surface))",
        borderTop: "1px solid rgb(var(--color-border) / 0.1)",
        fontSize: "var(--text-xs)", color: "rgb(var(--color-muted))",
      }}>
        <span>{props.version ? `v${props.version}` : ""}</span>
        <div style={{ display: "flex", gap: "0.5rem" }}>{slots.default?.()}</div>
      </footer>
    );
  },
});
