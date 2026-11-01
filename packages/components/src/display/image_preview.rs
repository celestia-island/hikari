// hi-components/src/display/image_preview.rs
// ImagePreview — mirror of the canonical Vue `HkImagePreview`: the thumbnail
// tile with built-in loading / error states and a click-to-enlarge affordance.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkImagePreview.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so every `.hk-image-preview*` class name is literal
// and identical in both forms. DOM contract (one-to-one with the Vue render
// output; deltas marked [D]):
//
//   div.hk-image-preview [.is-zoomable] [host class]
//        (style: aspect-ratio; [role=button] [tabindex=0] [aria-label] only
//         while interactive — Vue's guarded spread)
//        (onclick / onkeydown — Enter and Space open)
//     img.hk-image-preview-img [.is-pending]
//          src alt draggable="false" (style: object-fit)
//          (onload, onerror)                        (absent in the error state)
//     div.hk-image-preview-loading?                (status = loading)
//       Spinner(size=sm)
//     div.hk-image-preview-error?                  (status = error)
//       span[style="display:contents"]             [D] error-glyph host
//         svg.hk-image-preview-error-icon          (byte-identical markup)
//       span.hk-image-preview-error-text           (load-failed copy)
//       Button(variant=ghost, size=sm)             (retry)
//
// State home: tairitsu 0.5.22 has no per-instance component state (`use_signal`
// allocates a fresh signal on every render, `use_state` is a single shared hook
// slot — ledger L48), so Vue's `status` ref and its `attempt` reload key are
// CONTROLLED PROPS: the `<img>`'s native load/error events report through
// `on_load` / `on_error`, and the host flips `status`.
//
// The states, taken from Vue line by line:
//   * `loading` (the initial state) renders the shimmer overlay plus the small
//     spinner and hides the real pixels behind `.is-pending`;
//   * `loaded` fades the image in, drops the overlay, and makes the tile a
//     `role="button"` affordance when `zoomable`;
//   * `error` REMOVES the `<img>` entirely (Vue stops rendering it, so no
//     retry of the broken element can leak through) and swaps in the
//     broken-image glyph, the copy and the Retry button.
//
// Deltas vs Vue (documented, not accidental):
//   * [D] NO BUNDLED LIGHTBOX. Vue mounts `HkImageLightbox` itself and owns its
//     `lightboxOpen` ref. A Rust mirror cannot own that state, so the tile
//     reports `on_open` from the same two guarded paths (click and Enter/Space,
//     both gated on `zoomable && status == loaded`) and the host mounts
//     `ImageLightbox` with its own `open`. The tile's own chrome (cursor, role,
//     tabindex, aria-label, focus ring) is unchanged.
//   * [D] RETRY RE-REQUESTS THE URL. Vue bumps its internal `attempt` key,
//     which re-creates the `<img>` element so the browser re-requests the URL
//     instead of replaying the cached miss. tairitsu has no keyed child diffing
//     to force that re-creation, so the mirror takes `attempt` and appends a
//     `hk-retry` query parameter ([`image_preview_attempt_src`]) — the same
//     "actually fetch it again" intent, visible in the DOM. `on_retry` reports
//     the click; the host bumps `attempt` and resets `status` to loading.
//   * [D] THE ERROR GLYPH IS INNER MARKUP. tairitsu creates elements with a
//     plain `createElement(localName)` (no SVG namespace), so an `svg {}` rsx
//     child would never paint; `dangerous_inner_html` suppresses an element's
//     other children, hence the dedicated `display:contents` span. The markup
//     is byte-identical to Vue's and the styled target
//     (`.hk-image-preview-error-icon`) is unchanged.
//   * [D] `src` / `alt` default to empty strings: Vue declares `src` required,
//     but Rust props must be `Default`-constructible.
//   * [D] `ratio` is the raw CSS aspect-ratio value (Vue default `"16 / 9"`); an
//     empty value omits the style attribute, exactly like Vue's
//     `style={{ aspectRatio: "" }}` renders no declaration.
//   * [D] `class` is appended last (Vue merges attribute fallthrough); the root
//     `style` is reserved for `aspect-ratio` — Vue has no style passthrough on
//     this component either.
//
// Replaces nothing: the family had no Rust thumbnail tile (`basic/image.rs`
// keeps the legacy generic `Image` shell, which has no Vue counterpart).

use hikari_i18n::t;

use crate::basic::button::{Button, ButtonSize, ButtonVariant};
use crate::feedback::spinner::{Spinner, SpinnerSize};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct ImagePreviewComponent;

/// Vue's default `ratio` prop.
pub const IMAGE_PREVIEW_DEFAULT_RATIO: &str = "16 / 9";

/// The `objectFit` values Vue declares (`"cover" | "contain"`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum ImagePreviewObjectFit {
    #[default]
    Cover,
    Contain,
}

impl ImagePreviewObjectFit {
    /// The CSS `object-fit` keyword exactly as Vue emits it.
    pub fn as_css(self) -> &'static str {
        match self {
            ImagePreviewObjectFit::Cover => "cover",
            ImagePreviewObjectFit::Contain => "contain",
        }
    }
}

/// Vue's `PreviewStatus` union (`"loading" | "loaded" | "error"`, initial
/// `loading`). Controlled here — see the header's state-home note.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum ImagePreviewStatus {
    #[default]
    Loading,
    Loaded,
    Error,
}

/// The broken-image glyph Vue inlines (lucide `ImageOff`-shaped): byte-for-byte
/// the same markup, mounted through `dangerous_inner_html`.
pub const IMAGE_PREVIEW_ERROR_ICON_SVG: &str = r#"<svg class="hk-image-preview-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 15.5 4-4 3.5 3.5"/><circle cx="9" cy="9.5" r="1"/><path d="m13 19 1.5-3.5-2.5-3 3-3.5L13.5 5"/></svg>"#;

// ── the state kernels (Vue's computeds / guards, made pure) ─────────────

/// Vue's `interactive` guard: the tile is a button only once it is zoomable AND
/// the image is up (`zoomable && status === "loaded"`).
pub fn image_preview_is_interactive(zoomable: bool, status: ImagePreviewStatus) -> bool {
    zoomable && status == ImagePreviewStatus::Loaded
}

/// The root class list: `hk-image-preview`, Vue's `.is-zoomable` marker, then
/// the host class.
pub fn image_preview_classes(zoomable: bool, status: ImagePreviewStatus, class: &str) -> String {
    let mut classes = String::from("hk-image-preview");
    if image_preview_is_interactive(zoomable, status) {
        classes.push_str(" is-zoomable");
    }
    if !class.is_empty() {
        classes.push(' ');
        classes.push_str(class);
    }
    classes
}

/// The `<img>` class list: `.is-pending` until the load lands (Vue's
/// `status !== "loaded"` test).
pub fn image_preview_img_classes(status: ImagePreviewStatus) -> String {
    let mut classes = String::from("hk-image-preview-img");
    if status != ImagePreviewStatus::Loaded {
        classes.push_str(" is-pending");
    }
    classes
}

/// Vue renders the `<img>` unless the load failed (`status !== "error"`).
pub fn image_preview_image_visible(status: ImagePreviewStatus) -> bool {
    status != ImagePreviewStatus::Error
}

/// The two keys Vue's `onKeydown` accepts (the native button activation pair).
pub fn image_preview_key_opens(key: &str) -> bool {
    key == "Enter" || key == " "
}

/// The root `style` attribute for the `ratio` prop. Vue spreads
/// `aspectRatio: props.ratio` into a style object, so an empty value renders no
/// declaration at all — mirrored by omitting the attribute.
pub fn image_preview_ratio_style(ratio: &str) -> Option<String> {
    if ratio.trim().is_empty() {
        None
    } else {
        Some(format!("aspect-ratio:{ratio}"))
    }
}

/// The URL the tile actually requests ([D] retry channel). The first attempt
/// uses `src` verbatim; later attempts append a `hk-retry` query parameter so
/// the browser really re-fetches. Opaque URLs (`data:`, `blob:`, bare `#`
/// fragments) cannot carry a query and are returned untouched.
pub fn image_preview_attempt_src(src: &str, attempt: u32) -> String {
    if attempt == 0
        || src.is_empty()
        || src.starts_with("data:")
        || src.starts_with("blob:")
        || src.starts_with('#')
    {
        return src.to_string();
    }
    let separator = if src.contains('?') { '&' } else { '?' };
    format!("{src}{separator}hk-retry={attempt}")
}

#[define_props]
pub struct ImagePreviewProps {
    /// Image URL (Vue: `src`, required there; empty string = unset).
    #[default]
    pub src: String,

    /// Alternate text (Vue default `""`).
    #[default]
    pub alt: String,

    /// CSS aspect-ratio value shaping the tile (Vue default `"16 / 9"`).
    #[default(IMAGE_PREVIEW_DEFAULT_RATIO.to_string())]
    pub ratio: String,

    /// Click / Enter / Space open the enlarge affordance (Vue default true).
    #[default(true)]
    pub zoomable: bool,

    /// `object-fit` for the thumbnail (Vue default `cover`).
    #[default]
    pub object_fit: ImagePreviewObjectFit,

    /// Load state (Vue's internal `status` ref; controlled here).
    #[default]
    pub status: ImagePreviewStatus,

    /// Retry counter ([D] reload channel): 0 requests `src` verbatim, later
    /// values append a `hk-retry` query parameter.
    #[default]
    pub attempt: u32,

    /// Host class appended after the `.hk-image-preview*` family.
    #[default]
    pub class: String,

    /// The image finished loading (the host flips `status` to loaded).
    pub on_load: Option<EventHandler<()>>,

    /// The image failed (the host flips `status` to error).
    pub on_error: Option<EventHandler<()>>,

    /// Retry pressed (the host resets `status` and bumps `attempt`).
    pub on_retry: Option<EventHandler<()>>,

    /// The tile asked to enlarge (Vue's `open` emit; the host mounts the
    /// lightbox — see the header's [D]).
    pub on_open: Option<EventHandler<()>>,
}

#[component]
pub fn ImagePreview(props: ImagePreviewProps) -> Element {
    let interactive = image_preview_is_interactive(props.zoomable, props.status);
    let status = props.status;
    let classes = image_preview_classes(props.zoomable, status, &props.class);
    let ratio_style = image_preview_ratio_style(&props.ratio);
    let img_src = image_preview_attempt_src(&props.src, props.attempt);
    let img_classes = image_preview_img_classes(status);
    let img_style = format!("object-fit:{}", props.object_fit.as_css());
    let show_image = image_preview_image_visible(status);
    let is_loading = status == ImagePreviewStatus::Loading;
    let is_error = status == ImagePreviewStatus::Error;

    // Vue's guarded spread: the button affordance exists only while
    // interactive, so a false `zoomable` leaves no role/tabindex/name behind.
    let role = interactive.then_some("button");
    let tabindex = interactive.then(|| "0".to_string());
    let aria_label = interactive.then(|| t("components.hk.imagePreview.enlarge", "View larger"));

    let error_text = t(
        "components.hk.imagePreview.loadFailed",
        "Couldn't load image",
    );
    let retry_label = t("components.hk.imagePreview.retry", "Retry");

    let zoomable = props.zoomable;
    let on_load = props.on_load.clone();
    let on_error = props.on_error.clone();
    let on_retry = props.on_retry.clone();
    let on_open_click = props.on_open.clone();
    let on_open_key = props.on_open.clone();

    rsx! {
        div {
            class: classes,
            style: ratio_style,
            "role": role,
            tabindex: tabindex,
            "aria-label": aria_label,
            onclick: move |_| {
                if image_preview_is_interactive(zoomable, status)
                    && let Some(handler) = on_open_click.as_ref()
                {
                    handler.call(());
                }
            },
            // Vue's `onKeydown`: Enter/Space always `preventDefault()` first,
            // then the same guarded open.
            onkeydown: move |event: KeyboardEvent| {
                if image_preview_key_opens(&event.key) {
                    event.prevent_default();
                    if image_preview_is_interactive(zoomable, status)
                        && let Some(handler) = on_open_key.as_ref()
                    {
                        handler.call(());
                    }
                }
            },
            if show_image {
                img {
                    class: img_classes,
                    src: img_src,
                    alt: props.alt.clone(),
                    style: img_style,
                    "draggable": "false",
                    onload: move |_| {
                        if let Some(handler) = on_load.as_ref() {
                            handler.call(());
                        }
                    },
                    onerror: move |_| {
                        if let Some(handler) = on_error.as_ref() {
                            handler.call(());
                        }
                    },
                }
            }
            if is_loading {
                div {
                    class: "hk-image-preview-loading",
                    Spinner { size: SpinnerSize::Sm }
                }
            }
            if is_error {
                div {
                    class: "hk-image-preview-error",
                    span {
                        style: "display:contents",
                        dangerous_inner_html: IMAGE_PREVIEW_ERROR_ICON_SVG,
                    }
                    span {
                        class: "hk-image-preview-error-text",
                        "{error_text}"
                    }
                    Button {
                        variant: ButtonVariant::Ghost,
                        size: ButtonSize::Sm,
                        children: VNode::Text(VText::new(&retry_label)),
                        onclick: Some(EventHandler::new(move |_: MouseEvent| {
                            if let Some(handler) = on_retry.as_ref() {
                                handler.call(());
                            }
                        })),
                    }
                }
            }
        }
    }
}

impl StyledComponent for ImagePreviewComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkImagePreview.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "image-preview"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preview_defaults_match_the_vue_props() {
        let props = ImagePreviewProps::default();
        assert_eq!(props.src, "");
        assert_eq!(props.alt, "");
        assert_eq!(props.ratio, "16 / 9");
        assert!(props.zoomable);
        assert_eq!(props.object_fit, ImagePreviewObjectFit::Cover);
        // Vue's initial `status` is "loading".
        assert_eq!(props.status, ImagePreviewStatus::Loading);
        assert_eq!(props.attempt, 0);
        assert_eq!(props.class, "");
        assert!(props.on_load.is_none());
        assert!(props.on_error.is_none());
        assert!(props.on_retry.is_none());
        assert!(props.on_open.is_none());
    }

    #[test]
    fn preview_classes_track_the_state_and_host_class() {
        // The Button affordance rides the loaded state only.
        assert!(!image_preview_is_interactive(
            true,
            ImagePreviewStatus::Loading
        ));
        assert!(image_preview_is_interactive(
            true,
            ImagePreviewStatus::Loaded
        ));
        assert!(!image_preview_is_interactive(
            true,
            ImagePreviewStatus::Error
        ));
        assert!(!image_preview_is_interactive(
            false,
            ImagePreviewStatus::Loaded
        ));

        assert_eq!(
            image_preview_classes(true, ImagePreviewStatus::Loading, ""),
            "hk-image-preview"
        );
        assert_eq!(
            image_preview_classes(true, ImagePreviewStatus::Loaded, ""),
            "hk-image-preview is-zoomable"
        );
        assert_eq!(
            image_preview_classes(true, ImagePreviewStatus::Error, ""),
            "hk-image-preview"
        );
        assert_eq!(
            image_preview_classes(true, ImagePreviewStatus::Loaded, "hk-theme-wallpaper"),
            "hk-image-preview is-zoomable hk-theme-wallpaper"
        );
        assert_eq!(
            image_preview_classes(false, ImagePreviewStatus::Loaded, ""),
            "hk-image-preview"
        );

        // `.is-pending` is Vue's `status !== "loaded"` test.
        assert_eq!(
            image_preview_img_classes(ImagePreviewStatus::Loading),
            "hk-image-preview-img is-pending"
        );
        assert_eq!(
            image_preview_img_classes(ImagePreviewStatus::Error),
            "hk-image-preview-img is-pending"
        );
        assert_eq!(
            image_preview_img_classes(ImagePreviewStatus::Loaded),
            "hk-image-preview-img"
        );

        // The error state stops rendering the broken <img>.
        assert!(image_preview_image_visible(ImagePreviewStatus::Loading));
        assert!(image_preview_image_visible(ImagePreviewStatus::Loaded));
        assert!(!image_preview_image_visible(ImagePreviewStatus::Error));

        // object-fit keywords and the native activation keys.
        assert_eq!(ImagePreviewObjectFit::Cover.as_css(), "cover");
        assert_eq!(ImagePreviewObjectFit::Contain.as_css(), "contain");
        assert!(image_preview_key_opens("Enter"));
        assert!(image_preview_key_opens(" "));
        assert!(!image_preview_key_opens("Escape"));
        assert!(!image_preview_key_opens("enter"));
    }

    #[test]
    fn preview_ratio_style_omits_an_empty_ratio() {
        assert_eq!(
            image_preview_ratio_style("16 / 9"),
            Some("aspect-ratio:16 / 9".to_string())
        );
        assert_eq!(
            image_preview_ratio_style("1 / 1"),
            Some("aspect-ratio:1 / 1".to_string())
        );
        assert_eq!(image_preview_ratio_style(""), None);
        assert_eq!(image_preview_ratio_style("  "), None);
    }

    #[test]
    fn preview_retry_url_only_busts_later_attempts() {
        // Attempt 0 requests the URL verbatim.
        assert_eq!(
            image_preview_attempt_src("/wallpaper.svg", 0),
            "/wallpaper.svg"
        );
        // Later attempts append (or extend) the query.
        assert_eq!(
            image_preview_attempt_src("/wallpaper.svg", 2),
            "/wallpaper.svg?hk-retry=2"
        );
        assert_eq!(
            image_preview_attempt_src("/wallpaper.svg?v=3", 1),
            "/wallpaper.svg?v=3&hk-retry=1"
        );
        // Opaque URLs keep working (a query would corrupt them).
        assert_eq!(
            image_preview_attempt_src("data:image/png;base64,AA", 4),
            "data:image/png;base64,AA"
        );
        assert_eq!(image_preview_attempt_src("blob:abc", 4), "blob:abc");
        assert_eq!(image_preview_attempt_src("#cell", 4), "#cell");
        assert_eq!(image_preview_attempt_src("", 4), "");
    }

    #[test]
    fn preview_render_carries_the_loading_state_and_button_gate() {
        // Initial state: shimmer + spinner, pending pixels, no button role.
        let html = ImagePreview(ImagePreviewProps {
            src: "/wallpaper.svg".to_string(),
            alt: "wallpaper".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-image-preview-loading"), "{html}");
        assert!(html.contains("hk-image-preview-img is-pending"), "{html}");
        assert!(html.contains(r#"style="aspect-ratio:16 / 9""#), "{html}");
        assert!(html.contains("object-fit:cover"), "{html}");
        assert!(html.contains(r#"draggable="false""#), "{html}");
        assert!(!html.contains("role=\"button\""), "{html}");
        assert!(!html.contains("tabindex"), "{html}");
        assert!(!html.contains("is-zoomable"), "{html}");

        // Loaded + zoomable: the button affordance appears, the spinner is
        // gone, and a retry attempt re-requests a cache-busted URL.
        let html = ImagePreview(ImagePreviewProps {
            src: "/wallpaper.svg".to_string(),
            alt: "wallpaper".to_string(),
            status: ImagePreviewStatus::Loaded,
            attempt: 1,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-image-preview is-zoomable"), "{html}");
        assert!(html.contains(r#"role="button""#), "{html}");
        assert!(html.contains(r#"tabindex="0""#), "{html}");
        assert!(html.contains(r#"aria-label="View larger""#), "{html}");
        assert!(html.contains(r#"class="hk-image-preview-img""#), "{html}");
        assert!(
            html.contains(r#"src="/wallpaper.svg?hk-retry=1""#),
            "the retry attempt must re-request the URL: {html}"
        );
        assert!(!html.contains("hk-image-preview-loading"), "{html}");

        // A failed load removes the <img> and swaps in the placeholder.
        let html = ImagePreview(ImagePreviewProps {
            src: "/wallpaper.svg".to_string(),
            alt: "wallpaper".to_string(),
            status: ImagePreviewStatus::Error,
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("hk-image-preview-img"), "{html}");
        assert!(html.contains("hk-image-preview-error"), "{html}");
        assert!(html.contains("hk-image-preview-error-icon"), "{html}");
        assert!(html.contains("Couldn't load image"), "{html}");
        assert!(html.contains("Retry"), "{html}");
        assert!(!html.contains("is-zoomable"), "{html}");
    }

    #[test]
    fn preview_styles_come_from_the_canonical_vue_sheet() {
        let css = ImagePreviewComponent::styles();
        assert!(
            css.contains(".hk-image-preview")
                && css.contains(".hk-image-preview-error")
                && css.contains(".hk-image-preview-loading"),
            "image preview css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored image preview sheet"
        );
    }
}
