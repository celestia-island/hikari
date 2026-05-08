// hi-components/src/feedback/spin.rs
// Spin component with Arknights + FUI styling
// Animation: RAF-driven rotation (migrated from CSS @keyframes)

use std::cell::RefCell;
use std::rc::Rc;

use hikari_palette::classes::{TypedClass, ClassesBuilder, SpinClass};

use crate::{platform, prelude::*, styled::StyledComponent};

use tairitsu_hooks::ReactiveSignal;

const ROTATION_SPEED_DEG_PER_MS: f64 = 0.4; // 400 deg/s = ~0.9s per revolution

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SpinSize {
    #[default]
    Medium,
    Small,
    Large,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SpinTip {
    #[default]
    None,
    Loading,
    Success,
}

#[define_props]
pub struct SpinProps {
    pub size: SpinSize,

    pub tip: SpinTip,

    pub custom_tip: Option<String>,

    pub delay: Option<u64>,

    pub spinning: bool,

    pub class: String,
}

struct SpinAnimationState {
    rotation: f64,
    last_timestamp: Option<f64>,
    stopped: bool,
}

#[component]
pub fn Spin(props: SpinProps) -> Element {
    let size_class = match props.size {
        SpinSize::Small => SpinClass::Sm,
        SpinSize::Medium => SpinClass::Md,
        SpinSize::Large => SpinClass::Lg,
    };

    let spin_classes = ClassesBuilder::new()
        .add_typed(SpinClass::Spin)
        .add_typed(size_class)
        .add_typed_if(SpinClass::Stopped, !props.spinning)
        .add(&props.class)
        .build();

    let tip_text = if let Some(custom) = props.custom_tip {
        custom
    } else {
        match props.tip {
            SpinTip::None => String::new(),
            SpinTip::Loading => "加载中...".to_string(),
            SpinTip::Success => "加载成功".to_string(),
        }
    };

    let rotation_signal = use_signal(|| 0.0_f64);

    let rot_clone = rotation_signal.clone();
    let spinning = props.spinning;

    use_effect(move || {
        if !spinning {
            return;
        }

        let state = Rc::new(RefCell::new(SpinAnimationState {
            rotation: 0.0,
            last_timestamp: None,
            stopped: false,
        }));

        let state_ref = state.clone();
        let rot_signal = rot_clone.clone();

        platform::request_animation_frame_with_timestamp(move |timestamp| {
            let mut s = state_ref.borrow_mut();
            if s.stopped {
                return;
            }
            s.last_timestamp = Some(timestamp);
            s.rotation = 0.0;
            drop(s);

            let st = state_ref.clone();
            let rs = rot_signal.clone();
            spin_loop(st, rs);
        });

        let state_cleanup = state.clone();
        let _ = state_cleanup;
    });

    let rotation = rotation_signal.get();
    let spinner_style = if props.spinning {
        format!("transform: rotate({rotation:.1}deg);")
    } else {
        String::new()
    };

    rsx! {
        div { class: spin_classes,
            div {
                class: SpinClass::Spinner.class_name(),
                style: spinner_style,
            }
            if !tip_text.is_empty() {
                div { class: SpinClass::Tip.class_name(), "{tip_text}" }
            }
        }
    }
}

fn spin_loop(
    state: Rc<RefCell<SpinAnimationState>>,
    rotation_signal: ReactiveSignal<f64>,
) {
    platform::request_animation_frame_with_timestamp(move |timestamp| {
        let mut s = state.borrow_mut();
        if s.stopped {
            return;
        }
        let prev = s.last_timestamp.unwrap_or(timestamp);
        let delta_ms = timestamp - prev;
        s.last_timestamp = Some(timestamp);
        s.rotation = (s.rotation + ROTATION_SPEED_DEG_PER_MS * delta_ms) % 360.0;
        let current = s.rotation;
        drop(s);

        rotation_signal.set(current);

        let st = state.clone();
        let rs = rotation_signal.clone();
        spin_loop(st, rs);
    });
}

pub struct SpinComponent;

impl StyledComponent for SpinComponent {
    fn styles() -> &'static str {
        r#"
.hi-spin {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.hi-spin-spinner {
  border-radius: 50%;
  border: 3px solid var(--hi-border);
  border-top-color: var(--hi-color-primary);
  will-change: transform;
}

.hi-spin-sm .hi-spin-spinner {
  width: 16px;
  height: 16px;
  border-width: 2px;
}

.hi-spin-md .hi-spin-spinner {
  width: 24px;
  height: 24px;
  border-width: 3px;
}

.hi-spin-lg .hi-spin-spinner {
  width: 32px;
  height: 32px;
  border-width: 4px;
}

.hi-spin-stopped .hi-spin-spinner {
  opacity: 0.3;
}

.hi-spin-tip {
  font-size: 14px;
  color: var(--hi-text-secondary);
  line-height: 1.5;
}

[data-theme="dark"] .hi-spin-spinner {
  border-color: var(--hi-border);
  border-top-color: var(--hi-color-primary);
}

[data-theme="dark"] .hi-spin-tip {
  color: var(--hi-text-secondary);
}
"#
    }

    fn name() -> &'static str {
        "spin"
    }
}
