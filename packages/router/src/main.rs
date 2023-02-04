use log::info;
use std::future::Future;
use std::{collections::HashMap, path::Path};

use axum::{
    body::Body,
    http::{Request, StatusCode},
    response::IntoResponse,
    routing::get_service,
    Router,
};
use hyper::{header::HeaderMap, server::Server};
use stylist::manager::{render_static, StyleManager};
use tower::ServiceBuilder;
use tower_http::{
    compression::CompressionLayer,
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};
use yew::{platform::Runtime, ServerRenderer};

use hikari_web::app::{AppProps, ServerApp};

async fn render(url: Request<Body>) -> impl IntoResponse {
    info!("{:?}", url);
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
            <script src='/res/entry/js'></script>
            <script>wasm_bindgen('/res/entry/wasm');</script>
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
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    env_logger::Builder::new()
        .filter(None, log::LevelFilter::Info)
        .init();

    let port = std::env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(80);
    let root_dir = std::env::var("ROOT_DIR")
        .ok()
        .and_then(|dir| Some(Path::new(&dir).to_path_buf()))
        .unwrap_or(std::env::current_dir()?.join("./target/web"));

    let middleware_stack = ServiceBuilder::new()
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .into_inner();

    let app = Router::new()
        .route_service(
            "/res/entry/js",
            get_service(ServeFile::new(root_dir.clone().join("./a.js")))
                .handle_error(handle_static_file_error),
        )
        .route_service(
            "/res/entry/wasm",
            get_service(ServeFile::new(root_dir.clone().join("./a.wasm")))
                .handle_error(handle_static_file_error),
        )
        .route_service(
            "/favicon.ico",
            get_service(ServeFile::new(root_dir.clone().join("./favicon.ico")))
                .handle_error(handle_static_file_error),
        )
        .nest_service(
            "/res",
            get_service(ServeDir::new(root_dir.clone())).handle_error(handle_static_file_error),
        )
        .fallback(render)
        .layer(middleware_stack);

    hikari_database::init().await?;

    info!("Root dir is \"{}\".", root_dir.display());
    info!("Site will run on port {}.", port);

    Server::bind(&format!("0.0.0.0:{}", port).parse()?)
        .executor(Executor::default())
        .serve(app.into_make_service())
        .await?;

    Ok(())
}
