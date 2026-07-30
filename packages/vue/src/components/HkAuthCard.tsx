import { defineComponent } from "vue";

import "./HkAuthCard.scss";

export default defineComponent({
  name: "HkAuthCard",
  props: {
    title: { type: String, required: true },
    subtitle: { type: String, default: "" },
    error: { type: String, default: "" },
  },
  setup(props, { slots }) {
    return () => (
      <div class="hk-auth-card">
        <div class="hk-auth-card-header">
          {slots.logo?.()}
          <h1 class="hk-auth-card-title">{props.title}</h1>
          {props.subtitle && <p class="hk-auth-card-subtitle">{props.subtitle}</p>}
        </div>
        {props.error && (
          <div class="hk-auth-card-error">
            <span class="hk-auth-card-error-icon" aria-hidden="true">!</span>
            <span>{props.error}</span>
          </div>
        )}
        <div class="hk-auth-card-body">
          {slots.default?.()}
        </div>
        {slots.footer && (
          <div class="hk-auth-card-footer">
            {slots.footer()}
          </div>
        )}
      </div>
    );
  },
});
