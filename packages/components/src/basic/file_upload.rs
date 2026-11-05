// packages/components/src/basic/file_upload.rs
// FileUpload component — the dashed drop box around a transparent native
// `<input type="file">`.
//
// L88 DELTA: THE OS-FILE DROP PATH IS REMOVED ON wasm32-wasip2, DELIBERATELY.
// The zone used to bind `dragover` / `dragleave` / `drop` with `DragEvent`
// handlers. At the time of the removal (tairitsu ≤0.5.23) the browser glue
// type-dispatched only the mouse family (plus keyboard / focus / input+change)
// and routed every `drag*` event through `onGenericEvent`; the host side
// (`packages/web/src/wit_platform.rs`) turns that into a `GenericEvent`
// carrying the type string and a live handle but NO data, so the `DragEvent`
// downcast never matches and those typed handlers never ran (ledger L88).
// Tairitsu 0.5.24 typed the pointer family, but `drag*` is still data-less —
// this removal stands.
//
// TO BE PRECISE ABOUT WHAT WAS AND WAS NOT PRESERVABLE: the EVENT still arrives,
// so the VISUAL half was preservable as a data-less generic register —
// `.on_event("dragover", |_: Box<dyn EventData>| set(FileUploadStatus::Dragging))`
// would light the zone today, exactly the "edge fires, payload missing" reasoning
// that keeps the `pointercancel` registers in `basic/color_picker.rs` and
// `scene/board.rs`. It is removed anyway, for three reasons:
//   1. a highlight that invites a drop which cannot be honoured is a half-feature
//      — it advertises an affordance the component cannot satisfy;
//   2. ACCEPTING the drop would need `preventDefault` on `dragover` (a browser
//      only reports `drop` for a zone that cancels the drag default), and then
//      `drop`'s own default — navigating to the dropped file — would have to be
//      swallowed too, so the user's file would be silently discarded. That is
//      worse than the browser default;
//   3. the part that MATTERS is genuinely unpreservable: only
//      `DataTransfer.files` can name the dropped files, and the generic channel
//      carries no `DataTransfer`, so an `on_files` report could never be built.
// What that leaves (this is the same grammar as a plain HTML file input):
//   * picking files still works — the native `input`'s `change` event is a typed
//     channel (tairitsu 0.5.25) and it carries the committed value since 0.5.26.
//     That value is the input's `value` property, i.e. the browser's FAKE PATH
//     (`C:\fakepath\a.png`), and for a `multiple` input only the FIRST picked
//     file's name (the spec makes `value` one string, never a list). The handler
//     therefore reduces the value to a leaf name through
//     `basic/file_field`'s `picked_files_from_change_value` and never reports a
//     path a host cannot open.
//     The full `FileList` is NOT unreachable upstream: the glue implements
//     `getFiles` (it returns the live FileList handle) and the WIT
//     `html-input-element.get-files` member exists. The missing link is on the
//     Rust side — `tairitsu-vdom`'s `ChangeEvent` exposes `value` and an opaque
//     `target` handle but no FileList accessor, so a handler cannot read it yet.
//     Until it does, a multi pick reports one leaf name;
//   * `FileUploadStatus::Dragging` and the `.hk-file-upload-dragging` sheet rule
//     are UNREACHABLE (the enum variant and the CSS stay: public/stylesheet
//     surface, not behaviour);
//   * `upload_text`'s default still says "Click or drag file to upload". That
//     string lives in THIS crate (`FileUploadProps::upload_text`, the `#[default]`
//     below), not in the Vue library — there is no such Vue canonical string, so
//     it is this file's own copy to change and is left alone here.
// Reinstating the drop path requires the upstream tairitsu glue to type the
// `drag*` family (or expose the `DataTransfer` behind the event handle); when it
// does, restore the three handlers and point them back at `ondrag*`.

use hikari_palette::classes::{ClassesBuilder, FileUploadClass};

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct FileUploadComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum FileUploadStatus {
    #[default]
    Idle,
    Dragging,
    Uploading,
    Success,
    Error,
}

#[define_props]
pub struct FileUploadProps {
    #[default(false)]
    pub multiple: bool,

    #[default]
    pub accept: String,

    #[default(10485760)] // 10MB default
    pub max_size: usize,

    #[default(true)]
    pub show_preview: bool,

    #[default("Click or drag file to upload".to_string())]
    pub upload_text: String,

    #[default]
    pub class: String,

    #[default]
    pub style: String,

    /// Fires with the picked file's leaf name(s) — the path is stripped, and on
    /// this wire the vec holds AT MOST ONE entry: a `change` event carries the
    /// input's `value` (one fake path, the first file for a `multiple` input),
    /// not its `FileList`. A cleared / cancelled picker emits nothing.
    #[default]
    pub on_files: Option<EventHandler<Vec<String>>>,

    #[default]
    pub on_error: Option<EventHandler<String>>,
}

/// The leaf name of a file pick, recovered from the `change` value.
///
/// tairitsu 0.5.26 fills `ChangeEvent.value` from the target's `value`
/// property through the `html-input-element` getter — never from its
/// `FileList`: the event has no FileList accessor (`target` is an opaque
/// handle), so the glue's live `getFiles` is out of reach from a handler. What
/// arrives is the browser's fake path (`C:\fakepath\a.png`, or a bare name on
/// engines that do not fake it), and one path even for a `multiple` input. A
/// host cannot open a fake path, so only the leaf name crosses this boundary.
///
/// The parse itself is [`picked_files_from_change_value`], shared with
/// `basic/file_field`: the two file components must not grow two spellings of
/// "turn a change value into a file name". Crate-private: the crate's public
/// file API is the components' props, not this helper.
#[cfg(any(test, all(target_arch = "wasm32", target_os = "unknown")))]
pub(crate) fn upload_leaf_names(value: &str) -> Vec<String> {
    crate::basic::file_field::picked_files_from_change_value(value)
        .into_iter()
        .map(|file| file.name)
        .collect()
}

#[component]
pub fn FileUpload(props: FileUploadProps) -> Element {
    let upload_status = use_signal(|| FileUploadStatus::Idle);

    #[cfg(target_arch = "wasm32")]
    let files = use_signal(|| Vec::<String>::new());

    #[cfg(not(target_arch = "wasm32"))]
    let files = use_signal(Vec::<String>::new);

    let wrapper_classes = ClassesBuilder::new()
        .add(FileUploadClass::FileUploadWrapper)
        .add_raw(&props.class)
        .build();

    let status_class = match upload_status.get() {
        FileUploadStatus::Dragging => Some(FileUploadClass::Dragging),
        FileUploadStatus::Uploading => Some(FileUploadClass::Uploading),
        FileUploadStatus::Success => Some(FileUploadClass::Success),
        FileUploadStatus::Error => Some(FileUploadClass::Error),
        _ => None,
    };

    let mut drag_builder = ClassesBuilder::new().add(FileUploadClass::FileUpload);
    if let Some(class) = status_class {
        drag_builder = drag_builder.add(class);
    }
    let drag_classes = drag_builder.build();

    let on_files_for_change = props.on_files.clone();

    let upload_status_for_change = upload_status.clone();
    let files_for_change = files.clone();
    let on_change = move |e: ChangeEvent| {
        #[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
        {
            // `e.value` is the browser's fake path, never a name a host can
            // open — `upload_leaf_names` reduces it. An empty value means the
            // input has nothing selected (a cancelled picker, a reset), which
            // is not a selection event: report nothing rather than an empty
            // list a host would read as "the user cleared the field".
            let selected_files = upload_leaf_names(&e.value);
            if selected_files.is_empty() {
                return;
            }

            files_for_change.set(selected_files.clone());

            if let Some(handler) = on_files_for_change.as_ref() {
                handler.call(selected_files);
            }

            upload_status_for_change.set(FileUploadStatus::Success);
        }

        #[cfg(not(all(target_arch = "wasm32", target_os = "unknown")))]
        {
            let _ = e;
        }
    };

    rsx! {
        div { class: wrapper_classes, style: props.style,

            div {
                class: drag_classes,
                // File input (positioned over div)
                input {
                    r#type: "file",
                    multiple: props.multiple,
                    accept: props.accept,
                    style: "position: absolute; width: 100%; height: 100%; top: 0; left: 0; opacity: 0; cursor: pointer;",
                    onchange: on_change,
                }

                // Upload area
                div {
                    class: "hk-file-upload-area",
                    style: "pointer-events: none;",

                    Icon { icon: MdiIcon::Upload, size: 32, class: "hk-file-upload-icon".to_string(), color: String::new() }

                    p { class: "hk-file-upload-text", "{props.upload_text}" }

                    if props.show_preview && !files.get().is_empty() {
                        div { class: "hk-file-upload-preview",
                            for file in files.get().iter() {
                                div { class: "hk-file-upload-file", "{file}" }
                            }
                        }
                    }
                }
            }
        }
    }
}

impl StyledComponent for FileUploadComponent {
    fn styles() -> &'static str {
        r#"
.hk-file-upload-wrapper {
    width: 100%;
}

.hk-file-upload {
    border: 2px dashed var(--hi-color-border);
    border-radius: 8px;
    padding: 2rem;
    text-align: center;
    transition: all 0.3s ease;
    background-color: var(--hi-color-background);
    cursor: pointer;
    position: relative;
}

.hk-file-upload-dragging {
    border-color: var(--hi-color-primary);
    background-color: rgba(var(--hi-color-primary-rgb), 0.05);
    transform: scale(1.02);
}

.hk-file-upload-uploading {
    opacity: 0.6;
    pointer-events: none;
}

.hk-file-upload-success {
    border-color: var(--hi-color-success);
    background-color: rgba(var(--hi-color-success-rgb, 14, 184, 64), 0.05);
}

.hk-file-upload-error {
    border-color: var(--hi-color-error);
    background-color: rgba(var(--hi-color-error-rgb, 255, 76, 0), 0.05);
}

.hk-file-upload-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
}

.hk-file-upload-icon {
    width: 48px;
    height: 48px;
    color: var(--hi-color-text-secondary);
    transition: all 0.3s ease;
}

.hk-file-upload-dragging .hk-file-upload-icon {
    color: var(--hi-color-primary);
    transform: translateY(-4px);
}

.hk-file-upload-text {
    font-size: 0.875rem;
    color: var(--hi-color-text-primary);
    margin: 0;
}

.hk-file-upload-preview {
    margin-top: 1rem;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
}

.hk-file-upload-file {
    padding: 0.5rem 1rem;
    background-color: var(--hi-color-surface);
    border-radius: 4px;
    font-size: 0.875rem;
    color: var(--hi-color-text-primary);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.hk-file-upload-success .hk-file-upload-file {
    color: var(--hi-color-success);
}
"#
    }

    fn name() -> &'static str {
        "file_upload"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // GUARD PIN: a file input's `change` value is the browser fake path, so the
    // emission must be leaf names. Reporting `e.value` verbatim (as the mirror
    // did while the handler was still dead on the wire) puts an unopenable
    // `C:\fakepath\…` string into the host's file list — the shape this test
    // reds on.
    #[test]
    fn upload_leaf_names_drops_the_browser_fake_path() {
        assert_eq!(
            upload_leaf_names("C:\\fakepath\\report.csv"),
            vec!["report.csv".to_string()]
        );
        assert_eq!(
            upload_leaf_names("/home/lab/report.csv"),
            vec!["report.csv".to_string()]
        );
        // A browser that does not fake the path hands over the bare name.
        assert_eq!(
            upload_leaf_names("report.csv"),
            vec!["report.csv".to_string()]
        );
    }

    #[test]
    fn upload_leaf_names_keeps_a_comma_inside_the_name() {
        // `value` is ONE path even for a `multiple` input, so a comma is part of
        // the name. Splitting on it would report "report" and hide the real file.
        assert_eq!(
            upload_leaf_names("C:\\fakepath\\report, final.pdf"),
            vec!["report, final.pdf".to_string()]
        );
    }

    #[test]
    fn upload_leaf_names_reports_nothing_for_a_cleared_input() {
        // The cleared / cancelled picker: no names, so the handler emits
        // nothing instead of an empty selection.
        assert!(upload_leaf_names("").is_empty());
        // Path-only fragments have no leaf name.
        assert!(upload_leaf_names("C:\\fakepath\\").is_empty());
    }
}
