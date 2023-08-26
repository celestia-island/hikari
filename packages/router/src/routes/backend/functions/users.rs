use anyhow::Result;
use hyper::StatusCode;
use serde_json::to_string;

use axum::{routing::post, Json, Router};

use crate::routes::utils::{generate_error_message, generate_ok_message};
use hikari_database::functions::user as functions;
use hikari_utils::types::{response::Count, RequestPackage, ResponsePackage, ResponseStruct};

async fn query(Json(item): Json<RequestPackage>) -> Result<String, (StatusCode, String)> {
    let item = match &item {
        RequestPackage::Uuid(item) => item.to_owned(),
        _ => return Err(generate_error_message("Invalid request".to_string())),
    };

    let ret = functions::query(item.uuid)
        .await
        .or_else(|e| Err(generate_error_message(e.to_string())))?;

    let ret = ResponsePackage::Data(vec![ResponseStruct::UserInfo(ret.into())]);
    to_string(&ret).or_else(|e| Err(generate_error_message(e.to_string())))
}

async fn count() -> Result<String, (StatusCode, String)> {
    let ret = functions::count()
        .await
        .or_else(|e| Err(generate_error_message(e.to_string())))?;
    let ret = Count { count: ret };

    let ret = ResponsePackage::Data(vec![ResponseStruct::Count(ret)]);
    to_string(&ret).or_else(|e| Err(generate_error_message(e.to_string())))
}

async fn list(Json(item): Json<RequestPackage>) -> Result<String, (StatusCode, String)> {
    let cond = match &item {
        RequestPackage::LimitOffset(item) => item.to_owned(),
        _ => return Err(generate_error_message("Invalid request".to_string())),
    };

    let ret = functions::list(cond.offset, cond.limit)
        .await
        .or_else(|e| Err(generate_error_message(e.to_string())))?;

    let ret = ResponsePackage::Data(
        ret.iter()
            .map(|item| ResponseStruct::UserInfo(item.clone().into()))
            .collect(),
    );
    to_string(&ret).or_else(|e| Err(generate_error_message(e.to_string())))
}

async fn insert(Json(item): Json<RequestPackage>) -> Result<String, (StatusCode, String)> {
    let item = match &item {
        RequestPackage::UserInfo(item) => item.to_owned(),
        _ => return Err(generate_error_message("Invalid request".to_string())),
    };

    functions::insert(item.into())
        .await
        .or_else(|e| Err(generate_error_message(e.to_string())))?;

    generate_ok_message()
}

async fn update(Json(item): Json<RequestPackage>) -> Result<String, (StatusCode, String)> {
    let item = match &item {
        RequestPackage::UserInfo(item) => item.to_owned(),
        _ => return Err(generate_error_message("Invalid request".to_string())),
    };

    functions::update(item.into())
        .await
        .or_else(|e| Err(generate_error_message(e.to_string())))?;

    generate_ok_message()
}

async fn delete(Json(item): Json<RequestPackage>) -> Result<String, (StatusCode, String)> {
    let item = match &item {
        RequestPackage::Uuid(item) => item.to_owned(),
        _ => return Err(generate_error_message("Invalid request".to_string())),
    };

    functions::delete(item.uuid)
        .await
        .or_else(|e| Err(generate_error_message(e.to_string())))?;

    generate_ok_message()
}

pub async fn route() -> Result<Router> {
    let router = Router::new()
        .route("/count", post(count))
        .route("/query", post(query))
        .route("/list", post(list))
        .route("/insert", post(insert))
        .route("/update", post(update))
        .route("/delete", post(delete));

    Ok(router)
}
