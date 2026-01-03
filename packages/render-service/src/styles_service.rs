// hikari-render-service/src/styles_service.rs
// CSS 服务 - 提供 CSS 样式的 HTTP 端点

use std::sync::Arc;

use axum::{
    extract::State,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
};

use crate::registry::StyleRegistry;

/// CSS 服务
///
/// 提供 CSS 样式的 HTTP 端点
#[derive(Clone)]
pub struct StyleService {
    registry: Arc<StyleRegistry>,
}

impl StyleService {
    /// 创建新的 CSS 服务
    pub fn new(registry: StyleRegistry) -> Self {
        Self {
            registry: Arc::new(registry),
        }
    }

    /// 获取聚合的 CSS 样式（所有已注册组件）
    ///
    /// 端点: `/styles/bundle.css`
    pub async fn css_bundle(State(state): State<Self>) -> impl IntoResponse {
        let css = state.registry.css_bundle();

        Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "text/css; charset=utf-8")
            .header(header::CACHE_CONTROL, "public, max-age=3600")
            .body(css)
            .unwrap()
    }

    /// 获取单个组件的 CSS 样式
    ///
    /// 端点: `/styles/components/:name.css`
    pub async fn component_css(
        State(state): State<Self>,
        axum::extract::Path(name): axum::extract::Path<String>,
    ) -> impl IntoResponse {
        match state.registry.get(&name) {
            Some(css) => Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "text/css; charset=utf-8")
                .header(header::CACHE_CONTROL, "public, max-age=3600")
                .body(css.to_string())
                .unwrap(),
            None => {
                let not_found_css = format!("/* Component '{}' not found */", name);
                Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .header(header::CONTENT_TYPE, "text/css; charset=utf-8")
                    .body(not_found_css)
                    .unwrap()
            }
        }
    }

    /// 获取样式注册表信息
    ///
    /// 端点: `/styles/info`
    pub async fn style_info(State(state): State<Self>) -> impl IntoResponse {
        let info = serde_json::json!({
            "total_components": state.registry.len(),
            "components": {
                "basic": {
                    "button": state.registry.has("button"),
                    "input": state.registry.has("input"),
                    "card": state.registry.has("card"),
                    "badge": state.registry.has("badge"),
                },
                "data": {
                    "table": state.registry.has("table"),
                    "tree": state.registry.has("tree"),
                    "pagination": state.registry.has("pagination"),
                    "virtual-scroll": state.registry.has("virtual-scroll"),
                    "collapse": state.registry.has("collapse"),
                    "drag": state.registry.has("drag"),
                    "sort": state.registry.has("sort"),
                    "filter": state.registry.has("filter"),
                    "selection": state.registry.has("selection"),
                },
                "feedback": {
                    "alert": state.registry.has("alert"),
                    "toast": state.registry.has("toast"),
                    "tooltip": state.registry.has("tooltip"),
                },
                "navigation": {
                    "menu": state.registry.has("menu"),
                    "tabs": state.registry.has("tabs"),
                    "breadcrumb": state.registry.has("breadcrumb"),
                }
            }
        });

        Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "application/json")
            .body(info.to_string())
            .unwrap()
    }
}
