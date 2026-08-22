import { defineComponent, type PropType } from "vue";
import HBadge from "./HkBadge";
import { useI18n } from "../i18n/context";
import "./HkSplash.scss";

export default defineComponent({
  name: "HkSplash",
  props: {
    logo: { type: String, default: "" },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    status: { type: String as PropType<"online" | "offline" | "loading" | "coming-soon">, default: "coming-soon" },
    statusLabel: { type: String, default: "" },
  },
  setup(props, { slots }) {
    const { t } = useI18n();
    const statusVariant: Record<string, "success" | "error" | "warning" | "primary"> = {
      online: "success",
      offline: "error",
      loading: "warning",
      "coming-soon": "primary",
    };

    return () => (
      <div class="hk-splash">
        <main class="hk-splash-main">
          {props.logo ? <img class="hk-splash-logo" src={props.logo} alt={props.title || t("hikari::logo.fallbackAlt", "Logo")} /> : null}
          <h1 class="hk-splash-title">{props.title || slots.title?.()}</h1>
          {props.subtitle ? <p class="hk-splash-subtitle">{props.subtitle}</p> : null}
          {slots.description ? <div class="hk-splash-description">{slots.description?.()}</div> : null}
          <div class="hk-splash-status">
            <HBadge variant={statusVariant[props.status] || "primary"} size="md">
              {props.statusLabel || props.status}
            </HBadge>
          </div>
          {slots.actions ? <div class="hk-splash-actions">{slots.actions?.()}</div> : null}
        </main>
        {slots.footer ? <footer class="hk-splash-footer">{slots.footer?.()}</footer> : null}
      </div>
    );
  },
});
