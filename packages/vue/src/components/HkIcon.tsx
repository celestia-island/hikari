import { defineComponent, type PropType } from "vue";
import { iconByName } from "../composables/iconRegistry";
import "./HkIcon.scss";

export default defineComponent({
  name: "HkIcon",
  props: {
    name: { type: String, required: true },
    size: { type: Number as PropType<16 | 20 | 24 | 32 | 40 | 48 | 64>, default: 20 },
    color: { type: String as PropType<"primary" | "secondary" | "accent" | "success" | "warning" | "danger" | "muted"> },
  },
  setup(props) {
    return () => {
      const cls = [
        "hk-icon",
        `hk-icon-${props.size}`,
        props.color ? `hk-icon-${props.color}` : "",
      ];

      // Resolve through the explicit registry: a wildcard import of
      // lucide-vue-next here defeated tree-shaking and shipped the whole
      // ~1500-icon library in the shared bundle of every consumer.
      const IconComp = iconByName(props.name) as any;
      return <span class={cls}><IconComp /></span>;
    };
  },
});
