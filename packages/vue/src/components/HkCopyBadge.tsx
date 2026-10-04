import { computed, defineComponent, ref, type PropType } from "vue";

import HBadge, { type BadgeVariant } from "./HkBadge";
import HTooltip from "./HkTooltip";
import { useI18n } from "../i18n/context";
import { useClipboardWithToast } from "../runtime/useClipboard";
import { useToast } from "../runtime/useToast";
import "./HkCopyBadge.scss";

/**
 * HkCopyBadge — the house standard for interactive TAGS: a HkBadge that
 * never selects text and instead copies on click.
 *
 * The workspace-wide tag contract (user direction 2026-10-05) is that a
 * label pill is not prose: text selection is always off (that half lives
 * on `.hk-badge` itself), hover shows a "click to copy" tooltip, and a
 * click runs the shared clipboard-with-toast path so every host confirms
 * with the same localized toast. Rendered content is the default copy
 * payload; pass `value` when the meaningful string differs from the
 * label (a `#short` display id backed by a longer id, say).
 *
 * `action` swaps the click behavior outright (open a panel, jump …).
 * That is only legitimate when the tooltip no longer claims "copy" —
 * pass `tooltip` alongside, or the component warns in dev. `disabled`
 * drops the interactivity entirely (no tooltip, no pointer cursor, no
 * button semantics) and renders the plain badge face.
 *
 * A11y: the tag is a real button (role, tab order, Enter/Space), and the
 * click is stopped from reaching clickable ancestors — a tag inside a
 * selectable row copies without selecting the row. The tooltip popup is
 * linked to the badge via aria-describedby (HkTooltip hands the popup id
 * down as a slot prop, so the describedby lands on the actual focus
 * target). Consumer attrs (class/style/data-*) land on the badge element
 * itself, so a call site skinning the pill keeps working; the tooltip
 * wrapper stays clean.
 */
export default defineComponent({
  name: "HkCopyBadge",
  inheritAttrs: false,
  props: {
    /** What a click copies. Default: the rendered text content. */
    value: { type: String, default: undefined },
    /** Tooltip text. Default: the localized "click to copy". */
    tooltip: { type: String, default: undefined },
    /** Swap the click behavior (must come with a custom `tooltip`). */
    action: { type: Function as PropType<() => void>, default: undefined },
    /** Render the inert badge face: no tooltip, no click, no cursor. */
    disabled: { type: Boolean, default: false },
    // ── HkBadge passthrough ──────────────────────────────────────────
    variant: { type: String as PropType<BadgeVariant>, default: "default" },
    dot: { type: Boolean, default: false },
    size: { type: String as PropType<"sm" | "md">, default: "md" },
    mono: { type: Boolean, default: false },
    uppercase: { type: Boolean, default: false },
    pill: { type: Boolean, default: true },
    color: { type: String, default: undefined },
    bgColor: { type: String, default: undefined },
    borderColor: { type: String, default: undefined },
  },
  setup(props, { slots, attrs }) {
    const { t } = useI18n();
    const clipboard = useClipboardWithToast(useToast());

    // The badge root: HkBadge renders a single span, so the instance's
    // $el carries the rendered label — the default copy payload.
    const badgeRef = ref<InstanceType<typeof HBadge> | null>(null);

    const tooltipText = computed(() =>
      props.tooltip ?? t("hikari::clipboard.clickToCopy", "Click to copy"),
    );

    if (import.meta.env?.DEV && props.action && !props.tooltip) {
      console.warn(
        "[HkCopyBadge] `action` replaces the copy behavior — pass `tooltip` " +
        "so the hover hint stops claiming click-to-copy.",
      );
    }

    function copyPayload(): string {
      if (props.value !== undefined) return props.value;
      const el = badgeRef.value?.$el as HTMLElement | undefined;
      return el?.textContent?.trim() ?? "";
    }

    function activate() {
      if (props.disabled) return;
      if (props.action) {
        props.action();
        return;
      }
      const text = copyPayload();
      if (!text) return;
      void clipboard.copy(text);
    }

    return () => {
      // Everything the call site put on HkCopyBadge belongs to the pill
      // itself; only the interactive contract below is ours to add.
      const { class: attrClass, style: attrStyle, ...restAttrs } = attrs;

      const buildBadge = (describedBy?: string) => (
        <HBadge
          ref={badgeRef}
          {...restAttrs}
          class={props.disabled ? attrClass : ["hk-copy-badge", attrClass]}
          style={attrStyle}
          variant={props.variant}
          dot={props.dot}
          size={props.size}
          mono={props.mono}
          uppercase={props.uppercase}
          pill={props.pill}
          color={props.color}
          bgColor={props.bgColor}
          borderColor={props.borderColor}
          aria-describedby={describedBy}
          {...(props.disabled
            ? {}
            : {
                role: "button",
                tabindex: 0,
                onClick: (e: MouseEvent) => {
                  // A tag inside a clickable row/card copies itself
                  // without triggering the row.
                  e.stopPropagation();
                  activate();
                },
                onKeydown: (e: KeyboardEvent) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  e.stopPropagation();
                  activate();
                },
              })}
        >
          {slots.default?.()}
        </HBadge>
      );

      if (props.disabled) return buildBadge();
      return (
        <HTooltip text={tooltipText.value}>
          {(tip: { popupId: string; visible: boolean }) =>
            buildBadge(tip?.visible ? tip.popupId : undefined)}
        </HTooltip>
      );
    };
  },
});
