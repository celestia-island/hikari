// hikari-e2e/src/bin/visual_debug_wry.rs
// Visual debugging via Tairitsu Debug Browser Automation (wry-based)
// Uses all 28 debug API endpoints including pixel screenshots, hydration wait,
// computed styles, batch operations, a11y tree, network/perf observability

use anyhow::{Context, Result, bail};
use base64::{Engine as _, engine::general_purpose};
use clap::{Parser, Subcommand};
use hikari_e2e::debug_client::{
    DebugClient, ScreenshotRequest, BatchOp,
    ReadyResponse, ViewportResponse, ErrorsResponse,
    PerformanceMetrics, NetworkResponse, A11yNode,
};
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

const DEFAULT_DEV_PORT: u16 = 3000;
const DEFAULT_DEBUG_PORT: u16 = 3001;
const OUTPUT_DIR: &str = "wry_screenshots";

#[derive(Parser)]
#[command(name = "hikari-visual-debug-wry")]
#[command(about = "Hikari visual debugger powered by tairitsu-debug (wry WebView)")]
struct Cli {
    #[arg(long, default_value_t = DEFAULT_DEBUG_PORT)]
    debug_port: u16,

    #[arg(long, default_value_t = DEFAULT_DEV_PORT)]
    dev_port: u16,

    #[arg(long)]
    output: Option<PathBuf>,

    #[arg(long)]
    pixel: bool,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Capture {
        #[arg(long, default_value = "viewport")]
        mode: String,
        #[arg(long)]
        route: Option<String>,
        #[arg(long)]
        selector: Option<String>,
        #[arg(long)]
        full_page: bool,
    },
    Analyze {
        #[arg(long)]
        image: PathBuf,
        #[arg(long)]
        focus: Option<String>,
    },
    Batch {
        #[arg(long)]
        routes: Option<String>,
        #[arg(long)]
        output_json: bool,
    },
    Inspect {
        #[arg(long)]
        route: Option<String>,
        #[arg(long)]
        selector: Option<String>,
        #[arg(long)]
        computed: bool,
    },
    Interactive {
        #[arg(long)]
        route: String,
    },
    Health,
    Ready,
    Errors,
    Perf,
    Network,
    A11y,
    BatchRoutes,
}

const PREDEFINED_ROUTES: &[(&str, &str)] = &[
    ("/", "home"),
    ("/components", "components_overview"),
    ("/components/layer1", "layer1_basic"),
    ("/components/layer2", "layer2_data_form"),
    ("/components/layer3", "layer3_advanced"),
    ("/button", "button"),
    ("/input", "input"),
    ("/card", "card"),
    ("/table", "table"),
    ("/switch", "switch"),
    ("/palette", "palette"),
    ("/navigation", "navigation"),
    ("/guides/getting-started", "getting_started"),
];

fn output_dir(base: Option<&PathBuf>) -> PathBuf {
    base.cloned().unwrap_or_else(|| PathBuf::from(OUTPUT_DIR))
}

fn build_screenshot_req(
    mode: &str, selector: Option<&str>, full_page: bool, pixel: bool,
) -> ScreenshotRequest {
    let screenshot_mode = if pixel || mode == "pixel" { Some("pixel".into()) } else { None };
    ScreenshotRequest {
        selector: selector.map(|s| s.to_string()),
        full_page: if full_page || mode == "full_page" { Some(true) } else { None },
        format: Some("png".into()),
        mode: screenshot_mode,
    }
}

async fn do_capture(
    client: &DebugClient,
    out: &Path,
    mode: &str,
    route: Option<&String>,
    selector: Option<&String>,
    full_page: bool,
    pixel: bool,
) -> Result<()> {
    let url = match route {
        Some(r) => if r.starts_with('/') { r.clone() } else { format!("/{}", r) },
        None => "/".into(),
    };

    println!("Navigating to {} ...", url);
    let nav = client.navigate_hydrated(&url).await?;
    println!("Page title: {} (hydrated)", nav.title);

    let req = build_screenshot_req(mode, route.map(|s| s.as_str()), full_page, pixel);
    let filename = match (&route, &selector) {
        (Some(r), Some(s)) => format!("{}_{}.png", r.trim_start_matches('/').replace('/', "_"), s.replace(['#', '.', ' '], "_")),
        (Some(r), None) => {
            let name = r.trim_start_matches('/').replace('/', "_");
            if name.is_empty() { "root".into() } else { format!("{}.png", name) }
        }
        (None, Some(s)) => format!("sel_{}.png", s.replace(['#', '.', ' '], "_")),
        (None, None) => "viewport.png".into(),
    };

    let path = out.join(&filename);
    let (w, h) = client.save_screenshot(&path, &req).await?;
    println!("Saved {} ({}x{}, mode={})", path.display(), w, h, req.mode.as_deref().unwrap_or("canvas"));
    Ok(())
}

async fn do_analyze(image: &Path, focus: Option<&String>) -> Result<()> {
    if !image.exists() { bail!("Image not found: {}", image.display()); }

    let prompt = match focus {
        Some(f) => format!(
            "Analyze this UI screenshot focusing on: {}. \
             1. Layout issues (misalignment, overflow, spacing) \
             2. Visual hierarchy and contrast \
             3. Component-specific bugs in the focused area \
             4. FUI (Future UI) polish: glow effects, modern feel \
             Return findings as JSON array with fields: severity, category, element, description, suggestion.",
            f
        ),
        None => "Analyze this UI screenshot for visual quality. Check layout, spacing, colors, typography, component alignment, and overall FUI polish. Return findings as JSON array with severity/category/element/description/suggestion.".into(),
    };

    let data = fs::read(image)?;
    let b64 = general_purpose::STANDARD.encode(&data);

    let api_key = std::env::var("OPENAI_API_KEY").unwrap_or_default();
    if api_key.is_empty() { bail!("OPENAI_API_KEY not set"); }

    let resp = reqwest::Client::new()
        .post("https://open.bigmodel.cn/api/paas/v4/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&json!({"model": "glm-5v-turbo", "messages": [
            {"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": format!("data:image/png;base64,{}", b64)}},
                {"type": "text", "text": prompt}
            ]}
        ], "max_tokens": 2048}))
        .send().await?.text().await?;

    let parsed: serde_json::Value = serde_json::from_str(&resp).context("Parse AI response")?;
    let content = parsed["choices"][0]["message"]["content"].as_str().unwrap_or("");
    println!("{}", content);

    let report_path = image.with_extension("analysis.json");
    fs::write(&report_path, json!({"image": image.to_string_lossy(), "focus": focus, "raw_response": parsed, "timestamp": chrono::Utc::now().to_rfc3339()}).to_string())?;
    println!("Report: {}", report_path.display());
    Ok(())
}

async fn do_batch(client: &DebugClient, out: &Path, routes_opt: Option<&String>, output_json: bool, pixel: bool) -> Result<()> {
    let routes: Vec<(String, String)> = match routes_opt {
        Some(s) => s.split(',').map(|r| r.trim().to_string()).filter(|r| !r.is_empty())
            .map(|r| (r.clone(), r.trim_start_matches('/').replace('/', "_"))).collect(),
        None => PREDEFINED_ROUTES.iter().map(|(p, n)| (p.to_string(), n.to_string())).collect(),
    };
    fs::create_dir_all(out)?;

    let mut results = vec![];
    let total = Instant::now();

    for (url, name) in &routes {
        let start = Instant::now();
        match do_capture(client, out, "full_page", Some(url), None, true, pixel).await {
            Ok(_) => {
                let e = start.elapsed();
                println!("OK   {:30} {:.2}s", name, e.as_secs_f64());
                results.push(json!({"route": url, "name": name, "status": "ok", "time_sec": e.as_secs_f64()}));
            }
            Err(e) => {
                eprintln!("FAIL {:30} {}", name, e);
                results.push(json!({"route": url, "name": name, "status": "error", "error": e.to_string()}));
            }
        }
    }

    if output_json {
        let report = json!({"engine": "tairitsu-debug-wry", "timestamp": chrono::Utc::now().to_rfc3339(), "total_time_secs": total.elapsed().as_secs_f64(), "total_routes": routes.len(), "pixel_mode": pixel, "results": results});
        fs::write(out.join("batch_report.json"), serde_json::to_string_pretty(&report)?)?;
        println!("Batch report: {}", out.join("batch_report.json").display());
    }

    println!("\nBatch complete: {}/{} in {:.2}s",
        results.iter().filter(|r| r["status"] == "ok").count(), results.len(), total.elapsed().as_secs_f64());
    Ok(())
}

async fn do_inspect(client: &DebugClient, route: Option<&String>, selector: Option<&String>, computed: bool) -> Result<()> {
    let url = route.as_deref().map_or("/", |v| v);
    println!("Navigating to {} ...", url);
    let _nav = client.navigate_hydrated(url).await?;

    if let Some(sel) = selector {
        let dom = client.dom_query(sel).await?;
        println!("\nDOM Query: '{}'", sel);
        println!("  Tag: <{}>", dom.tag.as_deref().unwrap_or("?"));
        if let Some(t) = &dom.text { println!("  Text: {}", t); }
        println!("  Visible: {}, Count: {}", dom.visible.unwrap_or(false), dom.count);
        if let Some(rect) = &dom.rect {
            println!("  Rect: {:.0}x{:.0} @ ({:.0},{:.0})", rect.width, rect.height, rect.x, rect.y);
            if let Some(cv) = rect.children_visible { println!("  Children visible: {}", cv); }
            if let Some(ov) = rect.overflowing { println!("  Overflowing: {}", ov); }
        }

        if computed {
            let glow_props = ["box-shadow", "filter", "background-image", "color", "opacity"];
            println!("\n  Computed styles:");
            match client.computed_style(sel, &glow_props).await {
                Ok(props) => {
                    for (k, v) in &props { println!("    {}: {}", k, v); }
                }
                Err(e) => println!("    (computed style error: {})", e),
            }

            if let Some(shadow) = client.computed_style_one(sel, "box-shadow").await? {
                println!("\n  FUI Glow check: box-shadow = {}", shadow);
                if shadow != "none" && !shadow.is_empty() {
                    println!("  ✅ Glow DETECTED");
                } else {
                    println!("  ⚠️  No glow on this element");
                }
            }
        }

        let out = output_dir(None);
        fs::create_dir_all(&out)?;
        let path = out.join(format!("inspect_{}.png", sel.replace(['#', '.', ' '], "_")));
        let (w, h) = client.save_screenshot_pixel(&path).await?;
        println!("\nPixel screenshot: {} ({}x{})", path.display(), w, h);
    } else {
        let info = client.info().await?;
        println!("\n── Server Info ──");
        println!("  Version: {} (api:{})", info.version, info.api_version);
        println!("  Ports: dev={} debug={}", info.dev_port, info.debug_port);
        println!("  Engine: {} | Connected: {}", info.browser_engine, info.browser_connected);
        println!("  Viewport: {}x{}", info.viewport[0], info.viewport[1]);
        println!("  PID: {} | Uptime: {}s", info.pid, info.uptime_secs);

        let ready: ReadyResponse = match client.ready().await {
            Ok(r) => r,
            Err(e) => { println!("\n  /ready: error ({})", e); ReadyResponse { ready: false, wasm_loaded: false, hydrated: false, url: String::new() } }
        };
        println!("\n── Hydration State ──");
        println!("  Ready: {} | WASM: {} | Hydrated: {}", ready.wasm_loaded, ready.wasm_loaded, ready.hydrated);

        let vp: ViewportResponse = match client.viewport().await {
            Ok(v) => v,
            Err(e) => { println!("\n  /viewport: error ({})", e); ViewportResponse { width: 0, height: 0, device_pixel_ratio: 1.0 } }
        };
        println!("\n── Viewport ──");
        println!("  {}x{} (dpr: {:.1})", vp.width, vp.height, vp.device_pixel_ratio);

        let errors: ErrorsResponse = match client.errors().await {
            Ok(e) => e,
            Err(e) => { println!("\n  /errors: error ({})", e); ErrorsResponse { errors: vec![], unhandled_rejections: vec![] } }
        };
        println!("\n── Errors ({}) / Rejections ({}) ──", errors.errors.len(), errors.unhandled_rejections.len());
        for err in &errors.errors {
            println!("  [{}] {} | stack: {:?}", err.error_type, err.message, err.stack.as_deref().map(|s| &s[..s.len().min(80)]));
        }

        let console = client.console_filtered(Some("error,warn"), None, Some(20)).await?;
        println!("\n── Console (error/warn, last 20) ──");
        if console.is_empty() { println!("  (clean)"); }
        for entry in &console {
            println!("  [{}] {} {}", entry.level, entry.source.as_deref().unwrap_or("-"), entry.text);
        }

        let eval = client.evaluate("document.querySelectorAll('*').length").await?;
        println!("\n── DOM ──");
        println!("  Elements: {}", eval.result);

        let out = output_dir(None);
        fs::create_dir_all(&out)?;
        let path = out.join("inspect_viewport.png");
        let (w, h) = client.save_screenshot_pixel(&path).await?;
        println!("\nPixel screenshot: {} ({}x{})", path.display(), w, h);
    }
    Ok(())
}

async fn do_interactive(client: &DebugClient, route: &str) -> Result<()> {
    let out = output_dir(None);
    fs::create_dir_all(&out)?;

    println!("Interactive session on route: {}", route);
    client.navigate_hydrated(route).await?;

    let initial_path = out.join("interactive_initial.png");
    client.save_screenshot_pixel(&initial_path).await?;
    println!("Initial pixel screenshot saved");

    let actions = [
        (".hi-sidebar-item:first-child", "nav_home", None as Option<&str>),
        (".hi-sidebar-item:nth-child(2)", "nav_components", None),
        (".hi-btn-primary", "btn_primary", Some("click")),
        (".hi-btn-secondary", "btn_secondary", Some("click")),
        (".hi-switch-input", "toggle_switch", Some("click")),
    ];

    for (sel, name, action) in &actions {
        println!("\nAction: {} on {} ...", action.unwrap_or("screenshot"), sel);
        match action {
            Some("click") => {
                if client.click(sel).await.is_ok() {
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                }
            }
            _ => {}
        }
        let path = out.join(format!("interactive_{}.png", name));
        let (w, h) = client.save_screenshot_pixel(&path).await?;
        println!("  → {} ({}x{})", path.display(), w, h);
    }

    let errs = client.errors().await?;
    println!("\n── Errors after interaction ──");
    if errs.errors.is_empty() && errs.unhandled_rejections.is_empty() {
        println!("  (clean)");
    } else {
        for e in &errs.errors { println!("  [{}] {}", e.error_type, e.message); }
        for e in &errs.unhandled_rejections { println!("  [rejection] {}", e.message); }
    }

    println!("\nScreenshots saved to {}", out.display());
    Ok(())
}

fn print_a11y_tree(nodes: &[A11yNode], depth: usize) {
    let indent = "  ".repeat(depth);
    for node in nodes {
        let role = node.role.as_deref().unwrap_or("?");
        let name = node.name.as_deref().unwrap_or("");
        let tag = node.tag.as_deref().unwrap_or("");
        let states = if node.states.is_empty() { String::new() } else { format!(" [{}]", node.states.join(",")) };
        println!("{}<{}> {} \"{}\"{}", indent, tag, role, name, states);
        if !node.children.is_empty() {
            print_a11y_tree(&node.children, depth + 1);
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let cli = Cli::parse();
    let out = output_dir(cli.output.as_ref());
    let client = DebugClient::new(cli.debug_port);

    match cli.command {
        Commands::Capture { mode, route, selector, full_page } => {
            fs::create_dir_all(&out)?;
            do_capture(&client, &out, &mode, route.as_ref(), selector.as_ref(), full_page, cli.pixel).await?
        }
        Commands::Analyze { image, focus } => do_analyze(&image, focus.as_ref()).await?,
        Commands::Batch { routes, output_json } => do_batch(&client, &out, routes.as_ref(), output_json, cli.pixel).await?,
        Commands::Inspect { route, selector, computed } => do_inspect(&client, route.as_ref(), selector.as_ref(), computed).await?,
        Commands::Interactive { route } => do_interactive(&client, &route).await?,
        Commands::Health => {
            print!("Health check port {} ... ", cli.debug_port);
            match client.health().await {
                Ok(h) => println!("OK (v{}, up {}s)", h.api_version, h.uptime_secs),
                Err(e) => { println!("FAIL: {}", e); client.wait_for_ready().await?; println!("Ready!"); }
            }
        }
        Commands::Ready => {
            print!("Hydration check port {} ... ", cli.debug_port);
            match client.ready().await {
                Ok(r) => println!("ready={} wasm={} hydrated={}", r.ready, r.wasm_loaded, r.hydrated),
                Err(e) => println!("Error: {}", e),
            }
        }
        Commands::Errors => {
            let errs = client.errors().await?;
            println!("Errors: {} | Rejections: {}", errs.errors.len(), errs.unhandled_rejections.len());
            for e in &errs.errors { println!("  [{}] {}", e.error_type, e.message); }
            for e in &errs.unhandled_rejections { println!("  [rej] {}", e.message); }
        }
        Commands::Perf => {
            let p: PerformanceMetrics = client.performance().await?;
            println!("── Performance Metrics ──");
            println!("  DOM nodes: {}", p.dom_nodes);
            if let Some(dcl) = p.dom_content_loaded_ms { println!("  DCL: {:.0}ms", dcl); }
            if let Some(dc) = p.dom_complete_ms { println!("  DomComplete: {:.0}ms", dc); }
            if let Some(fcp) = p.fcp_ms { println!("  FCP: {:.0}ms", fcp); }
            if let Some(h) = p.js_heap_used_mb { println!("  JS Heap: {:.1}MB", h); }
            println!("  WASM: {} | Hydrated: {} | Timestamp: {}", p.wasm_loaded, p.hydrated, p.timestamp);
        }
        Commands::Network => {
            let n: NetworkResponse = client.network().await?;
            println!("── Network Resources ({}) ──", n.resources.len());
            for r in &n.resources {
                println!("  [{:>8}] {:>6.0}ms  {:>7.0}B  {}", r.resource_type, r.duration, r.size,
                    if r.url.len() > 80 { &r.url[..80] } else { &r.url });
            }
        }
        Commands::A11y => {
            let tree: Vec<A11yNode> = client.a11y().await?;
            print_a11y_tree(&tree, 0);
        }
        Commands::BatchRoutes => {
            fs::create_dir_all(&out)?;
            let routes: Vec<BatchOp> = PREDEFINED_ROUTES.iter().map(|(url, _name)| {
                BatchOp::Navigate { url: url.to_string(), wait_for: Some("hydration".into()) }
            }).chain(PREDEFINED_ROUTES.iter().map(|(_url, name)| {
                BatchOp::Screenshot { selector: None, full_page: Some(true), mode: Some("pixel".into()), name: Some(format!("{}_pixel", name)) }
            })).collect();
            let result = client.batch(routes).await?;
            let ok = result.results.iter().filter(|r| r.success).count();
            println!("Batch complete: {}/{} ops", ok, result.results.len());
            for r in &result.results {
                let status = if r.success { "OK" } else { "FAIL" };
                println!("  [{:6.0}ms] {} {} - {}", r.duration_ms, status, r.op_type, r.name);
                if let Some(ref e) = r.error { println!("         error: {}", e); }
            }
        }
    }

    Ok(())
}
