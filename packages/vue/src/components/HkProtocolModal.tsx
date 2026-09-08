import { computed, defineComponent, type PropType } from "vue";
import {
  HMarkdownRenderer,
  HModal,
  useClipboardWithToast,
  useToast,
  type ModalAction,
  type ModalWidth,
} from "@celestia-island/hikari";

import { useI18n } from "../i18n/context";

import "./HkProtocolModal.scss";

/**
 * HkProtocolModal — markdown EULA / privacy / terms modal.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * Renders arbitrary markdown `content` (via HMarkdownRenderer) with
 * a Decline/Accept footer. `accept`/`decline` are the caller's commit
 * actions; closing (overlay click / ESC / X) only emits `update:modelValue`
 * so the caller can decide whether close === decline.
 *
 * ONE SCROLLBAR PER WINDOW: the body grows with its content and the
 * HkModal body scroller is THE scrollbar. The old `bodyHeight` prop
 * (a height-capped scroll region nested inside the modal's own scroller —
 * the exact double-scroll this library eliminates) was removed as dead
 * API: no consumer in the family ever passed it.
 */
export const HkProtocolModal = defineComponent({
  name: "HkProtocolModal",
  props: {
    modelValue: { type: Boolean, default: false },
    /** Modal title (defaults to "Agreement"). */
    title: { type: String, default: undefined },
    /** Markdown content to render — protocols always render as markdown. */
    content: { type: String, default: "" },
    /** Accept button label override. */
    acceptLabel: { type: String, default: undefined },
    /** Decline button label override. */
    declineLabel: { type: String, default: undefined },
    /** Allow dismissing without a decision (overlay/ESC/X). Default true. */
    closable: { type: Boolean, default: true },
    width: { type: String as PropType<ModalWidth>, default: "48rem" },
  },
  emits: {
    "update:modelValue": (_v: boolean) => true,
    accept: () => true,
    decline: () => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const clipboard = useClipboardWithToast(useToast());

    const footerActions = computed<ModalAction[]>(() => [
      {
        label: t("hikari::protocol.copy", "Copy"),
        variant: "secondary" as const,
        onClick: () => void clipboard.copy(props.content),
        disabled: !props.content,
      },
      {
        label: props.declineLabel ?? t("hikari::protocol.decline", "Decline"),
        variant: "secondary" as const,
        onClick: () => emit("decline"),
      },
      {
        label: props.acceptLabel ?? t("hikari::protocol.accept", "Accept"),
        variant: "primary" as const,
        onClick: () => emit("accept"),
        disabled: !props.content,
      },
    ]);

    return () => (
      <HModal
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: boolean) => emit("update:modelValue", v)}
        title={props.title ?? t("hikari::protocol.title", "Agreement")}
        width={props.width}
        closable={props.closable}
        footerActions={footerActions.value}
      >
        <div class="s-protocol-modal">
          <HMarkdownRenderer content={props.content} />
        </div>
      </HModal>
    );
  },
});
