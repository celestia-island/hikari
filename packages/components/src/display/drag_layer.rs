// packages/components/src/display/drag_layer.rs
// DragLayer component with Arknights + FUI styling

use hikari_palette::classes::{ClassesBuilder, DragLayerClass, UtilityClass};

use crate::{prelude::*, styled::StyledComponent};

pub struct DragLayerComponent;

#[derive(Clone, PartialEq, Debug, Default)]
pub struct DragItem {
    pub id: String,
    pub label: String,
    pub item_type: String,
}

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

///
#[component]
pub fn DragLayer(props: DragLayerProps) -> Element {
    if !props.is_dragging {
        return VNode::empty();
    }

    let (x, y) = props.position;

    let container_classes = ClassesBuilder::new()
        .add(DragLayerClass::Container)
        .add_raw(&props.class)
        .build();

    rsx! {
        div { class: container_classes,

            // Drop zone overlay
            if props.show_drop_zones {
                div { class: DragLayerClass::DropZoneOverlay.as_class(),
                    div {
                        class: DragLayerClass::DropZone.as_class(),
                        style: "top: 50%; left: 50%; transform: translate(-50%, -50%);",
                        "Drop here"
                    }
                }
            }

            // Drag preview
            if let Some(ref item) = props.drag_item {
                div {
                    class: DragLayerClass::DragPreview.as_class(),
                    style: "left: {x}px; top: {y}px;",

                    div { class: DragLayerClass::DragPreviewContent.as_class(),
                        span { class: DragLayerClass::DragPreviewLabel.as_class(), "{item.label.clone()}" }
                        span { class: DragLayerClass::DragPreviewType.as_class(), "{item.item_type.clone()}" }
                    }
                }
            }
        }
    }
}

impl StyledComponent for DragLayerComponent {
    fn styles() -> &'static str {
        r#"
.hk-drag-layer {
    position: fixed;
    inset: 0;
    z-index: 9999;
    pointer-events: none;
}

.hk-drag-layer-drop-zone-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    padding: 16px;
}

.hk-drag-layer-drop-zone {
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

.hk-drag-layer-drop-zone:hover {
    background-color: rgba(var(--hi-color-primary-rgb), 0.15);
    border-style: solid;
}

.hk-drag-layer-drag-preview {
    position: fixed;
    transform: translate(-50%, -50%);
    pointer-events: none;
    animation: hi-drag-preview-fade-in 0.15s ease;
}

@keyframes hi-drag-preview-fade-in {
    from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.9);
    }
    to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
    }
}

.hk-drag-layer-drag-preview-content {
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

[data-theme="dark"] .hk-drag-layer-drag-preview-content {
    background-color: var(--hi-surface);
}

.hk-drag-layer-drag-preview-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--hi-text-primary);
}

.hk-drag-layer-drag-preview-type {
    font-size: 12px;
    color: var(--hi-text-secondary);
}
"#
    }

    fn name() -> &'static str {
        "drag-layer"
    }
}
