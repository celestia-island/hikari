import { defineComponent } from "vue";

/**
 * Title + actions page header. Slot `actions` renders on the right.
 */
export const HkPageHeader = defineComponent({
  name: "HkPageHeader",
  props: {
    title: { type: String, required: true },
  },
  setup(props, { slots }) {
    return () => (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-12, 0.75rem)",
          marginBottom: "var(--space-16, 1rem)",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-lg, 1.125rem)",
            fontWeight: 700,
            color: "rgb(var(--color-text))",
          }}
        >
          {props.title}
        </h1>
        {slots.actions && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8, 0.5rem)" }}>
            {slots.actions()}
          </div>
        )}
      </div>
    );
  },
});
