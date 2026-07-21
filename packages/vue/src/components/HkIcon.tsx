import { defineComponent, type PropType } from "vue";
import * as LucideIcons from "lucide-vue-next";
import "../../../components/src/styles/components/icon.scss";

function pascalCase(str: string): string {
  const camel = str.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

const icons = LucideIcons as Record<string, any>;

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

      const pName = pascalCase(props.name);
      const IconComp = icons[pName] || icons[props.name];

      if (IconComp) {
        return <span class={cls}><IconComp /></span>;
      }

      return (
        <span class={cls}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
          </svg>
        </span>
      );
    };
  },
});
