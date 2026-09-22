/**
 * HkLoadingVeil — a fullscreen semi-transparent blocking overlay for
 * navigation-span loading (the "one tap, no dead window" pattern).
 *
 * While `active`, the veil paints above everything (z-index above the
 * toast band): a dimmed backdrop with backdrop-blur, a centered spinner
 * and a one-line label, and it swallows ALL pointer events — the user
 * cannot double-tap, scroll, or interact with anything beneath. When
 * `active` turns false the veil fades out (150 ms) and pointer events
 * return.
 *
 * Use it when a click must IMMEDIATELY show progress across a lazy
 * boundary (the frontend→backend console jump): the toast band is
 * top-right and non-blocking — callers that need true blocking (one
 * click, fullscreen feedback, zero interaction until ready) mount this
 * instead. It is NOT a modal: no scroll lock, no focus trap, no
 * Esc-close — the caller's flight owns the lifetime.
 */
import { defineComponent } from "vue";
import "./HkLoadingVeil.scss";

export default defineComponent({
  name: "HkLoadingVeil",
  props: {
    /** Paint + block while true; fade out on false. */
    active: { type: Boolean, default: false },
    /** One-line label under the spinner (already-localized by caller). */
    label: { type: String, default: "" },
  },
  setup(props) {
    return () =>
      props.active ? (
        <div class="hk-loading-veil" role="status" aria-live="polite" aria-label={props.label || "loading"}>
          <div class="hk-loading-veil-body">
            <span class="hk-loading-veil-spinner" aria-hidden="true" />
            {props.label ? <p class="hk-loading-veil-label">{props.label}</p> : null}
          </div>
        </div>
      ) : null;
  },
});
