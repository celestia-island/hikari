import { defineComponent, ref, type PropType } from "vue";

export interface LocaleOption {
  code: string;
  label: string;
}

export const HkLocalePicker = defineComponent({
  name: "HkLocalePicker",
  props: {
    locales: {
      type: Array as PropType<LocaleOption[]>,
      default: () => [],
    },
    currentLocale: {
      type: String,
      default: "en",
    },
  },
  emits: ["select"],
  setup(props, { emit }) {
    const open = ref(false);

    function handleSelect(code: string) {
      emit("select", code);
      open.value = false;
    }

    return () => (
      <div style={{ position: "relative" }}>
        <button
          type="button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            padding: "0.25rem 0.5rem",
            border: "1px solid var(--border-faint, rgb(var(--color-border) / 10%))",
            borderRadius: "var(--radius-sm, 4px)",
            background: "transparent",
            color: "rgb(var(--color-muted))",
            fontSize: "0.75rem",
            fontWeight: 500,
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onClick={() => (open.value = !open.value)}
          onBlur={() => setTimeout(() => (open.value = false), 150)}
        >
          {props.currentLocale.toUpperCase()}
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.5 }}>
            <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.2" />
          </svg>
        </button>
        {open.value && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              minWidth: "120px",
              background: "rgb(var(--color-surface))",
              border: "1px solid var(--border-faint, rgb(var(--color-border) / 10%))",
              borderRadius: "var(--radius-md, 6px)",
              boxShadow: "0 4px 16px rgb(0 0 0 / 12%)",
              // Local stacking inside the header's own context — the
              // app-chrome header-popup band documents the intent (this
              // value is scoped, it never races the popup stack).
              zIndex: "var(--z-header-popup, 150)",
              overflow: "hidden",
              padding: "4px",
            }}
          >
            {props.locales.map((loc) => (
              <button
                key={loc.code}
                type="button"
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "6px 10px",
                  border: "none",
                  borderRadius: "4px",
                  background: loc.code === props.currentLocale
                    ? "var(--c-primary-subtle, rgb(var(--color-primary) / 8%))"
                    : "transparent",
                  color: loc.code === props.currentLocale
                    ? "var(--c-primary, rgb(var(--color-primary)))"
                    : "rgb(var(--color-text))",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.1s",
                }}
                onMouseenter={(e: MouseEvent) => {
                  if (loc.code !== props.currentLocale) {
                    (e.currentTarget as HTMLElement).style.background = "var(--c-primary-overlay, rgb(var(--color-primary) / 15%))";
                  }
                }}
                onMouseleave={(e: MouseEvent) => {
                  if (loc.code !== props.currentLocale) {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }
                }}
                onMousedown={() => handleSelect(loc.code)}
              >
                {loc.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
});
