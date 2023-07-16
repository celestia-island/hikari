use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Copy, Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct UuidData {
    pub uuid: Uuid,
}

#[derive(Copy, Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct Count {
    pub count: u64,
}

#[derive(Copy, Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LimitOffset {
    pub offset: u64,
    pub limit: u64,
}

pub mod filter {
    use serde::{Deserialize, Serialize};
    use strum_macros::{Display, EnumString};

    #[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
    pub struct FilterPackage {
        pub tag: String,
        pub operator: FilterConditionType,
        pub value: String,
    }

    #[allow(dead_code)]
    #[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize, EnumString, Display)]
    #[serde(rename_all = "snake_case")]
    pub enum NumberOperation {
        Equal,
        NotEqual,
        Greater,
        GreaterOrEqual,
        Less,
        LessOrEqual,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize, EnumString, Display)]
    #[serde(rename_all = "snake_case")]
    pub enum LogicalOperation {
        Equal,
        NotEqual,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize, Display)]
    #[serde(untagged)]
    pub enum FilterConditionType {
        Text(LogicalOperation),
        Number(NumberOperation),
        Boolean,
    }
}
