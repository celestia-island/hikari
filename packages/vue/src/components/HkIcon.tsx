import { defineComponent, ref, watch, type PropType, h, type Component } from "vue";
import "../../../components/src/styles/components/icon.scss";

export default defineComponent({
  name: "HkIcon",
  props: {
    icon: { type: String, required: true },
    size: { type: Number as PropType<16 | 20 | 24 | 32 | 40 | 48 | 64>, default: 20 },
    color: { type: String as PropType<"primary" | "secondary" | "accent" | "success" | "warning" | "danger" | "muted"> },
  },
  setup(props) {
    const iconComponent = ref<Component | null>(null);

    function pascalCase(str: string): string {
      const camel = str.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
      return camel.charAt(0).toUpperCase() + camel.slice(1);
    }

    async function loadIcon(name: string) {
      try {
        const mod = await import("lucide-vue-next");
        const icons = mod as Record<string, Component>;
        const pName = pascalCase(name);
        if (icons[pName]) {
          iconComponent.value = icons[pName];
        } else if (icons[name]) {
          iconComponent.value = icons[name];
        }
      } catch {
        iconComponent.value = null;
      }
    }

    watch(() => props.icon, (name) => loadIcon(name), { immediate: true });

    return () => {
      const cls = [
        "hikari-icon",
        `hikari-icon-${props.size}`,
        props.color ? `hikari-icon-${props.color}` : "",
      ];

      return (
        <span class={cls}>
          {iconComponent.value ? h(iconComponent.value) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
            </svg>
          )}
        </span>
      );
    };
  },
});
