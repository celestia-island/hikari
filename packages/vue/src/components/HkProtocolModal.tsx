import { computed, defineComponent } from "vue";
import { HMarkdownRenderer, HModal, useClipboard, type ModalAction } from "@celestia-island/hikari";

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
 */
export const HkProtocolModal = defineComponent({
  name: "HkProtocolModal",
  props: {
    modelValue: { type: Boolean, default: false },
    /** Modal title (defaults to "Agreement"). */
    title: { type: String, default: undefined },
    /** Markdown content to render (or plain text when `plain`). */
    content: { type: String, default: "" },
    /** Render `content` as escaped plain text instead of markdown. */
    plain: { type: Boolean, default: false },
    /** Accept button label override. */
    acceptLabel: { type: String, default: undefined },
    /** Decline button label override. */
    declineLabel: { type: String, default: undefined },
    /** Allow dismissing without a decision (overlay/ESC/X). Default true. */
    closable: { type: Boolean, default: true },
    width: { type: String, default: "48rem" },
    /** Cap the scroll body height (e.g. "60vh"). */
    bodyHeight: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_v: boolean) => true,
    accept: () => true,
    decline: () => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const clipboard = useClipboard();
    const copied = computed(() => clipboard.copied.value);

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
        <div
          class="s-protocol-modal"
          style={props.bodyHeight ? { maxHeight: props.bodyHeight, overflowY: "auto" } : undefined}
        >
          {copied.value && <p class="s-protocol-modal-copied">{t("hikari::protocol.copied", "Copied")}</p>}
          <HMarkdownRenderer content={props.content} plain={props.plain} />
        </div>
      </HModal>
    );
  },
});
