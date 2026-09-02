import { computed, defineComponent, ref, watch, type PropType } from "vue";

import { useI18n } from "../i18n/context";
import "./HkImagePreview.scss";
import HButton from "./HkButton";
import HSpinner from "./HkSpinner";
import HImageLightbox from "./HkImageLightbox";

export type ImagePreviewObjectFit = "cover" | "contain";

type PreviewStatus = "loading" | "loaded" | "error";

/**
 * Thumbnail-style image preview with built-in loading / error states.
 *
 * Loading shows a skeleton shimmer + spinner; a failed load swaps in a
 * broken-image placeholder with a Retry button (re-mounting the <img>
 * re-requests the URL). When `zoomable`, the whole tile acts as a button
 * (role="button", Enter/Space, zoom-in cursor) that opens the bundled
 * HImageLightbox — chest's theme-wallpaper picker uses this for its
 * left-hand preview column.
 */
export default defineComponent({
  name: "HkImagePreview",
  props: {
    src: { type: String, required: true },
    alt: { type: String, default: "" },
    /** CSS aspect-ratio value shaping the thumbnail (e.g. "16 / 9"). */
    ratio: { type: String, default: "16 / 9" },
    /** Click opens the bundled lightbox. */
    zoomable: { type: Boolean, default: true },
    objectFit: {
      type: String as PropType<ImagePreviewObjectFit>,
      default: "cover",
    },
  },
  emits: {
    open: () => true,
    error: () => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();

    const status = ref<PreviewStatus>("loading");
    const lightboxOpen = ref(false);
    /** Reload key: bumping it re-creates the <img> so a failed URL is
     *  actually re-requested on Retry instead of replaying a cached miss. */
    const attempt = ref(0);

    watch(
      () => props.src,
      () => {
        status.value = "loading";
      },
    );

    function onLoad() {
      status.value = "loaded";
    }

    function onError() {
      status.value = "error";
      emit("error");
    }

    function onRetry() {
      status.value = "loading";
      attempt.value++;
    }

    function openLightbox() {
      if (!props.zoomable || status.value !== "loaded") return;
      lightboxOpen.value = true;
      emit("open");
    }

    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openLightbox();
      }
    }

    const rootClass = computed(() => [
      "hk-image-preview",
      props.zoomable && status.value === "loaded" && "is-zoomable",
    ]);

    return () => {
      const interactive = props.zoomable && status.value === "loaded";

      return (
        <div
          class={rootClass.value}
          style={{ aspectRatio: props.ratio }}
          role={interactive ? "button" : undefined}
          tabindex={interactive ? 0 : undefined}
          aria-label={interactive ? t("hikari::imagePreview.enlarge", "View larger") : undefined}
          onClick={openLightbox}
          onKeydown={onKeydown}
        >
          {status.value !== "error" && (
            <img
              key={`${props.src}#${attempt.value}`}
              src={props.src}
              alt={props.alt}
              class={["hk-image-preview-img", status.value !== "loaded" && "is-pending"].filter(Boolean).join(" ")}
              style={{ objectFit: props.objectFit }}
              draggable={false}
              onLoad={onLoad}
              onError={onError}
            />
          )}
          {status.value === "loading" && (
            <div class="hk-image-preview-loading">
              <HSpinner size="sm" />
            </div>
          )}
          {status.value === "error" && (
            <div class="hk-image-preview-error">
              <svg
                class="hk-image-preview-error-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 15.5 4-4 3.5 3.5" />
                <circle cx="9" cy="9.5" r="1" />
                <path d="m13 19 1.5-3.5-2.5-3 3-3.5L13.5 5" />
              </svg>
              <span class="hk-image-preview-error-text">
                {t("hikari::imagePreview.loadFailed", "Couldn't load image")}
              </span>
              <HButton variant="ghost" size="sm" onClick={onRetry}>
                {t("hikari::imagePreview.retry", "Retry")}
              </HButton>
            </div>
          )}
          {props.zoomable && (
            <HImageLightbox
              src={props.src}
              alt={props.alt}
              modelValue={lightboxOpen.value}
              onUpdate:modelValue={(v: boolean) => { lightboxOpen.value = v; }}
            />
          )}
        </div>
      );
    };
  },
});
