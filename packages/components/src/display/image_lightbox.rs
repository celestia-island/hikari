// hi-components/src/display/image_lightbox.rs
// ImageLightbox — mirror of the canonical Vue `HkImageLightbox`: the immersive
// fullscreen viewer behind `HkImagePreview`'s click-to-enlarge.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkImageLightbox.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the lightbox's own names are literal and identical
// in both forms. The sheet is a set of IMMERSIVE OVERRIDES on the shared modal
// frame, so the mirror is built the way Vue builds it — standard components, not
// a bespoke dialog:
//
//   Modal(open, closable=false, width="min(96vw, 80rem)",
//         content_class="hk-image-lightbox", surface_title=t("title"))
//     div.hk-modal-content.hk-image-lightbox        (the immersive frame)
//       div.hk-modal-overlay                        (inert: closable=false)
//       div.hk-modal-body
//         div.hk-modal-body-scroll.hk-scroll-pin-host
//           div.hk-modal-body-inner
//             div.hk-image-lightbox-stage
//               ImageViewer({…`viewer`, src, alt})
//               IconButton(size=32, variant=ghost,
//                          class="hk-window-close hk-image-lightbox-close",
//                          aria-label=t("close"))
//                 Icon(close, 16)
//
// The frame is a fixed-size stage: the modal's body chain is flattened to pure
// flex by the sheet so the viewer fills it, and the floating close chip rides
// on top of the stage (its ink comes from HkIconButton's `--hi-icon-button-*`
// layer and the shared `.hk-window-close` chrome, exactly like Vue's separate
// sheet imports — the lightbox's own table carries only the overrides).
//
// State home: tairitsu 0.5.22 has no per-instance component state (`use_signal`
// allocates a fresh signal on every render, `use_state` is a single shared hook
// slot — ledger L48), so `open` is a CONTROLLED PROP and closing reports through
// `on_close`; the host owns the boolean, exactly like Vue's `modelValue` /
// `update:modelValue` pair.
//
// Deltas vs Vue (documented, not accidental):
//   * [D] ESCAPE IS HOST-OWNED. Vue registers a window-level `keydown` listener
//     for as long as it is open (its modal is `closable={false}`, so the modal's
//     own ESC / overlay-click guards stay inert). The Rust platform layer
//     exposes element-scoped listeners only — no window keydown registration —
//     and tairitsu 0.5.22 has no unmount hook to retract one, so the mirror
//     deliberately does not install a page-global listener; the host closes on
//     Escape from its own surface. `on_close` carries the ✕ button.
//   * [D] OVERLAY CLICK IS INERT, like Vue: the modal is opened with
//     `closable=false`, so neither the mask nor the frame's own ESC handler
//     closes the lightbox.
//   * [D] THE VIEWER IS A NESTED PROPS STRUCT. Vue hard-codes
//     `<HImageViewer src alt />` and lets it own its camera. The Rust viewer is
//     a controlled mirror — camera, load flags, drag flag and the gesture
//     pass-throughs are all props (see `display/image_viewer.rs`) — so the
//     lightbox carries an `ImageViewerProps` and mounts that viewer with its own
//     `src`/`alt` injected (the lightbox's `src`/`alt` WIN over the nested
//     ones). A host driving the camera therefore writes
//     `viewer: ImageViewerProps { loading: false, scale: Some(1.5), … }`
//     instead of composing a separate vnode, and the lightbox's own prop surface
//     stays Vue's three.
//   * [D] NO `class` PASSTHROUGH. The immersive chrome class has to ride the
//     modal frame (`hk-image-lightbox` + `.hk-modal-content`), which Vue also
//     hard-codes, so there is no host class seam here — use the nested `viewer`
//     props or the sheet's own variables instead.
//   * [D] `src` defaults to the empty string: Vue declares it required, but Rust
//     props must be `Default`-constructible. `alt` keeps Vue's `""` default.
//   * The accessible name is Vue's `surfaceTitle` (`"Image viewer"`), carried on
//     the dialog's `aria-label` by the Modal mirror; a header-less surface
//     renders no title row, which is exactly Vue's immersive layout.
//
// Replaces nothing: the family had no Rust lightbox (the legacy imperative
// modal chain retired with the feedback wave).

use hikari_i18n::t;
use hikari_icons::{Icon, MdiIcon};

use crate::basic::icon_button::{IconButton, IconButtonSize, IconButtonVariant};
use crate::feedback::modal::Modal;
use crate::prelude::*;
use crate::styled::StyledComponent;

use super::image_viewer::{ImageViewer, ImageViewerProps};

pub struct ImageLightboxComponent;

/// The immersive frame class Vue passes through HModal's `contentClass`
/// escape hatch (the sheet doubles it with `.hk-modal-content` to win the
/// cascade).
pub const IMAGE_LIGHTBOX_CONTENT_CLASS: &str = "hk-image-lightbox";

/// The stage that hosts the viewer and the floating close chip.
pub const IMAGE_LIGHTBOX_STAGE_CLASS: &str = "hk-image-lightbox-stage";

/// The close chip's classes: the shared `.hk-window-close` chrome plus the
/// lightbox's own ink/placement.
pub const IMAGE_LIGHTBOX_CLOSE_CLASS: &str = "hk-window-close hk-image-lightbox-close";

/// The frame width Vue passes to HModal (its inline `max-width` then gets the
/// shared viewport-gutter cap from the Modal mirror, exactly like Vue's).
pub const IMAGE_LIGHTBOX_FRAME_WIDTH: &str = "min(96vw, 80rem)";

/// The close glyph's box in px (Vue: `<HIcon name="close" size={16} />`).
pub const IMAGE_LIGHTBOX_CLOSE_GLYPH_PX: u32 = 16;

/// Vue's i18n fallback for the dialog's accessible name.
pub const IMAGE_LIGHTBOX_TITLE: &str = "Image viewer";

/// Vue's i18n fallback for the close chip's label.
pub const IMAGE_LIGHTBOX_CLOSE_LABEL: &str = "Close";

#[define_props]
pub struct ImageLightboxProps {
    /// Image URL (Vue: `src`, required there; empty string = unset).
    #[default]
    pub src: String,

    /// Alternate text (Vue default `""`).
    #[default]
    pub alt: String,

    /// Controlled open state (Vue: `modelValue`).
    #[default]
    pub open: bool,

    /// The bundled viewer's props (camera, load flags, gesture pass-throughs).
    /// `src` / `alt` are overwritten with this component's own, so the lightbox
    /// stays the single image source. Defaults to Vue's pre-load state
    /// (`loading: true`, resting fit camera).
    pub viewer: ImageViewerProps,

    /// The user asked to close (✕). The host owns `open` and must flip it.
    pub on_close: Option<EventHandler<()>>,
}

#[component]
pub fn ImageLightbox(props: ImageLightboxProps) -> Element {
    if !props.open {
        return empty_vnode();
    }

    let title = t("components.hk.imageLightbox.title", IMAGE_LIGHTBOX_TITLE);
    let close_label = t(
        "components.hk.imageLightbox.close",
        IMAGE_LIGHTBOX_CLOSE_LABEL,
    );

    // Vue hard-codes `<HImageViewer src alt />`; the mirror mounts the same
    // viewer with the lightbox's image injected over the nested props.
    let mut viewer_props = props.viewer.clone();
    viewer_props.src = props.src.clone();
    viewer_props.alt = props.alt.clone();
    let viewer = ImageViewer(viewer_props);

    let on_close = props.on_close.clone();

    rsx! {
        Modal {
            open: true,
            closable: false,
            width: IMAGE_LIGHTBOX_FRAME_WIDTH.to_string(),
            content_class: IMAGE_LIGHTBOX_CONTENT_CLASS.to_string(),
            surface_title: Some(title),
            children: rsx! {
                div {
                    class: IMAGE_LIGHTBOX_STAGE_CLASS,
                    {viewer}
                    IconButton {
                        size: IconButtonSize::S32,
                        variant: IconButtonVariant::Ghost,
                        aria_label: Some(close_label),
                        class: IMAGE_LIGHTBOX_CLOSE_CLASS.to_string(),
                        children: rsx! {
                            Icon {
                                icon: MdiIcon::Close,
                                size: IMAGE_LIGHTBOX_CLOSE_GLYPH_PX,
                            }
                        },
                        onclick: Some(EventHandler::new(move |_: MouseEvent| {
                            if let Some(handler) = on_close.as_ref() {
                                handler.call(());
                            }
                        })),
                    }
                }
            },
        }
    }
}

impl StyledComponent for ImageLightboxComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkImageLightbox.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "image-lightbox"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lightbox_defaults_match_the_vue_props() {
        let props = ImageLightboxProps::default();
        assert_eq!(props.src, "");
        assert_eq!(props.alt, "");
        // Vue's `modelValue` is required and the surface mounts closed here.
        assert!(!props.open);
        // The bundled viewer starts in Vue's pre-load state.
        assert!(props.viewer.loading);
        assert!(props.viewer.scale.is_none());
        assert_eq!(props.viewer.src, "");
        assert!(props.on_close.is_none());
    }

    #[test]
    fn lightbox_class_names_match_the_vue_sheet() {
        // Vue: contentClass="hk-image-lightbox" + the stage/close classes the
        // sheet targets (the close chip keeps BOTH the shared window-close
        // chrome and the lightbox's own ink class).
        assert_eq!(IMAGE_LIGHTBOX_CONTENT_CLASS, "hk-image-lightbox");
        assert_eq!(IMAGE_LIGHTBOX_STAGE_CLASS, "hk-image-lightbox-stage");
        assert_eq!(
            IMAGE_LIGHTBOX_CLOSE_CLASS,
            "hk-window-close hk-image-lightbox-close"
        );
        // The sheet really targets those names (a rename would desync here).
        let css = ImageLightboxComponent::styles();
        assert!(css.contains(".hk-image-lightbox-stage"));
        assert!(css.contains(".hk-image-lightbox-close.hk-icon-button"));
        assert!(css.contains(".hk-modal-content.hk-image-lightbox"));
    }

    #[test]
    fn lightbox_render_contract() {
        // Open: the immersive modal frame, the stage, the bundled viewer and
        // the floating close chip — and no header ✕ (closable=false).
        let html = ImageLightbox(ImageLightboxProps {
            src: "/wallpaper.svg".to_string(),
            alt: "wallpaper".to_string(),
            open: true,
            viewer: ImageViewerProps {
                loading: false,
                ..Default::default()
            },
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.contains(r#"class="hk-modal-content hk-image-lightbox""#),
            "the immersive frame class must ride the modal content: {html}"
        );
        assert!(html.contains(r#"role="dialog""#), "{html}");
        assert!(html.contains(r#"aria-modal="true""#), "{html}");
        assert!(html.contains(r#"aria-label="Image viewer""#), "{html}");
        assert!(
            html.contains("min(96vw, 80rem)"),
            "the frame must carry Vue's width: {html}"
        );
        assert!(html.contains("hk-image-lightbox-stage"), "{html}");
        assert!(html.contains("hk-image-viewer"), "{html}");
        assert!(html.contains("/wallpaper.svg"), "{html}");
        assert!(
            html.contains("hk-window-close hk-image-lightbox-close"),
            "the close chip must carry both chrome classes: {html}"
        );
        assert!(html.contains(r#"aria-label="Close""#), "{html}");
        // The glyph rides the icon-button box at Vue's 16px size.
        assert!(html.contains("hk-icon-button-icon"), "{html}");
        assert!(html.contains("width:16px;height:16px"), "{html}");
        assert!(
            !html.contains("hk-modal-close"),
            "a closable=false modal must not render the header ✕: {html}"
        );
        // `loading: false` reaches the bundled viewer (no spinner).
        assert!(!html.contains("hk-image-viewer-loading"), "{html}");

        // Default loading: the bundled viewer still shows its spinner.
        let html = ImageLightbox(ImageLightboxProps {
            src: "/wallpaper.svg".to_string(),
            open: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-image-viewer-loading"), "{html}");
    }

    #[test]
    fn lightbox_closed_renders_nothing() {
        // Vue's modal keeps the surface unmounted while closed; the mirror
        // returns an empty vnode (never an empty rsx block).
        let html = ImageLightbox(ImageLightboxProps::default()).render_to_html();
        assert!(html.is_empty(), "a closed lightbox renders nothing: {html}");
    }

    #[test]
    fn lightbox_forwards_the_nested_viewer_camera() {
        // The host's viewer props reach the bundled viewer; the lightbox's own
        // `src`/`alt` win over the nested ones (single image source).
        let html = ImageLightbox(ImageLightboxProps {
            src: "/wallpaper.svg".to_string(),
            alt: "wallpaper".to_string(),
            open: true,
            viewer: ImageViewerProps {
                src: "/stale.svg".to_string(),
                loading: false,
                scale: Some(2.0),
                content_width: 800.0,
                content_height: 600.0,
                viewport_width: 400.0,
                viewport_height: 300.0,
                ..Default::default()
            },
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("/wallpaper.svg"), "{html}");
        assert!(
            !html.contains("/stale.svg"),
            "the lightbox src must win over the nested viewer src: {html}"
        );
        assert!(html.contains("scale(2)"), "{html}");
        assert!(html.contains("cursor:grab"), "{html}");
    }

    #[test]
    fn lightbox_styles_come_from_the_canonical_vue_sheet() {
        let css = ImageLightboxComponent::styles();
        assert!(
            css.contains(".hk-image-lightbox-stage") && css.contains(".hk-image-lightbox-close"),
            "lightbox css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored lightbox sheet"
        );
    }
}
