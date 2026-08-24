import { defineComponent, type PropType } from "vue";

/**
 * HkAuthCard — the shared shell of every Celestia auth screen (login,
 * register, setup): centered header (logo/title/subtitle) over a column
 * form body.
 *
 * Slot layout contract:
 * - `footer` renders into `.s-auth-footer`, a flex column sized to its
 *   widest row and centered in the card: every slot child is its own row
 *   (remember-me, protocol consent, a sign-in link…) and the rows share
 *   one left edge. Children must not assume a shared inline line or
 *   per-row centering; content that must sit on one row belongs inside
 *   one child element.
 * - `logo` swaps the header's logo slot; `default` is the form body.
 */
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
      </div>
    );
  },
});
