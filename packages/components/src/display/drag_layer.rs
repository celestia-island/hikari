// packages/components/src/display/drag_layer.rs
// DragLayer component with Arknights + FUI styling

use hikari_palette::classes::{TypedClass, ClassesBuilder, DragLayerClass};

use std::cell::RefCell;
use std::rc::Rc;

use tairitsu_hooks::ReactiveSignal;

use crate::{platform, prelude::*, styled::StyledComponent};

pub struct DragLayerComponent;

struct DragPreviewAnimState {
    start_ts: Option<f64>,
    stopped: bool,
}

const DRAG_PREVIEW_ANIM_MS: f64 = 150.0;

fn drag_preview_anim_tick(
    state: Rc<RefCell<DragPreviewAnimState>>,
    progress_signal: ReactiveSignal<f64>,
) {
    platform::request_animation_frame_with_timestamp(move |ts| {
        let mut s = state.borrow_mut();
        if s.stopped {
            return;
        }
        let start = s.start_ts.unwrap_or(ts);
        if s.start_ts.is_none() {
            s.start_ts = Some(ts);
        }
        let elapsed = ts - start;
        let progress = (elapsed / DRAG_PREVIEW_ANIM_MS).min(1.0);
        drop(s);

        let eased = 1.0 - (1.0 - progress).powi(2);
        progress_signal.set(eased);

        if progress < 1.0 {
            drag_preview_anim_tick(state.clone(), progress_signal.clone());
        }
    });
}

#[derive(Clone, PartialEq, Debug, Default)]
pub struct DragItem {
    pub id: String,
    pub label: String,
    pub item_type: String,
}

/// Props for the DragLayer component.
#[define_props]
pub struct DragLayerProps {
    #[default]
    pub drag_item: Option<DragItem>,

    #[default]
    pub position: (i32, i32),

    #[default]
    pub is_dragging: bool,

    #[default]
    pub show_drop_zones: bool,

    #[default]
    pub class: String,
}

/// A drag overlay layer that shows a drag preview and optional drop zones.
#[component]
pub fn DragLayer(props: DragLayerProps) -> Element {
    if !props.is_dragging {
        return VNode::empty();
    }

    let (x, y) = props.position;

    let container_classes = ClassesBuilder::new()
        .add_typed(DragLayerClass::Container)
        .add(&props.class)
        .build();

    let progress_signal = use_signal(|| 0.0_f64);

    {
        let prog_clone = progress_signal.clone();
        use_effect(move || {
            let state = Rc::new(RefCell::new(DragPreviewAnimState {
                start_ts: None,
                stopped: false,
            }));
            let s_ref = state.clone();
            let prog_sig = prog_clone.clone();
            platform::request_animation_frame_with_timestamp(move |ts| {
                let mut s = s_ref.borrow_mut();
                if s.stopped {
                    return;
                }
                s.start_ts = Some(ts);
                drop(s);
                drag_preview_anim_tick(s_ref, prog_sig);
            });
        });
    }

    let progress = progress_signal.get();
    let scale = 0.9 + 0.1 * progress;
    let preview_style = format!(
        "left: {x}px; top: {y}px; opacity: {progress:.2}; transform: translate(-50%, -50%) scale({scale:.3});"
    );

    rsx! {
        div { class: container_classes,

            // Drop zone overlay
            if props.show_drop_zones {
                div { class: DragLayerClass::DropZoneOverlay.class_name(),
                    div {
                        class: DragLayerClass::DropZone.class_name(),
                        style: "top: 50%; left: 50%; transform: translate(-50%, -50%);",
                        "Drop here"
                    }
                }
            }

            // Drag preview
            if let Some(ref item) = props.drag_item {
                div {
                    class: DragLayerClass::DragPreview.class_name(),
                    style: preview_style,

                    div { class: DragLayerClass::DragPreviewContent.class_name(),
                        span { class: DragLayerClass::DragPreviewLabel.class_name(), "{item.label}" }
                        span { class: DragLayerClass::DragPreviewType.class_name(), "{item.item_type}" }
                    }
                }
            }
        }
    }
}

impl StyledComponent for DragLayerComponent {
    fn styles() -> &'static str {
        r#"
.hi-drag-layer {
    position: fixed;
    inset: 0;
    z-index: 9999;
    pointer-events: none;
}

.hi-drag-layer-drop-zone-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    padding: 16px;
}

.hi-drag-layer-drop-zone {
    position: absolute;
    min-width: 100px;
    min-height: 60px;
    border: 2px dashed var(--hi-color-primary);
    border-radius: 8px;
    background-color: rgba(var(--hi-color-primary-rgb), 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: var(--hi-color-primary);
    transition: all 0.2s ease;
}

.hi-drag-layer-drop-zone:hover {
    background-color: rgba(var(--hi-color-primary-rgb), 0.15);
    border-style: solid;
}

.hi-drag-layer-drag-preview {
    position: fixed;
    pointer-events: none;
}

.hi-drag-layer-drag-preview-content {
    background-color: var(--hi-color-bg-container);
    border: 1px solid var(--hi-color-border);
    border-radius: 8px;
    padding: 12px 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 120px;
}

[data-theme="dark"] .hi-drag-layer-drag-preview-content {
    background-color: var(--hi-surface);
}

.hi-drag-layer-drag-preview-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--hi-text-primary);
}

.hi-drag-layer-drag-preview-type {
    font-size: 12px;
    color: var(--hi-text-secondary);
}
"#
    }

    fn name() -> &'static str {
        "drag-layer"
    }
}
