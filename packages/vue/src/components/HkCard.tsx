import { defineComponent } from "vue";

import "./HkCard.scss";

export default defineComponent({
  name: "HkCard",
  props: {
    title: { type: String, default: undefined },
    hoverable: { type: Boolean, default: false },
    padded: { type: Boolean, default: true },
    class: { type: String, default: "" },
  },
  emits: {
    click: (_e: MouseEvent) => true,
  },
  setup(props, { emit, slots }) {
    return () => (
      <div
        class={[
          "hk-card",
          props.hoverable ? "hk-card--hoverable" : "",
          props.class,
        ]}
        onClick={(e) => emit("click", e)}
      >
        {props.title || slots.header ? (
          <div class="hk-card-header">
            {slots.header ? slots.header() : <h3 class="hk-card-title">{props.title}</h3>}
          </div>
        ) : null}
        <div class={["hk-card-body", !props.padded ? "hk-card-body--unpadded" : ""]}>
          {slots.default?.()}
        </div>
        {slots.footer ? <div class="hk-card-footer">{slots.footer()}</div> : null}
      </div>
    );
  },
});
