import { defineComponent } from "vue";

import "./HkEmptyState.scss";

export default defineComponent({
  name: "HkEmptyState",
  props: {
    title: { type: String, required: true },
    description: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    return () => (
      <div class="hk-empty-state">
        <div class="hk-empty-icon">
          {slots.icon ? (
            slots.icon()
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              width="48"
              height="48"
            >
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
            </svg>
          )}
        </div>
        <p class="hk-empty-title">{props.title}</p>
        {props.description ? (
          <p class="hk-empty-desc">{props.description}</p>
        ) : null}
        <div class="hk-empty-action">{slots.action?.()}</div>
      </div>
    );
  },
});
