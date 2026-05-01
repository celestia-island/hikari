// hikari-e2e/src/debug_client.rs
// Async HTTP client for Tairitsu Debug Browser Automation API (wry-based)
// Covers all 17 endpoints: health, info, ready, navigate, screenshot, click, type,
//   press, scroll, evaluate, console, dom, dom/computed, viewport, resize, errors

use anyhow::{bail, Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::time::Duration;

pub const DEFAULT_DEBUG_PORT: u16 = 3001;
const HEALTH_POLL_INTERVAL_MS: u64 = 500;
const HEALTH_POLL_TIMEOUT_SECS: u64 = 60;

#[derive(Debug, Clone)]
pub struct DebugClient {
    http: Client,
    base_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(bound = "T: serde::de::DeserializeOwned")]
pub struct ApiResponse<T: serde::de::DeserializeOwned> {
    pub ok: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T: serde::de::DeserializeOwned> ApiResponse<T> {
    fn into_result(self) -> Result<T> {
        if self.ok {
            self.data.context("API returned ok=true but no data")
        } else {
            bail!("Debug API error: {}", self.error.unwrap_or_else(|| "unknown".into()))
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct HealthData {
    pub status: String,
    pub version: String,
    #[serde(rename = "api_version")]
    pub api_version: String,
    #[serde(rename = "uptime_secs")]
    pub uptime_secs: u64,
}

#[derive(Debug, Deserialize)]
pub struct InfoData {
    pub version: String,
    #[serde(rename = "api_version")]
    pub api_version: String,
    #[serde(rename = "dev_port")]
    pub dev_port: u16,
    #[serde(rename = "debug_port")]
    pub debug_port: u16,
    #[serde(rename = "dist_dir")]
    pub dist_dir: String,
    #[serde(rename = "package_name")]
    pub package_name: String,
    pub pid: u32,
    #[serde(rename = "started_at_iso")]
    pub started_at_iso: String,
    #[serde(rename = "uptime_secs")]
    pub uptime_secs: u64,
    #[serde(rename = "browser_connected")]
    pub browser_connected: bool,
    #[serde(rename = "browser_engine")]
    pub browser_engine: String,
    pub viewport: [u32; 2],
}

#[derive(Debug, Deserialize)]
pub struct NavigateResponse {
    pub url: String,
    pub title: String,
}

#[derive(Debug, Serialize)]
pub struct NavigateRequest {
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wait_for: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ScreenshotResponse {
    #[serde(with = "serde_base64")]
    pub data: Vec<u8>,
    #[serde(rename = "mime_type")]
    pub mime_type: String,
    pub width: u32,
    pub height: u32,
    #[serde(default)]
    pub mode: String,
}

mod serde_base64 {
    use serde::{self, Deserialize, Deserializer};
    use base64::Engine as _;

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<u8>, D::Error>
    where D: Deserializer<'de> {
        let s = String::deserialize(deserializer)?;
        base64::engine::general_purpose::STANDARD
            .decode(&s).map_err(serde::de::Error::custom)
    }
}

#[derive(Debug, Serialize, Default)]
pub struct ScreenshotRequest {
    pub selector: Option<String>,
    #[serde(rename = "full_page")]
    pub full_page: Option<bool>,
    pub format: Option<String>,
    pub mode: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ClickRequest {
    pub selector: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub button: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modifiers: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct TypeRequest {
    pub selector: String,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub clear_first: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub submit: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct EvaluateRequest {
    pub expression: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "await_promise")]
    pub await_promise: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct EvaluateResponse {
    pub result: serde_json::Value,
    #[serde(rename = "type")]
    pub result_type: String,
}

#[derive(Debug, Deserialize)]
pub struct ConsoleEntry {
    pub level: String,
    pub text: String,
    pub timestamp: String,
    #[serde(default)]
    pub source: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RectData {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    #[serde(default)]
    pub children_visible: Option<usize>,
    #[serde(default)]
    pub overflowing: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct DomQueryData {
    #[serde(default)]
    pub tag: Option<String>,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub html: Option<String>,
    #[serde(default)]
    pub attributes: HashMap<String, serde_json::Value>,
    #[serde(default)]
    pub visible: Option<bool>,
    pub count: usize,
    #[serde(default)]
    pub rect: Option<RectData>,
    #[serde(default)]
    pub computed: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Deserialize)]
pub struct ReadyResponse {
    pub ready: bool,
    #[serde(rename = "wasm_loaded")]
    pub wasm_loaded: bool,
    pub hydrated: bool,
    pub url: String,
}

#[derive(Debug, Serialize)]
pub struct ComputedStyleRequest {
    pub selector: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub properties: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct ComputedStyleResponse {
    pub selector: String,
    pub properties: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct PressRequest {
    pub key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modifiers: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub count: Option<u32>,
}

#[derive(Debug, Serialize, Default)]
pub struct ScrollRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selector: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub x: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub y: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direction: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount: Option<f64>,
}

#[derive(Debug, Serialize, Default)]
pub struct ResizeRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preset: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ViewportResponse {
    pub width: u32,
    pub height: u32,
    #[serde(rename = "device_pixel_ratio")]
    pub device_pixel_ratio: f64,
}

#[derive(Debug, Deserialize)]
pub struct ErrorEntry {
    pub message: String,
    #[serde(default)]
    pub stack: Option<String>,
    #[serde(rename = "type")]
    pub error_type: String,
    pub timestamp: String,
}

#[derive(Debug, Deserialize)]
pub struct ErrorsResponse {
    pub errors: Vec<ErrorEntry>,
    #[serde(rename = "unhandled_rejections")]
    pub unhandled_rejections: Vec<ErrorEntry>,
}

impl DebugClient {
    pub fn new(port: u16) -> Self {
        Self {
            http: Client::builder().timeout(Duration::from_secs(30)).build().unwrap(),
            base_url: format!("http://127.0.0.1:{}", port),
        }
    }

    pub fn with_base_url(base_url: impl Into<String>) -> Self {
        Self {
            http: Client::builder().timeout(Duration::from_secs(30)).build().unwrap(),
            base_url: base_url.into(),
        }
    }

    pub fn default() -> Self { Self::new(DEFAULT_DEBUG_PORT) }

    pub fn port(&self) -> u16 {
        self.base_url.rsplit(':').next().and_then(|p| p.parse().ok()).unwrap_or(DEFAULT_DEBUG_PORT)
    }

    pub fn base_url(&self) -> &str { &self.base_url }

    // ── GET /health ──────────────────────────────────────────────
    pub async fn health(&self) -> Result<HealthData> { self.get("/health").await }

    // ── GET /info ────────────────────────────────────────────────
    pub async fn info(&self) -> Result<InfoData> { self.get("/info").await }

    // ── GET /ready ──────────────────────────────────────────────
    pub async fn ready(&self) -> Result<ReadyResponse> { self.get("/ready").await }

    // ── POST /navigate ──────────────────────────────────────────
    pub async fn navigate(&self, url: &str) -> Result<NavigateResponse> {
        self.post("/navigate", &NavigateRequest { url: url.to_string(), wait_for: None }).await
    }

    pub async fn navigate_wait(&self, url: &str, wait_for: &str) -> Result<NavigateResponse> {
        self.post("/navigate", &NavigateRequest { url: url.to_string(), wait_for: Some(wait_for.to_string()) }).await
    }

    pub async fn navigate_hydrated(&self, url: &str) -> Result<NavigateResponse> {
        self.navigate_wait(url, "hydration").await
    }

    // ── POST /screenshot ────────────────────────────────────────
    pub async fn screenshot(&self, req: &ScreenshotRequest) -> Result<ScreenshotResponse> {
        self.post("/screenshot", req).await
    }

    pub async fn screenshot_viewport(&self) -> Result<ScreenshotResponse> {
        self.screenshot(&ScreenshotRequest::default()).await
    }

    pub async fn screenshot_element(&self, selector: &str) -> Result<ScreenshotResponse> {
        self.screenshot(&ScreenshotRequest { selector: Some(selector.to_string()), ..Default::default() }).await
    }

    pub async fn screenshot_full_page(&self) -> Result<ScreenshotResponse> {
        self.screenshot(&ScreenshotRequest { full_page: Some(true), format: Some("png".into()), ..Default::default() }).await
    }

    pub async fn screenshot_pixel(&self) -> Result<ScreenshotResponse> {
        self.screenshot(&ScreenshotRequest { mode: Some("pixel".into()), format: Some("png".into()), ..Default::default() }).await
    }

    pub async fn screenshot_pixel_full_page(&self) -> Result<ScreenshotResponse> {
        self.screenshot(&ScreenshotRequest { full_page: Some(true), mode: Some("pixel".into()), format: Some("png".into()), ..Default::default() }).await
    }

    // ── POST /click ─────────────────────────────────────────────
    pub async fn click(&self, selector: &str) -> Result<()> {
        let r: ApiResponse<serde_json::Value> = self.raw_post("/click", &ClickRequest { selector: selector.to_string(), button: None, modifiers: None }).await?;
        check_ok(r)
    }

    // ── POST /type ──────────────────────────────────────────────
    pub async fn type_text(&self, selector: &str, text: &str) -> Result<()> {
        let r: ApiResponse<serde_json::Value> = self.raw_post("/type", &TypeRequest { selector: selector.to_string(), text: text.to_string(), clear_first: None, submit: None }).await?;
        check_ok(r)
    }

    // ── POST /press ─────────────────────────────────────────────
    pub async fn press(&self, key: &str) -> Result<()> {
        self.press_with(key, None, None).await
    }

    pub async fn press_with(&self, key: &str, modifiers: Option<Vec<String>>, count: Option<u32>) -> Result<()> {
        let r: ApiResponse<serde_json::Value> = self.raw_post("/press", &PressRequest { key: key.to_string(), modifiers, count }).await?;
        check_ok(r)
    }

    // ── POST /scroll ────────────────────────────────────────────
    pub async fn scroll(&self, req: &ScrollRequest) -> Result<()> {
        let r: ApiResponse<serde_json::Value> = self.raw_post("/scroll", req).await?;
        check_ok(r)
    }

    pub async fn scroll_by(&self, x: f64, y: f64) -> Result<()> {
        self.scroll(&ScrollRequest { x: Some(x), y: Some(y), ..Default::default() }).await
    }

    pub async fn scroll_direction(&self, direction: &str, amount: f64) -> Result<()> {
        self.scroll(&ScrollRequest { direction: Some(direction.to_string()), amount: Some(amount), ..Default::default() }).await
    }

    // ── POST /evaluate ──────────────────────────────────────────
    pub async fn evaluate(&self, expression: &str) -> Result<EvaluateResponse> {
        self.post("/evaluate", &EvaluateRequest { expression: expression.to_string(), await_promise: None }).await
    }

    pub async fn evaluate_async(&self, expression: &str) -> Result<EvaluateResponse> {
        self.post("/evaluate", &EvaluateRequest { expression: expression.to_string(), await_promise: Some(true) }).await
    }

    // ── GET /console ────────────────────────────────────────────
    pub async fn console(&self) -> Result<Vec<ConsoleEntry>> {
        self.console_filtered(None, None, None).await
    }

    pub async fn console_filtered(&self, level: Option<&str>, source: Option<&str>, limit: Option<usize>) -> Result<Vec<ConsoleEntry>> {
        #[derive(Deserialize)] struct R { entries: Vec<ConsoleEntry> }
        let mut q: Vec<(String, String)> = vec![];
        if let Some(l) = level { q.push(("level".into(), l.into())) }
        if let Some(s) = source { q.push(("source".into(), s.into())) }
        if let Some(n) = limit { q.push(("limit".into(), n.to_string())) }
        let resp: ApiResponse<R> = self.http
            .get(format!("{}/console", self.base_url))
            .query(&q).send().await?.json().await?;
        resp.into_result().map(|r| r.entries)
    }

    // ── DELETE /console ─────────────────────────────────────────
    pub async fn console_clear(&self) -> Result<()> {
        let r: ApiResponse<serde_json::Value> = self.http.delete(format!("{}/console", self.base_url)).send().await?.json().await?;
        check_ok(r)
    }

    // ── GET /dom ────────────────────────────────────────────────
    pub async fn dom_query(&self, selector: &str) -> Result<DomQueryData> {
        let resp: ApiResponse<DomQueryData> = self.http
            .get(format!("{}/dom", self.base_url))
            .query(&[("selector", selector)])
            .send().await?.json().await?;
        resp.into_result()
    }

    pub async fn dom_attribute(&self, selector: &str, attr: &str) -> Result<Option<String>> {
        let data = self.dom_query(selector).await?;
        Ok(data.attributes.get(attr).and_then(|v| v.as_str()).map(|s| s.to_string()))
    }

    // ── POST /dom/computed ──────────────────────────────────────
    pub async fn computed_style(&self, selector: &str, properties: &[&str]) -> Result<HashMap<String, serde_json::Value>> {
        let props: Vec<String> = properties.iter().map(|s| s.to_string()).collect();
        let resp: ApiResponse<ComputedStyleResponse> = self.post("/dom/computed",
            &ComputedStyleRequest { selector: selector.to_string(), properties: Some(props) }).await?;
        resp.into_result().map(|r| r.properties)
    }

    pub async fn computed_style_one(&self, selector: &str, property: &str) -> Result<Option<String>> {
        let map = self.computed_style(selector, &[property]).await?;
        Ok(map.get(property).and_then(|v| v.as_str()).map(|s| s.to_string()))
    }

    // ── GET /viewport ───────────────────────────────────────────
    pub async fn viewport(&self) -> Result<ViewportResponse> { self.get("/viewport").await }

    // ── POST /resize ────────────────────────────────────────────
    pub async fn resize(&self, width: u32, height: u32) -> Result<()> {
        let r: ApiResponse<serde_json::Value> = self.raw_post("/resize",
            &ResizeRequest { width: Some(width), height: Some(height), preset: None }).await?;
        check_ok(r)
    }

    pub async fn resize_preset(&self, preset: &str) -> Result<()> {
        let r: ApiResponse<serde_json::Value> = self.raw_post("/resize",
            &ResizeRequest { width: None, height: None, preset: Some(preset.to_string()) }).await?;
        check_ok(r)
    }

    // ── GET /errors ─────────────────────────────────────────────
    pub async fn errors(&self) -> Result<ErrorsResponse> { self.get("/errors").await }

    // ── Wait helpers ────────────────────────────────────────────

    pub async fn wait_for_ready(&self) -> Result<()> {
        let start = std::time::Instant::now();
        while start.elapsed().as_secs() < HEALTH_POLL_TIMEOUT_SECS {
            match self.health().await {
                Ok(h) if h.status == "ok" => return Ok(()),
                _ => tokio::time::sleep(Duration::from_millis(HEALTH_POLL_INTERVAL_MS)).await,
            }
        }
        bail!("Debug server at {} not ready after {}s", self.base_url, HEALTH_POLL_TIMEOUT_SECS)
    }

    pub async fn wait_for_hydration(&self, timeout_secs: u64) -> Result<ReadyResponse> {
        let start = std::time::Instant::now();
        while start.elapsed().as_secs() < timeout_secs {
            match self.ready().await {
                Ok(r) if r.ready => return Ok(r),
                Ok(_) => tokio::time::sleep(Duration::from_millis(300)).await,
                Err(_) => tokio::time::sleep(Duration::from_millis(300)).await,
            }
        }
        bail!("Hydration not complete after {}s", timeout_secs)
    }

    // ── Screenshot save helpers ─────────────────────────────────

    pub async fn save_screenshot(&self, path: impl AsRef<Path>, req: &ScreenshotRequest) -> Result<(u32, u32)> {
        let resp = self.screenshot(req).await?;
        std::fs::write(path.as_ref(), &resp.data)
            .with_context(|| format!("Failed to write screenshot to {}", path.as_ref().display()))?;
        Ok((resp.width, resp.height))
    }

    pub async fn save_screenshot_viewport(&self, path: impl AsRef<Path>) -> Result<(u32, u32)> {
        self.save_screenshot(path, &ScreenshotRequest::default()).await
    }

    pub async fn save_screenshot_pixel(&self, path: impl AsRef<Path>) -> Result<(u32, u32)> {
        self.save_screenshot(path, &ScreenshotRequest { mode: Some("pixel".into()), format: Some("png".into()), ..Default::default() }).await
    }

    pub async fn save_screenshot_full_page(&self, path: impl AsRef<Path>) -> Result<(u32, u32)> {
        self.save_screenshot(path, &ScreenshotRequest { full_page: Some(true), format: Some("png".into()), ..Default::default() }).await
    }

    // ── Internal HTTP helpers ───────────────────────────────────

    async fn get<T: serde::de::DeserializeOwned>(&self, path: &str) -> Result<T> {
        let resp: ApiResponse<T> = self.http.get(format!("{}{}", self.base_url, path)).send().await?.json().await?;
        resp.into_result()
    }

    async fn post<T: serde::de::DeserializeOwned, B: Serialize>(&self, path: &str, body: &B) -> Result<T> {
        let resp: ApiResponse<T> = self.http.post(format!("{}{}", self.base_url, path)).json(body).send().await?.json().await?;
        resp.into_result()
    }

    async fn raw_post<T: serde::de::DeserializeOwned, B: Serialize>(&self, path: &str, body: &B) -> Result<ApiResponse<T>> {
        Ok(self.http.post(format!("{}{}", self.base_url, path)).json(body).send().await?.json().await?)
    }
}

fn check_ok(r: ApiResponse<serde_json::Value>) -> Result<()> {
    if r.ok { Ok(()) } else { bail!("API error: {:?}", r.error) }
}
