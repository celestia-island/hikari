use std::collections::HashMap;
use std::future::Future;
use std::path::PathBuf;

use axum::body::Body;
use axum::http::Request;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;
use clap::Parser;
use hyper::header::HeaderMap;
use hyper::server::Server;
use stylist::manager::{render_static, StyleManager};
use yew::platform::Runtime;
use yew::ServerRenderer;

use hikari_web::app::{AppProps, ServerApp};

#[derive(Parser, Debug)]
struct Opt {
    #[clap(short, long, parse(from_os_str))]
    dir: PathBuf,
}

async fn render(url: Request<Body>) -> impl IntoResponse {
    let (writer, reader) = render_static();
    let uri = url.uri().to_string();

    let renderer = ServerRenderer::<ServerApp>::with_props(move || {
        let manager = StyleManager::builder().writer(writer).build().unwrap();
        AppProps {
            manager,
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

    // TODO - Replace format! to string builder
    let mut headers = HeaderMap::new();
    headers.insert(hyper::header::CONTENT_TYPE, "text/html".parse().unwrap());
    (
        headers,
        format!(
            r#"
        <head>
            {style_raw}
        </head>
        <body>
            {html_raw}
            <script src='/static/js'></script>
            <script>wasm_bindgen('/static/wasm');</script>
        </body>
        "#
        ),
    )
}

#[derive(Clone, Default)]
struct Executor {
    inner: Runtime,
}

impl<F> hyper::rt::Executor<F> for Executor
where
    F: Future + Send + 'static,
{
    fn execute(&self, fut: F) {
        self.inner.spawn_pinned(move || async move {
            fut.await;
        });
    }
}

#[tokio::main]
async fn main() {
    let exec = Executor::default();
    env_logger::init();

    let app = Router::new()
        .route(
            "/static/js",
            get(|| async move {
                include_str!("../../../../target/wasm32-unknown-unknown/release/dist/hikari-web.js")
            }),
        )
        .route(
            "/static/wasm",
            get(|| async move {
                let mut headers = HeaderMap::new();
                headers.insert(
                    hyper::header::CONTENT_TYPE,
                    "application/wasm".parse().unwrap(),
                );
                (
                    headers,
                    include_bytes!(
                        "../../../../target/wasm32-unknown-unknown/release/dist/hikari-web_bg.wasm"
                    )
                    .to_vec(),
                )
            }),
        )
        .fallback(render);

    println!("Site is running: http://localhost:80/");

    Server::bind(&"127.0.0.1:80".parse().unwrap())
        .executor(exec)
        .serve(app.into_make_service())
        .await
        .unwrap();
}
