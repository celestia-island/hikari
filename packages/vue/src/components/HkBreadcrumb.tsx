import { computed, defineComponent, type PropType } from "vue";
import "../../../components/src/styles/components/breadcrumb.scss";

export default defineComponent({
  name: "HkBreadcrumb",
  props: {
    items: { type: Array as PropType<{ label: string; to?: string }[]>, required: true },
    separator: { type: String },
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
  },
  setup(props) {
    const cls = computed(() => ["hk-breadcrumb", `hk-breadcrumb-${props.size}`]);

    return () => (
      <nav aria-label="Breadcrumb">
        <ol class={cls.value}>
          {props.items.map((item, index) => (
            <li key={index} class="hk-breadcrumb-item">
              {item.to ? (
                <a href={item.to} class="hk-breadcrumb-link">{item.label}</a>
              ) : (
                <span class="hk-breadcrumb-link">{item.label}</span>
              )}
              {index < props.items.length - 1 && (
                <span class="hk-breadcrumb-separator">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    );
  },
});
