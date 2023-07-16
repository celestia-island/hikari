use serde_json::to_string;

use hyper::StatusCode;

use hikari_utils::types::{ResponsePackage, ResponseStruct};

pub fn generate_ok_message() -> Result<String, (StatusCode, String)> {
    let ret = ResponsePackage::Data(vec![ResponseStruct::Ok]);
    to_string(&ret).or_else(|e| Err(generate_error_message(e.to_string())))
}

pub fn generate_error_message(message: String) -> (StatusCode, String) {
    let ret = ResponsePackage::ErrorReason(message);
    let ret = to_string(&ret).unwrap();
    (StatusCode::BAD_REQUEST, ret)
}
