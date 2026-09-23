import { defineComponent } from "vue";

import HkScrollContainer from "./HkScrollContainer";
import "./HkCard.scss";

export default defineComponent({
  name: "HkCard",
  props: {
    title: { type: String, default: undefined },
    hoverable: { type: Boolean, default: false },
    padded: { type: Boolean, default: true },
    /** Turn the card body into the library's standard scroll region
     *  (HkScrollContainer: overlay scrollbar, overflow sensing) instead
     *  of a plain static block. The card becomes a column flex box —
     *  header and footer keep their natural height while the body
     *  fills the rest and scrolls. The card itself needs a height from
     *  its context (grid stretch, an explicit h-* / max-h-* utility, or a flex
     *  parent), exactly like any scroll container: without one there is
     *  nothing to scroll and the body simply fits. Content padding
     *  moves inside the scroll region so the scrollbar hugs the card
     *  edge; `padded: false` drops the inner padding as usual. */
    scrollable: { type: Boolean, default: false },
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
          props.scrollable ? "hk-card-scrollable" : "",
          props.hoverable ? "hk-card-hoverable" : "",
          props.class,
        ]}
        onClick={(e) => emit("click", e)}
      >
        {props.title || slots.header ? (
          <div class="hk-card-header">
            {slots.header ? slots.header() : <h3 class="hk-card-title">{props.title}</h3>}
          </div>
        ) : null}
        <div class={["hk-card-body", !props.padded ? "hk-card-body-unpadded" : ""]}>
          {props.scrollable ? (
            <HkScrollContainer axis="vertical" class="hk-card-body-scroll">
              <div class={props.padded ? "hk-card-body-pad" : undefined}>{slots.default?.()}</div>
            </HkScrollContainer>
          ) : (
            slots.default?.()
          )}
        </div>
        {slots.footer ? <div class="hk-card-footer">{slots.footer()}</div> : null}
      </div>
    );
  },
});
