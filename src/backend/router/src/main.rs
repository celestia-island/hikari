use std::collections::HashMap;
use std::fs::read;
use std::future::Future;

use axum::{
    body::Body,
    http::{Request, StatusCode},
    response::IntoResponse,
    routing::{get, get_service},
    Router,
};
use hyper::{header::HeaderMap, server::Server};
use stylist::manager::{render_static, StyleManager};
use tower::ServiceBuilder;
use tower_http::{compression::CompressionLayer, services::ServeFile, trace::TraceLayer};
use yew::{platform::Runtime, ServerRenderer};

use hikari_web::app::{AppProps, ServerApp};

async fn render(url: Request<Body>) -> impl IntoResponse {
    println!("{:?}", url);
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

async fn handle_static_file_error(err: std::io::Error) -> impl IntoResponse {
    (StatusCode::INTERNAL_SERVER_ERROR, err.to_string())
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

    let wasm_wrapper_raw = read("/home/dist/a.js").unwrap();
    let wasm_raw = read("/home/dist/a.wasm").unwrap();

    let middleware_stack = ServiceBuilder::new()
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .into_inner();

    let app = Router::new()
        .route("/static/js", get(|| async move { wasm_wrapper_raw }))
        .route(
            "/static/wasm",
            get(|| async move {
                let mut headers = HeaderMap::new();
                headers.insert(
                    hyper::header::CONTENT_TYPE,
                    "application/wasm".parse().unwrap(),
                );
                (headers, wasm_raw)
            }),
        )
        .nest_service(
            "/favicon.ico",
            get_service(ServeFile::new("/home/res/favicon.ico"))
                .handle_error(handle_static_file_error),
        )
        .fallback(render)
        .layer(middleware_stack);

    println!("Site will run on port 80.");

    Server::bind(&"0.0.0.0:80".parse().unwrap())
        .executor(exec)
        .serve(app.into_make_service())
        .await
        .unwrap();
}
