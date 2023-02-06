mod personal;
mod portal;
mod thread;

use log::info;
use std::collections::HashMap;

use axum::{body::Body, http::Request, response::IntoResponse};
use hyper::header::HeaderMap;
use stylist::manager::{render_static, StyleManager};
use yew::ServerRenderer;

use self::{personal::query_personal, portal::query_portal, thread::query_thread};
use hikari_web::app::{AppProps, ServerApp};

pub async fn render(url: Request<Body>) -> Result<impl IntoResponse, Box<dyn std::error::Error>> {
    info!("{:?}", url);
    let (writer, reader) = render_static();
    let uri = url.uri().to_string();

    let renderer = ServerRenderer::<ServerApp>::with_props(move || {
        let manager = StyleManager::builder().writer(writer).build().unwrap();
        AppProps {
            style_manager: manager,
            url: uri.into(),
            queries: url.uri().query().map_or_else(HashMap::new, |q| {
                url::form_urlencoded::parse(q.as_bytes())
                    .into_owned()
                    .collect()
            }),
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
    body.push_str("<script src='/res/entry/js'></script>");
    body.push_str("<script>wasm_bindgen('/res/entry/wasm');</script>");
    body.push_str("</body>");

    Ok((headers, body))
}
