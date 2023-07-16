mod functions;
mod secure;
mod utils;

use serde::{Deserialize, Serialize};

pub mod request {
    pub use super::functions::*;
    pub use super::secure::*;

    pub use super::utils::filter;
    pub use super::utils::LimitOffset;
    pub use super::utils::UuidData;
}

pub mod response {
    pub use super::functions::*;

    pub use super::utils::Count;
    pub use super::utils::UuidData;
}

pub mod models {
    pub use super::functions::*;
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RequestPackage {
    UserInfo(functions::UserType),

    Login(secure::LoginInfo),
    Verify(secure::VerifyInfo),

    Uuid(utils::UuidData),
    LimitOffset(utils::LimitOffset),
    Filter(Vec<utils::filter::FilterPackage>),
    None,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(untagged, rename_all = "snake_case")]
pub enum ResponseStruct {
    UserInfo(functions::UserType),

    Count(utils::Count),
    Token(utils::UuidData),
    Ok,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ResponsePackage {
    Data(Vec<ResponseStruct>),
    ErrorReason(String),
}
