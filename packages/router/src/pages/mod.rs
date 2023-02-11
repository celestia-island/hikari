mod personal;
mod portal;
mod thread;

use base64::Engine;
use log::info;
use std::collections::HashMap;

use axum::{body::Body, http::Request, response::IntoResponse};
use hyper::header::HeaderMap;
use stylist::manager::{render_static, StyleManager};
use yew::ServerRenderer;

use self::{personal::query_personal, portal::query_portal, thread::query_thread};
use hikari_web::{app::ServerApp, utils::app_props::AppProps};

pub async fn render(req: Request<Body>) -> Result<impl IntoResponse, Box<dyn std::error::Error>> {
    info!("{:?}", req);
    let (writer, reader) = render_static();
    let uri = req.uri().to_string();
    let page_data = match req.uri().path().split('/').nth(1).unwrap_or("") {
        "u" => query_personal(&req).await?,
        "t" => query_thread(&req).await?,
        _ => query_portal(&req).await?,
    };
    let page_data_raw = serde_json::to_string(&page_data)?;
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
            page_data,
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
    body.push_str(&html_raw);
    body.push_str("<script>");
    body.push_str("window.__ssr_page_data = \"");
    body.push_str(&page_data_raw);
    body.push_str("\";");
    body.push_str("</script>");
    body.push_str("<script src='/res/entry/js'></script>");
    body.push_str("<script>__wasm_vendor_entry('/res/entry/wasm');</script>");
    body.push_str("</body>");

    Ok((headers, body))
}
