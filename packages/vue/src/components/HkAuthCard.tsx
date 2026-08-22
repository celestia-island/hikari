import { defineComponent, type PropType } from "vue";

export const HkAuthCard = defineComponent({
  name: "HkAuthCard",
  props: {
    title: { type: String, required: true },
    subtitle: { type: String, default: "" },
  },
  setup(props, { slots }) {
    return () => (
      <div class="s-auth-card">
        {slots.logo && (
          <div class="s-auth-header">
            {slots.logo()}
            <h1 class="s-auth-title">{props.title}</h1>
            {props.subtitle && <p class="s-auth-subtitle">{props.subtitle}</p>}
          </div>
        )}
        {!slots.logo && (
          <div class="s-auth-header">
            <h1 class="s-auth-title">{props.title}</h1>
            {props.subtitle && <p class="s-auth-subtitle">{props.subtitle}</p>}
          </div>
        )}
        <div class="s-auth-form">
          {slots.default?.()}
        </div>
        {slots.footer && (
          <div class="s-auth-footer">
            {slots.footer()}
          </div>
        )}
        {slots.below && (
          <div class="s-auth-below">
            {slots.below()}
          </div>
        )}
      </div>
    );
  },
});
