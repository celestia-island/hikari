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
        <main class="hk-splash__main">
          {props.logo ? <img class="hk-splash__logo" src={props.logo} alt={props.title || "logo"} /> : null}
          <h1 class="hk-splash__title">{props.title || slots.title?.()}</h1>
          {props.subtitle ? <p class="hk-splash__subtitle">{props.subtitle}</p> : null}
          {slots.description ? <div class="hk-splash__description">{slots.description?.()}</div> : null}
          <div class="hk-splash__status">
            <HkBadge variant={statusVariant[props.status] || "primary"} size="md">
              {props.statusLabel || props.status}
            </HkBadge>
          </div>
          {slots.actions ? <div class="hk-splash__actions">{slots.actions?.()}</div> : null}
        </main>
        {slots.footer ? <footer class="hk-splash__footer">{slots.footer?.()}</footer> : null}
      </div>
    );
  },
});
