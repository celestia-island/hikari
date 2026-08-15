import { defineComponent, h, type Component, type PropType } from "vue";

import "./HkPageHeader.scss";

/**
 * HkPageHeader — the shared in-page shell header for admin/backend pages.
 *
 * One consistent page anatomy across every sub-page: a big title (with
 * optional icon and subtitle) on the left, and a right-aligned group of
 * common tool buttons in the `actions` slot. Pages own their actions —
 * the top app bar carries identity/navigation only.
 *
 * ```tsx
 * <HPageHeader title={t("admin.channels.title")} subtitle={t("...")}>
 *   {{ actions: () => [<HButton size="sm" onClick={refresh}>…] }}
 * </HPageHeader>
 * ```
 */
export const HkPageHeader = defineComponent({
  name: "HkPageHeader",
  props: {
    title: { type: String, required: true },
    subtitle: { type: String, default: undefined },
    /** Leading icon component (rendered before the title text). */
    icon: { type: Object as PropType<Component>, default: undefined },
    /** Compact variant for dense pages (smaller title, tighter spacing). */
    dense: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () => (
      <div class={["hk-page-header", props.dense && "hk-page-header-dense"]}>
        <div class="hk-page-header-main">
          <h1 class="hk-page-header-title">
            {slots.icon
              ? <span class="hk-page-header-icon">{slots.icon()}</span>
              : props.icon
                ? <span class="hk-page-header-icon">{h(props.icon)}</span>
                : null}
            <span class="hk-page-header-title-text">{props.title}</span>
          </h1>
          {props.subtitle && (
            <p class="hk-page-header-subtitle">{props.subtitle}</p>
          )}
        </div>
        {slots.actions && (
          <div class="hk-page-header-actions">{slots.actions()}</div>
        )}
      </div>
    );
  },
});
