import { ChevronRight } from "lucide-vue-next";

import { computed, defineComponent, type PropType } from "vue";
import { safeHref } from "../utils/safeHref";
import { useI18n } from "../i18n/context";
import "./HkBreadcrumb.scss";

export default defineComponent({
  name: "HkBreadcrumb",
  props: {
    items: { type: Array as PropType<{ label: string; to?: string }[]>, required: true },
    separator: { type: String },
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
  },
  setup(props) {
    const { t } = useI18n();
    const cls = computed(() => ["hk-breadcrumb", `hk-breadcrumb-${props.size}`]);

    return () => (
      <nav aria-label={t("hikari::breadcrumb.label", "Breadcrumb")}>
        <ol class={cls.value}>
          {props.items.map((item, index) => (
            <li key={index} class="hk-breadcrumb-item">
              {item.to ? (
                <a href={safeHref(item.to)} class="hk-breadcrumb-link">{item.label}</a>
              ) : (
                <span class="hk-breadcrumb-link">{item.label}</span>
              )}
              {index < props.items.length - 1 && (
                <span class="hk-breadcrumb-separator">
                  <ChevronRight />
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    );
  },
});
