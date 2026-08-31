import { computed, defineComponent, onBeforeUnmount, ref, watch } from "vue";
import { HMarkdownRenderer, HModal, useClipboard, type ModalAction } from "@celestia-island/hikari";

import { useI18n } from "../i18n/context";
import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";

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
    /** Markdown content to render — protocols always render as markdown. */
    content: { type: String, default: "" },
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

    // ── overlay scrollbar (shared chrome) ─────────────────────────
    // With `bodyHeight` set the body becomes a height-capped scroll
    // region NESTED inside HkModal's overlay-equipped body scroller —
    // without the overlay it would be a surviving native bar (the exact
    // double-scroll this library eliminates). Attach on mount, re-sync
    // when the cap flips, detach on unmount.
    const bodyRef = ref<HTMLElement | null>(null);
    let bodyScrollbar: OverlayScrollbarHandle | null = null;
    function syncBodyScrollbar(): void {
      if (props.bodyHeight && bodyRef.value) {
        if (!bodyScrollbar) bodyScrollbar = attachOverlayScrollbars(bodyRef.value);
      } else {
        bodyScrollbar?.detach();
        bodyScrollbar = null;
      }
    }
    function bindBodyRef(el: unknown): void {
      bodyRef.value = (el as HTMLElement) ?? null;
      syncBodyScrollbar();
    }
    watch(() => props.bodyHeight, () => syncBodyScrollbar());
    onBeforeUnmount(() => {
      bodyScrollbar?.detach();
      bodyScrollbar = null;
    });

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
          ref={bindBodyRef}
          class="s-protocol-modal"
          style={props.bodyHeight ? { maxHeight: props.bodyHeight } : undefined}
        >
          {copied.value && <p class="s-protocol-modal-copied">{t("hikari::protocol.copied", "Copied")}</p>}
          <HMarkdownRenderer content={props.content} />
        </div>
      </HModal>
    );
  },
});
