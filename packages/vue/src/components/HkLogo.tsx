import { defineComponent } from "vue";

export default defineComponent({
  name: "HkLogo",
  props: {
    src: { type: String, default: "" },
    size: { type: String, default: "md" },
  },
  setup(props) {
    const sizes: Record<string, { w: number; h: number }> = { sm: { w: 24, h: 24 }, md: { w: 32, h: 32 }, lg: { w: 48, h: 48 } };
    const s = sizes[props.size] || sizes.md;
    const imgStyle = { width: `${s.w}px`, height: `${s.h}px`, borderRadius: "8px", filter: "drop-shadow(0 2px 8px rgb(0 0 0 / 0.3))" };
    return () => props.src ? <img src={props.src} style={imgStyle} alt="logo" /> : <div style={{ ...imgStyle, background: "rgb(var(--color-primary))", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>A</div>;
  },
});
