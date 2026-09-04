import { defineComponent, onBeforeUnmount, watch } from "vue";

import { useI18n } from "../i18n/context";
import "./HkImageLightbox.scss";
import HIconButton from "./HkIconButton";
import HIcon from "./HkIcon";
import HImageViewer from "./HkImageViewer";
import HModal from "./HkModal";
import "./window-close.scss";

/**
 * Immersive fullscreen viewer for a single image — the "special modal"
 * behind HImagePreview's click-to-enlarge. Built entirely from standard
 * components: HModal (with the `contentClass` escape hatch for the
 * immersive layout) hosting an HImageViewer plus a floating close button.
 *
 * HModal is opened with `closable={false}`, so its own ESC / overlay-click
 * guards never close it; the lightbox instead owns a window-level Escape
 * listener for as long as it is open (removed on close/unmount) and emits
 * `update:modelValue(false)` from there and from the close button.
 */
export default defineComponent({
  name: "HkImageLightbox",
  props: {
    src: { type: String, required: true },
    alt: { type: String, default: "" },
    modelValue: { type: Boolean, required: true },
  },
  emits: {
    "update:modelValue": (_value: boolean) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();

    function close() {
      emit("update:modelValue", false);
    }

    function onWindowKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }

    watch(
      () => props.modelValue,
      (open) => {
        if (open) window.addEventListener("keydown", onWindowKeydown);
        else window.removeEventListener("keydown", onWindowKeydown);
      },
      { immediate: true },
    );

    onBeforeUnmount(() => {
      window.removeEventListener("keydown", onWindowKeydown);
    });

    return () => (
      <HModal
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: boolean) => emit("update:modelValue", v)}
        contentClass="hk-image-lightbox"
        // Match the CSS width so the frame's inline max-width does not
        // clamp it to HModal's 32rem default.
        width="min(96vw, 80rem)"
        closable={false}
        // Header-less chrome-only surface: name the dialog layer (popup
        // breadcrumb + aria-label) without rendering a header.
        surfaceTitle={t("hikari::imageLightbox.title", "Image viewer")}
      >
        <div class="hk-image-lightbox-stage">
          <HImageViewer src={props.src} alt={props.alt} />
          <HIconButton
            class="hk-window-close hk-image-lightbox-close"
            size={32}
            variant="ghost"
            aria-label={t("hikari::imageLightbox.close", "Close")}
            onClick={close}
          >
            <HIcon name="close" size={16} />
          </HIconButton>
        </div>
      </HModal>
    );
  },
});
