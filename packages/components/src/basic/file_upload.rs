// packages/components/src/basic/file_upload.rs
// FileUpload component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::ClassesBuilder;

use crate::styled::StyledComponent;

/// FileUpload component type wrapper (for StyledComponent)
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

#[derive(Clone, PartialEq, Props, Default)]
pub struct FileUploadProps {
    /// Whether to accept multiple files
    #[props(default = false)]
    pub multiple: bool,

    /// Accepted file types (e.g., "image/*,.pdf")
    #[props(default)]
    pub accept: String,

    /// Maximum file size in bytes
    #[props(default = 10485760)] // 10MB default
    pub max_size: usize,

    /// Whether to show file preview
    #[props(default = true)]
    pub show_preview: bool,

    /// Custom upload button text
    #[props(default = "Click or drag file to upload".to_string())]
    pub upload_text: String,

    /// Additional CSS class
    #[props(default)]
    pub class: String,

    /// Additional inline style
    #[props(default)]
    pub style: String,

    /// Callback when files are selected
    #[props(default)]
    pub on_files: Option<EventHandler<Vec<String>>>,

    /// Callback when file is too large
    #[props(default)]
    pub on_error: Option<EventHandler<String>>,
}

#[component]
pub fn FileUpload(props: FileUploadProps) -> Element {
    let mut upload_status = use_signal(|| FileUploadStatus::Idle);
    let mut files = use_signal(|| Vec::<String>::new());

    let wrapper_classes = ClassesBuilder::new()
        .add_raw("hi-file-upload-wrapper")
        .add_raw(&props.class)
        .build();

    let drag_classes = ClassesBuilder::new()
        .add_raw("hi-file-upload")
        .add_raw(match upload_status() {
            FileUploadStatus::Dragging => "hi-file-upload-dragging",
            FileUploadStatus::Uploading => "hi-file-upload-uploading",
            FileUploadStatus::Success => "hi-file-upload-success",
            FileUploadStatus::Error => "hi-file-upload-error",
            _ => "",
        })
        .build();

    let _handle_files = move |file_list: web_sys::FileList| {
        let mut selected_files = Vec::new();
        let mut errors = Vec::new();

        for i in 0..file_list.length() {
            if let Some(file) = file_list.get(i) {
                let size = file.size() as usize;

                if size > props.max_size {
                    errors.push(format!(
                        "File '{}' is too large (max: {} bytes)",
                        file.name(),
                        props.max_size
                    ));
                    continue;
                }

                selected_files.push(file.name());
            }
        }

        if !errors.is_empty() && props.on_error.is_some() {
            for error in errors {
                if let Some(handler) = props.on_error.as_ref() {
                    handler.call(error);
                }
            }
        }

        if !selected_files.is_empty() {
            files.set(selected_files.clone());

            if let Some(handler) = props.on_files.as_ref() {
                handler.call(selected_files);
            }

            upload_status.set(FileUploadStatus::Success);
        }
    };

    let on_drag_over = move |e: DragEvent| {
        e.prevent_default();
        upload_status.set(FileUploadStatus::Dragging);
    };

    let on_drag_leave = move |_: DragEvent| {
        upload_status.set(FileUploadStatus::Idle);
    };

    let on_drop = move |e: DragEvent| {
        e.prevent_default();
        upload_status.set(FileUploadStatus::Idle);

        #[cfg(target_arch = "wasm32")]
        {
            if let Some(dt) = e.data_transfer() {
                if let Some(file_list) = dt.files() {
                    handle_files(file_list);
                }
            }
        }
    };

    let on_change = move |_: Event<FormData>| {
        #[cfg(target_arch = "wasm32")]
        {
            if let Some(input) = e
                .target()
                .and_then(|t| t.dyn_ref::<web_sys::HtmlInputElement>().cloned())
            {
                if let Some(file_list) = input.files() {
                    handle_files(file_list);
                }
            }
        }
    };

    rsx! {
        div {
            class: "{wrapper_classes}",
            style: "{props.style}",

            div {
                class: "{drag_classes}",
                ondragover: on_drag_over,
                ondragleave: on_drag_leave,
                ondrop: on_drop,

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
                    class: "hi-file-upload-area",
                    style: "pointer-events: none;",

                    svg {
                        class: "hi-file-upload-icon",
                        view_box: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        stroke_width: "2",
                        path { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }
                        polyline { points: "17 8 12 3 7 8" }
                        line { x1: "12", y1: "3", x2: "12", y2: "15" }
                    }

                    p { class: "hi-file-upload-text", "{props.upload_text}" }

                    if props.show_preview && !files().is_empty() {
                        div { class: "hi-file-upload-preview",
                            for file in files().iter() {
                                div { class: "hi-file-upload-file", "{file}" }
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
.hi-file-upload-wrapper {
    width: 100%;
}

.hi-file-upload {
    border: 2px dashed var(--hi-color-border);
    border-radius: 8px;
    padding: 2rem;
    text-align: center;
    transition: all 0.3s ease;
    background-color: var(--hi-color-background);
    cursor: pointer;
    position: relative;
}

.hi-file-upload-dragging {
    border-color: var(--hi-color-primary);
    background-color: rgba(var(--hi-color-primary-rgb), 0.05);
    transform: scale(1.02);
}

.hi-file-upload-uploading {
    opacity: 0.6;
    pointer-events: none;
}

.hi-file-upload-success {
    border-color: var(--hi-color-success);
    background-color: rgba(var(--hi-color-success-rgb), 0.05);
}

.hi-file-upload-error {
    border-color: var(--hi-color-error);
    background-color: rgba(var(--hi-color-error-rgb), 0.05);
}

.hi-file-upload-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
}

.hi-file-upload-icon {
    width: 48px;
    height: 48px;
    color: var(--hi-color-text-secondary);
    transition: all 0.3s ease;
}

.hi-file-upload-dragging .hi-file-upload-icon {
    color: var(--hi-color-primary);
    transform: translateY(-4px);
}

.hi-file-upload-text {
    font-size: 0.875rem;
    color: var(--hi-color-text-primary);
    margin: 0;
}

.hi-file-upload-preview {
    margin-top: 1rem;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
}

.hi-file-upload-file {
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

.hi-file-upload-success .hi-file-upload-file {
    color: var(--hi-color-success);
}
"#
    }

    fn name() -> &'static str {
        "file_upload"
    }
}
