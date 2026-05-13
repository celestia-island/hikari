// hi-components/src/feedback/drawer.rs
// Drawer component with Arknights + FUI styling

use hikari_palette::classes::{ClassesBuilder, DrawerClass, TypedClass};

use std::cell::RefCell;
use std::rc::Rc;

use tairitsu_hooks::ReactiveSignal;

use crate::{platform, prelude::*, styled::StyledComponent};

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DrawerPlacement {
    #[default]
    Right,
    Left,
    Top,
    Bottom,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DrawerSize {
    #[default]
    Medium,
    Small,
    Large,
}

/// Props for the [`Drawer`] component, controlling placement, size, mask behavior, and content.
struct DrawerAnimState {
    start_ts: Option<f64>,
    stopped: bool,
}

const DRAWER_ANIM_DURATION_MS: f64 = 300.0;

fn drawer_anim_tick(state: Rc<RefCell<DrawerAnimState>>, progress_signal: ReactiveSignal<f64>) {
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
        let progress = (elapsed / DRAWER_ANIM_DURATION_MS).min(1.0);
        drop(s);

        let eased = 1.0 - (1.0 - progress).powi(3);
        progress_signal.set(eased);

        if progress < 1.0 {
            drawer_anim_tick(state.clone(), progress_signal.clone());
        }
    });
}

#[define_props]
pub struct DrawerProps {
    pub open: bool,

    pub on_close: Option<EventHandler<MouseEvent>>,

    pub placement: DrawerPlacement,

    pub size: DrawerSize,

    pub mask_closable: bool,

    pub title: Option<String>,

    pub footer: Option<Element>,

    pub class: String,

    pub children: Element,
}

/// A slide-in panel overlay that renders from any screen edge with optional title, footer, and mask.
#[component]
pub fn Drawer(props: DrawerProps) -> Element {
    let on_close = props.on_close;
    let mask_closable = props.mask_closable;

    let on_close_for_mask = on_close.clone();
    let handle_mask_click = move |e: MouseEvent| {
        if mask_closable && let Some(handler) = on_close_for_mask.as_ref() {
            handler.call(e);
        }
    };

    let (placement_class, _size_width, _size_height) = match (props.placement, props.size) {
        (DrawerPlacement::Right, DrawerSize::Small) => (DrawerClass::Right, "300px", "100%"),
        (DrawerPlacement::Right, DrawerSize::Medium) => (DrawerClass::Right, "500px", "100%"),
        (DrawerPlacement::Right, DrawerSize::Large) => (DrawerClass::Right, "700px", "100%"),
        (DrawerPlacement::Left, DrawerSize::Small) => (DrawerClass::Left, "300px", "100%"),
        (DrawerPlacement::Left, DrawerSize::Medium) => (DrawerClass::Left, "500px", "100%"),
        (DrawerPlacement::Left, DrawerSize::Large) => (DrawerClass::Left, "700px", "100%"),
        (DrawerPlacement::Top, DrawerSize::Small) => (DrawerClass::Top, "100%", "300px"),
        (DrawerPlacement::Top, DrawerSize::Medium) => (DrawerClass::Top, "100%", "500px"),
        (DrawerPlacement::Top, DrawerSize::Large) => (DrawerClass::Top, "100%", "700px"),
        (DrawerPlacement::Bottom, DrawerSize::Small) => (DrawerClass::Bottom, "100%", "300px"),
        (DrawerPlacement::Bottom, DrawerSize::Medium) => (DrawerClass::Bottom, "100%", "500px"),
        (DrawerPlacement::Bottom, DrawerSize::Large) => (DrawerClass::Bottom, "100%", "700px"),
    };

    let progress_signal = use_signal(|| 0.0_f64);
    let prev_open_signal = use_signal(|| false);

    let prev_open = prev_open_signal.get();
    if props.open && !prev_open {
        prev_open_signal.set(true);
        progress_signal.set(0.0);
        let prog_sig = progress_signal.clone();
        let state = Rc::new(RefCell::new(DrawerAnimState {
            start_ts: None,
            stopped: false,
        }));
        let s_ref = state.clone();
        platform::request_animation_frame_with_timestamp(move |ts| {
            let mut s = s_ref.borrow_mut();
            if s.stopped {
                return;
            }
            s.start_ts = Some(ts);
            drop(s);
            drawer_anim_tick(s_ref, prog_sig);
        });
    }
    if !props.open && prev_open {
        prev_open_signal.set(false);
    }

    let progress = progress_signal.get();

    let drawer_style = if props.open {
        let offset = 100.0 * (1.0 - progress);
        let transform = match props.placement {
            DrawerPlacement::Right => format!("translateX({offset:.1}%)"),
            DrawerPlacement::Left => format!("translateX(-{offset:.1}%)"),
            DrawerPlacement::Top => format!("translateY(-{offset:.1}%)"),
            DrawerPlacement::Bottom => format!("translateY({offset:.1}%)"),
        };
        format!("display: block; transform: {transform};")
    } else {
        "display: none;".to_string()
    };

    let mask_style = if props.open {
        format!("opacity: {progress:.2};")
    } else {
        "opacity: 0;".to_string()
    };

    let drawer_classes = ClassesBuilder::new()
        .add_typed(DrawerClass::Drawer)
        .add_typed(placement_class)
        .add(&props.class)
        .build();

    rsx! {
        if props.open {
            // Mask overlay
            div {
                class: DrawerClass::Mask.class_name(),
                style: mask_style,
                onclick: handle_mask_click,
            }

            // Drawer panel
            div {
                class: drawer_classes,
                style: drawer_style,
                role: "dialog",
                "aria-modal": "true",
                "aria-labelledby": "hi-drawer-title",

                // Header
                if let Some(title) = props.title {
                    div { class: DrawerClass::Header.class_name(),
                        div { id: "hi-drawer-title", class: DrawerClass::Title.class_name(), "{title}" }
                        button {
                            class: DrawerClass::Close.class_name(),
                            "aria-label": "Close",
                            onclick: move |e| {
                                if let Some(handler) = on_close.as_ref() {
                                    handler.call(e);
                                }
                            },
                            svg {
                                view_box: "0 0 24 24",
                                fill: "none",
                                stroke: "currentColor",
                                stroke_width: "2",
                                line { x1: "18", y1: "6", x2: "6", y2: "18" }
                                line { x1: "6", y1: "6", x2: "18", y2: "18" }
                            }
                        }
                    }
                }

                // Body
                div { class: DrawerClass::Body.class_name(),
                    { props.children }
                }

                // Footer
                if let Some(footer) = props.footer {
                    div { class: DrawerClass::Footer.class_name(),
                        { footer }
                    }
                }
            }
        }
    }
}

pub struct DrawerComponent;

impl StyledComponent for DrawerComponent {
    fn styles() -> &'static str {
        r#"
.hi-drawer-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
}

.hi-drawer {
  position: fixed;
  z-index: 1001;
  background: var(--hi-background);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
}

[data-theme="dark"] .hi-drawer {
  background: var(--hi-surface);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.hi-drawer-right {
  top: 0;
  right: 0;
  height: 100vh;
  border-left: 1px solid var(--hi-border);
}

.hi-drawer-left {
  top: 0;
  left: 0;
  height: 100vh;
  border-right: 1px solid var(--hi-border);
}

.hi-drawer-top {
  top: 0;
  left: 0;
  width: 100vw;
  border-bottom: 1px solid var(--hi-border);
}

.hi-drawer-bottom {
  bottom: 0;
  left: 0;
  width: 100vw;
  border-top: 1px solid var(--hi-border);
}

.hi-drawer-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--hi-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hi-drawer-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--hi-text-primary);
}

.hi-drawer-close {
  background: transparent;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--hi-text-secondary);
  border-radius: 4px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hi-drawer-close:hover {
  background: var(--hi-color-hover);
  color: var(--hi-text-primary);
}

.hi-drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  color: var(--hi-text-primary);
}

.hi-drawer-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--hi-border);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.hi-drawer-body::-webkit-scrollbar {
  width: 6px;
}

.hi-drawer-body::-webkit-scrollbar-track {
  background: transparent;
}

.hi-drawer-body::-webkit-scrollbar-thumb {
  background: var(--hi-border);
  border-radius: 3px;
}

.hi-drawer-body::-webkit-scrollbar-thumb:hover {
  background: var(--hi-color-border);
}
"#
    }

    fn name() -> &'static str {
        "drawer"
    }
}
