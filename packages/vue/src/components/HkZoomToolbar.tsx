import { Maximize2, ZoomIn, ZoomOut } from "lucide-vue-next";
import { defineComponent } from "vue";




import HButton from "./HkButton";
import { useI18n } from "../i18n/context";
import "./HkZoomToolbar.scss";

/**
 * Floating zoom control cluster for image/pan viewers. Reflects viewer state
 * via props and forwards intents via events; renders nothing when the view
 * is fully zoomed out (nothing to undo).
 */
export default defineComponent({
  name: "HkZoomToolbar",
  props: {
    zoom: { type: Number, required: true },
    canZoomIn: { type: Boolean, required: true },
    canZoomOut: { type: Boolean, required: true },
    isZoomed: { type: Boolean, required: true },
  },
  emits: {
    zoomIn: () => true,
    zoomOut: () => true,
    reset: () => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    return () => {
      if (!props.isZoomed && !props.canZoomOut) return null;

      return (
        <div class="hk-zoom-toolbar">
          <HButton
            variant="ghost"
            size="sm"
            class="hk-zoom-btn"
            disabled={!props.canZoomOut}
            ariaLabel={t("hikari::zoomToolbar.zoomOut", "Zoom out")}
            onClick={() => emit("zoomOut")}
          >
            <ZoomOut size={14} />
          </HButton>
          <span class="hk-zoom-label">{Math.round(props.zoom * 100)}%</span>
          <HButton
            variant="ghost"
            size="sm"
            class="hk-zoom-btn"
            disabled={!props.canZoomIn}
            ariaLabel={t("hikari::zoomToolbar.zoomIn", "Zoom in")}
            onClick={() => emit("zoomIn")}
          >
            <ZoomIn size={14} />
          </HButton>
          {props.isZoomed && (
            <HButton
              variant="ghost"
              size="sm"
              class={["hk-zoom-btn", "hk-zoom-reset-btn"]}
              ariaLabel={t("hikari::zoomToolbar.reset", "Reset zoom")}
              onClick={() => emit("reset")}
            >
              <Maximize2 size={14} />
            </HButton>
          )}
        </div>
      );
    };
  },
});
