import { defineComponent, ref, type PropType } from "vue";
import HkPopover, { type PopupPlacement } from "./HkPopover";
import HkMenuActionItem from "./HkMenuActionItem";
import { asPropType } from "../utils/typing";
import "./HkAltSignIn.scss";

/** One alternative sign-in entry offered in the popover. */
export interface HkAltSignInEntry {
  key: string;
  label: string;
  icon?: Record<string, unknown>;
  danger?: boolean;
}

/**
 * Shared "alternative sign-in" entry for auth cards (P77).
 *
 * A small muted trigger row (styled in the `.s-auth-footer` grammar) that
 * opens a popover listing third-party/alternative credential entries —
 * platform passkey on shittim-chest, feishu OAuth on easy-hydro-erp — so
 * both apps share one implementation and only differ in content.
 *
 * Entries render as [`HkMenuActionItem`] rows inside an [`HkPopover`]
 * (glass panel, flip/escape/backdrop close, bottom-sheet on mobile), which
 * gives keyboard and pointer handling for free.
 */
export default defineComponent({
  name: "HkAltSignIn",
  props: {
    /** Trigger row text, e.g. "其他方式登录". Consumer-localized on
     *  purpose: hikari ships no dictionary dependency onto hosts here. */
    label: { type: String, required: true },
    /** Alternative sign-in entries offered in the dropdown. */
    entries: {
      type: asPropType<HkAltSignInEntry[]>(Array),
      required: true,
    },
    disabled: { type: Boolean, default: false },
    /** Popover placement around the trigger row. */
    placement: {
      type: String as PropType<PopupPlacement>,
      default: "top",
    } as const,
  },
  emits: {
    /** An entry was chosen; the popover closes automatically. */
    select: (_key: string) => true,
  },
  setup(props, { emit }) {
    const open = ref(false);
    const anchor = ref<HTMLElement | null>(null);

    function choose(key: string): void {
      open.value = false;
      emit("select", key);
    }

    return () => (
      <div class="hk-alt-signin">
        <button
          ref={(el) => (anchor.value = el as HTMLElement | null)}
          type="button"
          class="hk-alt-signin__trigger"
          aria-haspopup="menu"
          aria-expanded={open.value}
          disabled={props.disabled}
          onClick={() => {
            if (!props.disabled) open.value = !open.value;
          }}
        >
          <span class="hk-alt-signin__rule" />
          <span class="hk-alt-signin__label">{props.label}</span>
          <span class="hk-alt-signin__rule" />
        </button>
        <HkPopover
          modelValue={open.value}
          onUpdate:modelValue={(v: boolean) => (open.value = v)}
          placement={props.placement}
          anchorRef={anchor.value}
        >
          <div class="hk-alt-signin__panel" role="menu">
            {props.entries.map((entry) => (
              <HkMenuActionItem
                key={entry.key}
                icon={entry.icon}
                label={entry.label}
                danger={entry.danger === true}
                onClick={() => choose(entry.key)}
              />
            ))}
          </div>
        </HkPopover>
      </div>
    );
  },
});
