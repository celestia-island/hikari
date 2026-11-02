//! Auth family — Vue `Hk*` mirrors for the sign-in / MFA / captcha surfaces.
//!
//! The auth cards' geometry lives in the vendored `styles/admin-tokens.scss`
//! (registered as chrome `vue-admin-tokens`); components with their own sheet
//! compile it, the rest document an empty table.

pub mod alt_sign_in;
pub mod auth_card;
pub mod auth_method_list;
pub mod auth_submit_button;
pub mod captcha_modal;
pub mod captcha_widget;
pub mod cookie_consent;
pub mod mfa_verify_card;
pub mod password_surface;
pub mod sign_in_card;
pub mod third_party_sign_in_card;

pub use alt_sign_in::*;
pub use auth_card::*;
pub use auth_method_list::*;
pub use auth_submit_button::*;
pub use captcha_modal::*;
pub use captcha_widget::*;
pub use cookie_consent::*;
pub use mfa_verify_card::*;
pub use password_surface::*;
pub use sign_in_card::*;
pub use third_party_sign_in_card::*;
