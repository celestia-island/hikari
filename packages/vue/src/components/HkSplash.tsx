import { defineComponent, type PropType } from "vue";
import HkBadge from "./HkBadge";
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
    const statusVariant: Record<string, "success" | "error" | "warning" | "primary"> = {
      online: "success",
      offline: "error",
      loading: "warning",
      "coming-soon": "primary",
    };

    return () => (
      <div class="hk-splash">
        <main class="hk-splash-main">
          {props.logo ? <img class="hk-splash-logo" src={props.logo} alt={props.title || "logo"} /> : null}
          <h1 class="hk-splash-title">{props.title || slots.title?.()}</h1>
          {props.subtitle ? <p class="hk-splash-subtitle">{props.subtitle}</p> : null}
          {slots.description ? <div class="hk-splash-description">{slots.description?.()}</div> : null}
          <div class="hk-splash-status">
            <HkBadge variant={statusVariant[props.status] || "primary"} size="md">
              {props.statusLabel || props.status}
            </HkBadge>
          </div>
          {slots.actions ? <div class="hk-splash-actions">{slots.actions?.()}</div> : null}
        </main>
        {slots.footer ? <footer class="hk-splash-footer">{slots.footer?.()}</footer> : null}
      </div>
    );
  },
});
