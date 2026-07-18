import { computed, defineComponent, type PropType } from "vue";
import "../../../components/src/styles/components/avatar.scss";

export default defineComponent({
  name: "HkAvatar",
  props: {
    src: { type: String },
    name: { type: String },
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
  },
  setup(props) {
    const cls = computed(() => [
      "hikari-avatar",
      `hikari-avatar--${props.size}`,
    ]);

    return () => (
      <div class={cls.value}>
        {props.src ? (
          <img src={props.src} alt={props.name} />
        ) : (
          <span class="hikari-avatar__fallback">{props.name?.charAt(0)?.toUpperCase() ?? "?"}</span>
        )}
      </div>
    );
  },
});
