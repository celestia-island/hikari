// website/src/pages/components/layer1/select_detail_modal.rs
// Select detail modal with enhanced styling

use dioxus::prelude::*;
use _components::{Button, Select, SelectOption};
use _palette::classes::{ClassesBuilder, FontSize, Padding};
use _icons::MdiIcon;

#[derive(Clone, PartialEq, Props)]
pub struct SelectDetailModalProps {
    pub open: Signal<bool>,
    pub on_close: EventHandler<()>,
}

/// Select detail modal component
/// Shows a detailed selection interface in a modal
#[component]
pub fn SelectDetailModal(props: SelectDetailModalProps) -> Element {
    let mut city_value = use_signal(|| "bj".to_string());
    let mut category_value = use_signal(|| "tech".to_string());
    let mut status_value = use_signal(|| "on".to_string());

    rsx! {
        if *props.open.read() {
            div {
                class: "select-detail-modal-overlay",
                onclick: move |_| props.on_close.call(()),

                div {
                    class: "select-detail-modal",

                    // Header with close button
                    div {
                        class: "select-detail-modal-header",

                        h2 {
                            class: "select-detail-modal-title",
                            "选择器详情"
                        }

                        button {
                            class: "select-detail-modal-close",
                            onclick: move |_| props.on_close.call(()),

                            Icon {
                                icon: MdiIcon::Close,
                                size: 24,
                            }
                        }
                    }

                    // Content area with glow-wrapper options
                    div {
                        class: "select-detail-modal-content",

                        // City selection with glow wrapper
                        div {
                            class: "select-detail-option-group glow-wrapper",

                            label { "选择城市" }

                            Select {
                                placeholder: "请选择城市".to_string(),
                                value: city_value.clone(),
                                on_change: move |v| city_value.set(v),
                                options: vec![
                                    SelectOption {
                                        label: "北京".to_string(),
                                        value: "bj".to_string(),
                                    },
                                    SelectOption {
                                        label: "上海".to_string(),
                                        value: "sh".to_string(),
                                    },
                                    SelectOption {
                                        label: "广州".to_string(),
                                        value: "gz".to_string(),
                                    },
                                    SelectOption {
                                        label: "深圳".to_string(),
                                        value: "sz".to_string(),
                                    },
                                ],
                            }
                        }

                        // Category selection with glow wrapper
                        div {
                            class: "select-detail-option-group glow-wrapper",

                            label { "选择分类" }

                            Select {
                                size: _components::SelectSize::Lg,
                                placeholder: "请选择分类".to_string(),
                                value: category_value.clone(),
                                on_change: move |v| category_value.set(v),
                                options: vec![
                                    SelectOption {
                                        label: "科技".to_string(),
                                        value: "tech".to_string(),
                                    },
                                    SelectOption {
                                        label: "艺术".to_string(),
                                        value: "art".to_string(),
                                    },
                                    SelectOption {
                                        label: "体育".to_string(),
                                        value: "sports".to_string(),
                                    },
                                ],
                            }
                        }

                        // Status selection with glow wrapper
                        div {
                            class: "select-detail-option-group glow-wrapper",

                            label { "启用状态" }

                            Select {
                                placeholder: "请选择状态".to_string(),
                                value: status_value.clone(),
                                on_change: move |v| status_value.set(v),
                                disabled: true,
                                options: vec![
                                    SelectOption {
                                        label: "启用".to_string(),
                                        value: "on".to_string(),
                                    },
                                    SelectOption {
                                        label: "禁用".to_string(),
                                        value: "off".to_string(),
                                    },
                                ],
                            }
                        }

                        // Action buttons
                        div {
                            class: "select-detail-modal-actions",

                            button {
                                class: "select-detail-modal-action-button secondary",
                                onclick: move |_| props.on_close.call(()),
                                "关闭"
                            }

                            button {
                                class: "select-detail-modal-action-button primary",
                                onclick: move |_| props.on_close.call(()),
                                "确定"
                            }
                        }
                    }
                }
            }
        }
    }
}

pub struct SelectDetailModalComponent;

impl _components::styled::StyledComponent for SelectDetailModalComponent {
    fn styles() -> &'static str {
        r#"
.select-detail-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
    animation: modal-fade-in 0.2s ease-out;
}

@keyframes modal-fade-in {
    from {
        opacity: 0;
        transform: scale(0.95);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

.select-detail-modal {
    background: var(--hi-color-bg-elevated, rgba(255, 255, 255, 0.98));
    border-radius: 12px;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    animation: modal-slide-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modal-slide-up {
    from {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.select-detail-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--hi-color-border, rgba(0, 0, 0, 0.1));
}

.select-detail-modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--hi-color-text-primary, #2D2D2D);
    margin: 0;
}

.select-detail-modal-close {
    background: transparent;
    border: none;
    color: var(--hi-color-text-secondary, #6B7280);
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
}

.select-detail-modal-close:hover {
    background: rgba(0, 0, 0, 0.05);
}

.select-detail-modal-content {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.select-detail-option-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.select-detail-option-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--hi-color-text-secondary, #6B7280);
    margin-bottom: 8px;
}

/* Glow wrapper effect for focused options */
.glow-wrapper {
    position: relative;
    padding: 4px;
    border-radius: 8px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: transparent;
}

.glow-wrapper::before {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    border-radius: 10px;
    background: linear-gradient(135deg,
        rgba(123, 97, 255, 0) 0%,
        rgba(123, 97, 255, 0) 50%,
        rgba(123, 97, 255, 0) 100%);
    background-size: 200% 200%;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
    z-index: -1;
}

.glow-wrapper:hover::before,
.glow-wrapper:focus-within::before {
    opacity: 1;
}

/* When Select inside glow wrapper is focused */
.glow-wrapper:focus-within {
    background: var(--hi-color-bg-elevated, rgba(255, 255, 255, 0.98));
    box-shadow: 0 0 4px rgba(123, 97, 255, 0.3);
}

/* Focus state - only background changes, text color stays same */
.glow-wrapper select:focus,
.glow-wrapper .hi-select:focus {
    outline: none;
    border-color: var(--hi-color-primary, #7BCFA6);
    background: var(--hi-color-bg-elevated, rgba(255, 255, 255, 0.98));
}

/* Ensure label text doesn't change on focus */
.glow-wrapper label,
.glow-wrapper:focus-within label {
    color: var(--hi-color-text-secondary, #6B7280) !important;
}

.glow-wrapper:focus-within label {
    color: var(--hi-color-text-secondary, #6B7280) !important;
}

/* Disabled select in glow wrapper */
.glow-wrapper select:disabled,
.glow-wrapper .hi-select:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.select-detail-modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding: 24px;
    border-top: 1px solid var(--hi-color-border, rgba(0, 0, 0, 0.1));
}

.select-detail-modal-action-button {
    padding: 10px 24px;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 100px;
}

.select-detail-modal-action-button.primary {
    background: linear-gradient(135deg, var(--hi-color-primary, #7BCFA6), var(--hi-button-primary-dark, #5A9CD8));
    color: white;
    border: none;
}

.select-detail-modal-action-button.primary:hover {
    box-shadow: 0 0 12px rgba(123, 97, 255, 0.4);
    transform: translateY(-1px);
}

.select-detail-modal-action-button.secondary {
    background: transparent;
    color: var(--hi-color-primary, #7BCFA6);
    border: 1px solid var(--hi-color-primary, #7BCFA6);
}

.select-detail-modal-action-button.secondary:hover {
    background: rgba(123, 97, 255, 0.1);
}
"#
    }

    fn name() -> &'static str {
        "select_detail_modal"
    }
}
