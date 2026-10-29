import { defineComponent, ref, watch, type PropType } from "vue";

/**
 * HkAvatarButton — the avatar trigger button, ONE component for every
 * face (extracted from HkAdminHeader, shell-unify wave 7, 2026-10-29).
 *
 * The button owns the shared avatar grammar: the `--space-28` round
 * trigger, the image with its graceful letter fallback, and the
 * failed-load latch that resets when the URL changes (an account switch
 * or avatar upload deserves a fresh attempt). HkAdminHeader renders it
 * internally; hosts with their own header chrome (the chat frontend's
 * left wing) render it directly — the geometry has exactly one
 * definition (`.s-admin-header-avatar` in admin-tokens) instead of one
 * per face.
 *
 * Deliberately NO hover veil: every face's trigger opens the user MENU
 * (the avatar edit lives one row down as the Camera item), so a camera
 * overlay would promise click-to-change and lie (user report
 * 2026-09-16).
 *
 * Extra attrs (data-image, testids, …) fall through to the button
 * element (single root, default inheritAttrs) so host CSS keyed on them
 * keeps working.
 */
export const HkAvatarButton = defineComponent({
  name: "HkAvatarButton",
  props: {
    /** Avatar image URL; empty renders the letter fallback. */
    avatarUrl: { type: String, default: "" },
    /** Signed-in name: the fallback letter, and the image's alt. */
    username: { type: String, default: "" },
    /** Accessible label for the trigger (what it opens, not who it is). */
    label: { type: String, default: undefined },
    /** `aria-haspopup` value: "menu" (dropdown) or "dialog" (drawer). */
    popup: { type: String as PropType<"menu" | "dialog" | undefined>, default: undefined },
    /** `aria-expanded`; omit for drawer-mode triggers (no open state). */
    expanded: { type: Boolean, default: undefined },
  },
  emits: {
    click: (_e: MouseEvent) => true,
  },
  setup(props, { emit }) {
    const avatarFailed = ref(false);
    // A new URL deserves a fresh attempt (account switch, avatar upload)
    // — the same self-heal the identity chips apply.
    watch(
      () => props.avatarUrl,
      () => { avatarFailed.value = false; },
    );

    return () => (
      <button
        class="s-admin-header-avatar"
        aria-label={props.label}
        aria-haspopup={props.popup}
        aria-expanded={props.expanded}
        onClick={(e: MouseEvent) => { emit("click", e); }}
      >
        {props.avatarUrl && !avatarFailed.value ? (
          <img
            src={props.avatarUrl}
            alt={props.username}
            class="s-admin-header-avatar-img"
            onError={() => { avatarFailed.value = true; }}
          />
        ) : (
          // Letter fallback on the shared avatar primitive — the same
          // filled-circle grammar on every face (user report 2026-09-12:
          // 前后台头像不一致).
          <span class="s-user-avatar">
            {props.username?.charAt(0).toUpperCase() || "?"}
          </span>
        )}
      </button>
    );
  },
});
