import { defineComponent, h, type Component, type PropType } from "vue";

import HSpinner from "./HkSpinner";
import "./HkEmptyState.scss";

export default defineComponent({
  name: "HkEmptyState",
  props: {
    /** Heading text. Optional — the loading variant renders without a title. */
    title: { type: String, default: undefined },
    description: { type: String, default: undefined },
    /** Icon component (lucide-vue-next style); rendered via h() at size 32. */
    icon: { type: Object as PropType<Component>, default: undefined },
    /** Loading variant: only a centered spinner, exposed as a status region. */
    loading: { type: Boolean, default: false },
    /** page = bounded, centered card on desktop; fill = stretch to the host. */
    fit: {
      type: String as PropType<"page" | "fill">,
      default: "page",
    },
  },
  setup(props, { slots }) {
    return () => (
      <div
        class={[
          "hk-empty-state",
          props.fit === "fill" ? "hk-empty-state--fill" : "hk-empty-state--page",
          props.loading && "hk-empty-state--loading",
        ]}
        role={props.loading ? "status" : undefined}
        aria-busy={props.loading ? "true" : undefined}
      >
        {props.loading ? (
          <HSpinner center />
        ) : (
          <>
            <div class="hk-empty-icon">
              {slots.icon ? (
                slots.icon()
              ) : props.icon ? (
                h(props.icon, { size: 32, "aria-hidden": true })
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
            {props.title ? <p class="hk-empty-title">{props.title}</p> : null}
            {props.description ? (
              <p class="hk-empty-desc">{props.description}</p>
            ) : null}
          </>
        )}
        {!props.loading && (
          <div class="hk-empty-action">{slots.action?.()}</div>
        )}
      </div>
    );
  },
});
