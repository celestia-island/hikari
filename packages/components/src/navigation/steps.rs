//! Deprecated `Steps` compatibility shim.
//!
//! `Steps` used to be a second, independent step-bar implementation living next
//! to [`crate::navigation::stepper::Stepper`]: two components, two `StepStatus`
//! enums, two `*Direction` enums and two overlapping `hk-step*` class families.
//! It has been collapsed into `Stepper`, which is now the crate's single step
//! bar.
//!
//! **Replacement**: render `Stepper` (horizontal or vertical, `current` of
//! `total`). Everything this shim cannot express — per-step
//! `title`/`description`/`icon`/`status`, `style` and `on_change` — is ignored;
//! render labels or click handling next to the bar instead.
//!
//! **Removal condition**: delete `Steps`, `StepsProps`, `StepData` and
//! `StepsDirection` once nothing references them. The last known caller is
//! nothing: the former `render_stepper`-style consumer is gone, so the
//!
//! ⚠️ The `#[component]` macro re-emits only the function signature, so the
//! `#[deprecated]` note written on [`Steps`] is not seen by rustc — the warning
//! that reaches consumers comes from the deprecated [`StepsProps`]/[`StepData`]
//! types, which every call has to build. Keep those attributes in place for as
//! long as the shim exists.

// The shim necessarily names its own deprecated items.
#![allow(deprecated)]

use crate::navigation::stepper::{Stepper, StepperDirection, StepperProps};
use crate::prelude::*;

/// Step-state vocabulary of the navigation step APIs.
///
/// This is the crate's single definition: the duplicate that used to live in
/// `stepper.rs` was removed by the `Steps`/`Stepper` convergence. `Stepper`
/// derives each step's state from `current`/`total`; deprecated [`StepData`]
/// still carries a `status` field so existing struct literals keep compiling.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum StepStatus {
    #[default]
    Wait,
    Process,
    Finish,
    Error,
}

impl IntoAttrValue for StepStatus {
    fn into_attr_value(self) -> Option<String> {
        Some(match self {
            StepStatus::Wait => "wait".to_string(),
            StepStatus::Process => "process".to_string(),
            StepStatus::Finish => "finish".to_string(),
            StepStatus::Error => "error".to_string(),
        })
    }
}

/// Direction of the deprecated [`Steps`] alias.
///
/// Mirrors [`StepperDirection`]; kept so existing `StepsProps` literals keep
/// compiling.
#[deprecated(note = "collapsed into `StepperDirection`, which `Stepper` consumes")]
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum StepsDirection {
    #[default]
    Horizontal,
    Vertical,
}

impl From<StepsDirection> for StepperDirection {
    fn from(direction: StepsDirection) -> Self {
        match direction {
            StepsDirection::Horizontal => StepperDirection::Horizontal,
            StepsDirection::Vertical => StepperDirection::Vertical,
        }
    }
}

/// One entry of the deprecated [`StepsProps::steps`] list.
///
/// Only the list length is still honoured (it becomes `StepperProps::total`);
/// the per-step fields are ignored by the alias and kept for source
/// compatibility.
#[define_props]
#[derive(Debug)]
#[deprecated(note = "collapsed into `Stepper`: only the step count survives, the rest is ignored")]
pub struct StepData {
    pub title: String,

    #[default]
    pub description: Option<String>,

    #[default]
    pub icon: Option<String>,

    #[default]
    pub status: StepStatus,

    #[default]
    pub class: String,
}

impl IntoAttrValue for StepData {
    fn into_attr_value(self) -> Option<String> {
        Some(self.title)
    }
}

/// Props of the deprecated [`Steps`] alias.
#[define_props]
#[deprecated(
    note = "collapsed into `StepperProps`; `style`, `on_change` and the per-step fields are ignored"
)]
pub struct StepsProps {
    #[default(0)]
    pub current: usize,

    #[default]
    pub direction: StepsDirection,

    pub steps: Vec<StepData>,

    #[default]
    pub class: String,

    #[default]
    pub style: String,

    #[default]
    pub on_change: Option<Callback<usize, ()>>,
}

/// Deprecated thin alias of [`Stepper`].
///
/// Forwards `current`, `total` (the length of [`StepsProps::steps`]),
/// `direction` and `class` to `Stepper`. Everything the count-based step bar
/// cannot express — per-step `title`/`description`/`icon`/`status`, `style` and
/// `on_change` — is ignored; migrate to `Stepper` and render labels or
/// click handling beside the bar.
///
/// Removal condition: delete `Steps`, `StepsProps`, `StepData` and
/// `StepsDirection` once no consumer references them — the last known caller is
/// no live consumer left (the former `render_stepper`-style caller is gone), so the
#[component]
#[deprecated(
    note = "use `Stepper`: the step bar is count-based now and drops the per-step payload"
)]
pub fn Steps(props: StepsProps) -> Element {
    Stepper(StepperProps {
        current: props.current,
        total: props.steps.len(),
        direction: props.direction.into(),
        class: props.class,
    })
}
