mod personal;
mod portal;
mod thread;

use anyhow::Result;
use base64::Engine;
use log::info;
use std::collections::HashMap;

use axum::{body::Body, http::Request, response::IntoResponse, routing::get, Router};
use hyper::header::HeaderMap;
use stylist::manager::{render_static, StyleManager};
use yew::ServerRenderer;

use hikari_web::{
    app::ServerApp,
    utils::{app_props::AppProps, contexts::app_props::AppPageProps},
};

pub async fn render(req: Request<Body>, props: AppPageProps) -> Result<impl IntoResponse> {
    info!("{:?}", req);
    let (writer, reader) = render_static();
    let uri = req.uri().to_string();
    let page_data_raw = serde_json::to_string(&props)?;
    let page_data_raw = base64::engine::general_purpose::STANDARD_NO_PAD.encode(page_data_raw);

    let renderer = ServerRenderer::<ServerApp>::with_props(move || {
        let style_manager = StyleManager::builder().writer(writer).build().unwrap();
        AppProps {
            style_manager,
            url: uri.into(),
            queries: req.uri().query().map_or_else(HashMap::new, |q| {
                url::form_urlencoded::parse(q.as_bytes())
                    .into_owned()
                    .collect()
            }),
            page_data: props.to_owned(),
        }
    });
    let html_raw = renderer.render().await;

    let style_data = reader.read_style_data();
    let mut style_raw = String::new();
    style_data.write_static_markup(&mut style_raw).unwrap();

    let mut headers = HeaderMap::new();
    headers.insert(hyper::header::CONTENT_TYPE, "text/html".parse().unwrap());
    let mut body = String::new();
    body.push_str("<head>");
    body.push_str(&style_raw);
    body.push_str("</head>");
    body.push_str("<body>");
    body.push_str("<textarea id='__ssr_data' style='display: none;'>");
    body.push_str(&page_data_raw);
    body.push_str("</textarea>");
    body.push_str("<div id='app' style='width: 100vw; height: 100vh; position: fixed;'>");
    body.push_str(&html_raw);
    body.push_str("<script src='/a.js'></script>");
    body.push_str(
        "<script>(async () => {await __wasm_vendor_entry('./a.wasm');(await (new __wasm_vendor_entry.WebHandle())).start();})()</script>",
    );
    body.push_str("</div>");
    body.push_str("</body>");

    Ok((headers, body))
}

pub async fn route() -> Result<Router> {
    let router = Router::new()
        .route("/", get(portal::query))
        .route("/t", get(thread::query))
        .route("/u", get(personal::query));

    Ok(router)
}
