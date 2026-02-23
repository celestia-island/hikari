// packages/components/src/entry/number_input.rs
// NumberInput component with Arknights + FUI styling
// Features: Borderless buttons, unified input styling, independent glow zones using Glow component

use dioxus::prelude::*;
use icons::{Icon, MdiIcon};
use palette::classes::{ClassesBuilder, Display, NumberInputClass};

use crate::{
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity},
    styled::StyledComponent,
};

pub struct NumberInputComponent;

#[derive(Clone, PartialEq, Props)]
pub struct NumberInputProps {
    #[props(default = 0)]
    pub value: i64,

    pub on_change: EventHandler<i64>,

    #[props(default)]
    pub min: Option<i64>,

    #[props(default)]
    pub max: Option<i64>,

    #[props(default = 1)]
    pub step: i64,

    #[props(default = false)]
    pub disabled: bool,

    #[props(default)]
    pub size: NumberInputSize,

    #[