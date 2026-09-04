import { defineComponent, type PropType } from "vue";
import {
  functionalIconComponent,
  functionalIconSvg,
  iconByName,
} from "../composables/iconRegistry";
import "./HkIcon.scss";

/** Semantic functional keys resolved through the alias/pack pipeline. */
const FUNCTIONAL_KEYS = new Set(["close", "back"]);

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

      // Functional keys ("close", "back") resolve through the material-pack
      // pipeline FIRST (a host theme layer can swap the whole glyph family
      // at runtime — sanitized raw SVG from the registered pack), then fall
      // back to the alias's lucide component (close→X, back→ChevronLeft).
      // Everything else resolves through the explicit lucide registry: a
      // wildcard import of lucide-vue-next here defeated tree-shaking and
      // shipped the whole ~1500-icon library in the shared bundle of every
      // consumer.
      if (FUNCTIONAL_KEYS.has(props.name)) {
        const svg = functionalIconSvg(props.name);
        if (svg) {
          return (
            <span class={cls} v-html={svg} />
          );
        }
        const FuncComp = functionalIconComponent(props.name) as any;
        return <span class={cls}><FuncComp /></span>;
      }

      const IconComp = iconByName(props.name) as any;
      return <span class={cls}><IconComp /></span>;
    };
  },
});
