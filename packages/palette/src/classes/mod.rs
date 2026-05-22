pub mod colors;
pub mod components;
pub mod display;
pub mod effects;
pub mod layout;
pub mod sizing;
pub mod spacing;
pub mod transitions;
pub mod typography;

pub use colors::*;
pub use components::*;
pub use display::*;
pub use effects::*;
pub use layout::*;
pub use sizing::*;
pub use spacing::*;
pub use tairitsu_style::{ClassesBuilder, TypedClass};
pub use transitions::*;
pub use typography::*;

pub mod generated {
    include!(concat!(env!("OUT_DIR"), "/classes_generated.rs"));
}
