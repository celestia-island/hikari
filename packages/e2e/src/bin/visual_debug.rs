use anyhow::{Context, Result};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::{path::PathBuf, time::Duration};

use chromiumoxide::{browser::{Browser, BrowserConfig}, cdp::browser_protocol::page::CaptureScreenshotFormat};
use clap::{Parser, Subcommand};
use tracing::{error, info, warn};
use tairitsu_browser_test::{BrowserCache, BrowserDownloader, browser::{CHROME_VERSION, Platform, detect_platform}};

const SCREENSHOT_DIR: &str = "/tmp/e2e_screenshots";

const ROUTES: &[(&str, &str, &str)] = &[
    ("/en", "home", "Home page - hero + overview"),
    ("/en/components", "components", "Components overview page"),
    ("/en/components/layer1/button", "button", "Button component showcase"),
    ("/en/components/layer1/form", "form", "Form components (Input, Select)"),
    ("/en/components/layer1/display", "display", "Display components (Card, Tag, etc)"),
    ("/en/components/layer1/feedback", "feedback", "Feedback (Alert, Toast, Modal)"),
    ("/en/components/layer2/table", "table", "Data Table component"),
    ("/en/components/layer2/tree", "tree", "Tree component"),
    ("/en/components/layer2/navigation", "navigation", "Navigation (Menu, Tabs, Breadcrumb)"),
    ("/en/components/layer3/media", "media", "Media (VideoPlayer, AudioWaveform)"),
    ("/en/components/layer3/editor", "editor", "RichTextEditor component"),
    ("/en/system/palette", "palette", "Color palette system page"),
    ("/en/system/icons", "icons", "Icon system page"),
    ("/en/demos/animation", "demos_animation", "Animation demo page"),
    ("/en/demos/layer2/dashboard", "demos_dashboard", "Dashboard demo"),
];

#[derive(Parser, Debug)]
#[command(author, version, about = "Visual debug tool powered by Tairitsu browser-test")]
struct Args {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    Install {
        #[arg(long, default_value_t = false)]
        force: bool,
    },
    Capture {
        #[arg(short, long, default_value = "http://localhost:3000")]
        base_url: String,
        #[arg(long, default_value = SCREENSHOT_DIR)]
        output_dir: String,
        #[arg(short, long)]
        filter: Option<String>,
        #[arg(long, default_value_t = 10)]
        wait_secs: u64,
        #[arg(long)]
        full_page: bool,
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    Analyze {
        #[arg(short, long)]
        screenshot_path: String,
        #[arg(long, default_value = "general")]
        aspect: String,
    },
    Inspect {
        #[arg(short, long, default_value = "http://localhost:3000")]
        base_url: String,
        #[arg(short, long)]
        route: String,
        #[arg(long, default_value_t = 1920)]
        width: u32,
        #[arg(long, default_value_t = 1080)]
        height: u32,
        #[arg(long, default_value_t = 10)]
        wait_secs: u64,
        #[arg(long, default_value = "inspect.png")]
        output: String,
    },
    Batch {
        #[arg(short, long, default_value = "http://localhost:3000")]
        base_url: String,
        #[arg(long, default_value = SCREENSHOT_DIR)]
        output_dir: String,
        #[arg(long, default_value_t = false)]
        json: bool,
        #[arg(long)]
        report_path: Option<String>,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ScreenshotResult {
    route: String,
    name: String,
    description: String,
    output_path: String,
    success: bool,
    error: Option<String>,
    duration_ms: u64,
    viewport_width: u32,
    viewport_height: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct BatchReport {
    timestamp: String,
    base_url: String,
    total: usize,
    passed: usize,
    failed: usize,
    results: Vec<ScreenshotResult>,
    screenshot_dir: String,
}

struct VisualDebugger {
    browser: Browser,
    output_dir: PathBuf,
}

impl VisualDebugger {
    async fn new(output_dir: &str, chrome_bin: Option<&str>) -> Result<Self> {
        std::fs::create_dir_all(output_dir)?;

        let bin = match chrome_bin {
            Some(b) => b.to_string(),
            None => Self::resolve_chrome_binary()?,
        };

        let config = BrowserConfig::builder()
            .no_sandbox()
            .chrome_executable(&bin)
            .args(vec![
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--headless=new",
                "--disable-extensions",
                "--window-size=1920,1080",
            ])
            .build()
            .map_err(|e| anyhow::anyhow!("Failed to build browser config: {}", e))?;

        let (browser, mut handler) = Browser::launch(config)
            .await
            .context("Failed to launch Chromium")?;

        tokio::spawn(async move {
            while let Some(event) = handler.next().await {
                if let Err(e) = event {
                    warn!("Browser event error: {:?}", e);
                }
            }
        });

        Ok(Self {
            browser,
            output_dir: PathBuf::from(output_dir),
        })
    }

    fn resolve_chrome_binary() -> Result<String> {
        if let Ok(bin) = std::env::var("CHROME_BIN") {
            return Ok(bin);
        }

        if let Ok(bin) = std::env::var("CHROMIUM_BIN") {
            return Ok(bin);
        }

        let cache = BrowserCache::new(None);
        let cached_path = cache.executable_path(CHROME_VERSION, detect_platform());
        if cached_path.exists() {
            info!("Using cached Chromium: {}", cached_path.display());
            return Ok(cached_path.to_string_lossy().to_string());
        }

        let platform = detect_platform();
        let candidates: Vec<&str> = match platform {
            Platform::LinuxX64 => vec!["chromium-browser", "chromium", "google-chrome"],
            Platform::MacosArm64 | Platform::MacosX64 => vec![
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            ],
            Platform::WindowsX64 => vec![
                "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            ],
        };

        for candidate in &candidates {
            if std::process::Command::new(candidate)
                .arg("--version")
                .output()
                .is_ok() {
                info!("Found system Chrome: {}", candidate);
                return Ok(candidate.to_string());
            }
        }

        Err(anyhow::anyhow!(
            "No Chrome/Chromium found. Run `visual-debug install` first or set CHROME_BIN env."
        ))
    }

    async fn capture(
        &mut self,
        base_url: &str,
        route: &str,
        name: &str,
        description: &str,
        wait_secs: u64,
        full_page: bool,
    ) -> Result<ScreenshotResult> {
        let url = format!("{}{}", base_url, route);
        let start = std::time::Instant::now();

        info!("[{}] Navigating to {}", name, url);

        let page = self
            .browser
            .new_page(url.clone())
            .await
            .context("Failed to create page")?;

        tokio::time::sleep(Duration::from_secs(wait_secs)).await;

        let _ = page
            .evaluate("if(window.resizeTo) window.resizeTo(1920, 1080);")
            .await;

        let loaded: bool = page
            .evaluate(r#"
                (function() {
                    const loading = document.getElementById('loading');
                    const main = document.getElementById('main');
                    if (loading && loading.style.display !== 'none') return false;
                    if (!main || main.children.length === 0) return false;
                    return true;
                })()
            "#)
            .await
            .map(|r| r.into_value::<bool>().unwrap_or(false))
            .unwrap_or(false);

        if !loaded {
            info!("[{}] Page still loading, waiting extra...", name);
            tokio::time::sleep(Duration::from_secs(4)).await;
        }

        let filename = format!("{}.png", name);
        let screenshot_path = self.output_dir.join(&filename);

        let params = chromiumoxide::page::ScreenshotParams::builder()
            .format(CaptureScreenshotFormat::Png)
            .full_page(full_page)
            .build();

        page.save_screenshot(params, &screenshot_path)
            .await
            .with_context(|| format!("Failed to screenshot {}", name))?;

        page.close().await.ok();

        let elapsed = start.elapsed().as_millis() as u64;
        let path_str = screenshot_path.to_string_lossy().to_string();

        info!("[{}] ✓ {} ({}ms)", name, path_str, elapsed);

        Ok(ScreenshotResult {
            route: route.to_string(),
            name: name.to_string(),
            description: description.to_string(),
            output_path: path_str,
            success: true,
            error: None,
            duration_ms: elapsed,
            viewport_width: 1920,
            viewport_height: 1080,
        })
    }

    async fn inspect_page(
        &mut self,
        base_url: &str,
        route: &str,
        width: u32,
        height: u32,
        wait_secs: u64,
        output: &str,
    ) -> Result<serde_json::Value> {
        let url = format!("{}{}", base_url, route);
        info!("Inspecting: {}", url);

        let page = self.browser.new_page(url).await.context("Failed to create page")?;

        let _ = page.evaluate(format!(
            "document.documentElement.style.width='{}px'; document.documentElement.style.height='{}px';",
            width, height
        ).as_str()).await;

        tokio::time::sleep(Duration::from_secs(wait_secs)).await;

        let layout_info = page.evaluate(r#"
            (function() {
                var body = document.body;
                var rect = body.getBoundingClientRect();
                var allElements = document.querySelectorAll('*');
                var visibleCount = 0;
                var hiddenCount = 0;
                var offscreenCount = 0;

                allElements.forEach(function(el) {
                    var style = window.getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                        hiddenCount++;
                    } else {
                        var r = el.getBoundingClientRect();
                        if (r.width === 0 && r.height === 0) {
                            // skip empty
                        } else if (r.right < 0 || r.left > window.innerWidth || r.bottom < 0 || r.top > window.innerHeight) {
                            offscreenCount++;
                        } else {
                            visibleCount++;
                        }
                    }
                });

                var scrollHeight = document.documentElement.scrollHeight;
                var clientHeight = document.documentElement.clientHeight;

                return {
                    title: document.title,
                    url: location.href,
                    bodyWidth: Math.round(rect.width),
                    bodyHeight: Math.round(rect.height),
                    scrollHeight: scrollHeight,
                    clientHeight: clientHeight,
                    needsScroll: scrollHeight > clientHeight,
                    totalElements: allElements.length,
                    visibleElements: visibleCount,
                    hiddenElements: hiddenCount,
                    offscreenElements: offscreenCount,
                    hasLayoutShift: scrollHeight > clientHeight * 1.5
                };
            })()
        "#).await.map(|r| r.into_value::<serde_json::Value>()).unwrap_or(Ok(serde_json::json!({})))?;

        let out_path = PathBuf::from(output);
        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }

        page.save_screenshot(
            chromiumoxide::page::ScreenshotParams::builder()
                .format(CaptureScreenshotFormat::Png)
                .full_page(true)
                .build(),
            &out_path,
        ).await.ok();

        page.close().await.ok();

        let mut result = layout_info.as_object()
            .cloned()
            .unwrap_or(serde_json::Map::new());
        result.insert("screenshot".to_string(), serde_json::json!(output));
        result.insert("route".to_string(), serde_json::json!(route));

        Ok(serde_json::Value::Object(result))
    }

    async fn shutdown(self) -> Result<()> {
        drop(self.browser);
        Ok(())
    }
}

async fn cmd_install(force: bool) -> Result<()> {
    info!("Installing Chromium via Tairitsu BrowserDownloader...");
    let cache = BrowserCache::new(None);
    let downloader = BrowserDownloader::new(cache, None);
    let platform = detect_platform();
    let path = downloader.download(CHROME_VERSION, platform).await
        .context("Failed to download Chromium")?;
    info!("Chromium installed to: {}", path.display());
    info!("Set CHROME_BIN={} to use it.", path.display());
    Ok(())
}

async fn cmd_capture(
    base_url: &str,
    output_dir: &str,
    filter: Option<String>,
    wait_secs: u64,
    full_page: bool,
    json_output: bool,
) -> Result<()> {
    let mut debugger = VisualDebugger::new(output_dir, None).await?;
    let mut results = Vec::new();

    let filtered: Vec<_> = match filter.as_deref() {
        Some(f) if f.ends_with('*') => {
            let prefix = f.trim_end_matches('*');
            ROUTES.iter().filter(|(_, name, _)| name.starts_with(prefix)).copied().collect()
        }
        Some(f) => {
            ROUTES.iter().filter(|(_, name, _)| *name == f).copied().collect()
        }
        None => ROUTES.to_vec(),
    };

    info!("Capturing {} pages from {}", filtered.len(), base_url);

    for (route, name, desc) in &filtered {
        match debugger.capture(base_url, route, name, desc, wait_secs, full_page).await {
            Ok(result) => results.push(result),
            Err(e) => {
                error!("Failed to capture {}: {}", name, e);
                results.push(ScreenshotResult {
                    route: route.to_string(),
                    name: name.to_string(),
                    description: desc.to_string(),
                    output_path: String::new(),
                    success: false,
                    error: Some(e.to_string()),
                    duration_ms: 0,
                    viewport_width: 1920,
                    viewport_height: 1080,
                });
            }
        }
    }

    debugger.shutdown().await?;

    let passed = results.iter().filter(|r| r.success).count();
    let _failed = results.len() - passed;

    info!("=== Capture Complete ===");
    info!("Passed: {}/{}", passed, results.len());

    if json_output {
        println!("{}", serde_json::to_string_pretty(&results)?);
    } else {
        for r in &results {
            let status = if r.success { "✓" } else { "✗" };
            println!("  {} {} ({}) - {}", status, r.name, r.route, r.output_path);
        }
    }

    Ok(())
}

async fn cmd_inspect(
    base_url: &str,
    route: &str,
    width: u32,
    height: u32,
    wait_secs: u64,
    output: &str,
) -> Result<()> {
    let mut debugger = VisualDebugger::new(".", None).await?;
    let result = debugger.inspect_page(base_url, route, width, height, wait_secs, output).await?;
    debugger.shutdown().await?;
    println!("{}", serde_json::to_string_pretty(&result)?);
    Ok(())
}

async fn cmd_batch(
    base_url: &str,
    output_dir: &str,
    json_output: bool,
    report_path: Option<&str>,
) -> Result<()> {
    let mut debugger = VisualDebugger::new(output_dir, None).await?;
    let mut results = Vec::new();

    for (route, name, desc) in ROUTES {
        match debugger.capture(base_url, route, name, desc, 10, true).await {
            Ok(result) => results.push(result),
            Err(e) => {
                error!("Failed: {} - {}", name, e);
                results.push(ScreenshotResult {
                    route: route.to_string(),
                    name: name.to_string(),
                    description: desc.to_string(),
                    output_path: String::new(),
                    success: false,
                    error: Some(e.to_string()),
                    duration_ms: 0,
                    viewport_width: 1920,
                    viewport_height: 1080,
                });
            }
        }
    }

    debugger.shutdown().await?;

    let passed = results.iter().filter(|r| r.success).count();
    let failed = results.len() - passed;

    let report = BatchReport {
        timestamp: chrono::Utc::now().to_rfc3339(),
        base_url: base_url.to_string(),
        total: results.len(),
        passed,
        failed,
        results: results.clone(),
        screenshot_dir: output_dir.to_string(),
    };

    if let Some(ref path) = report_path {
        std::fs::write(path, serde_json::to_string_pretty(&report)?)?;
        info!("Report saved to: {}", path);
    }

    if json_output {
        println!("{}", serde_json::to_string_pretty(&report)?);
    } else {
        println!("\n=== Visual Debug Batch Report ===");
        println!("Base URL: {}", base_url);
        println!("Time:   {}", report.timestamp);
        println!("Total:  {} | Passed: {} | Failed: {}", report.total, report.passed, report.failed);
        println!("\n{:<25} {:<40} {:>8}", "Name", "Path", "Duration");
        println!("{}", "-".repeat(80));
        for r in &results {
            let _s = if r.success { "OK" } else { "FAIL" };
            println!("{:<25} {:<40} {:>7}ms", r.name, 
                if r.output_path.is_empty() {"(none)".to_string()} else {r.output_path.replace("/tmp/e2e_screenshots/", "")},
                r.duration_ms);
        }
        println!("{}", "-".repeat(80));
    }

    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    let args = Args::parse();

    match args.command {
        Commands::Install { force } => cmd_install(force).await,
        Commands::Capture { base_url, output_dir, filter, wait_secs, full_page, json } => {
            cmd_capture(&base_url, &output_dir, filter, wait_secs, full_page, json).await
        }
        Commands::Analyze { screenshot_path, aspect } => {
            println!("{}", serde_json::json!({
                "action": "analyze",
                "screenshot": screenshot_path,
                "aspect": aspect,
                "instruction": "Use zai-mcp-server_analyze_image MCP tool to analyze this screenshot",
                "prompts": {
                    "layout": "Analyze the UI layout: check alignment, spacing, visual hierarchy, grid consistency, overflow issues",
                    "visual_quality": "Full visual quality audit: shadows, colors, typography, borders, corner radius, overall polish",
                    "components": "Identify each UI component and check its rendering quality, state correctness, interaction readiness",
                    "responsive": "Check responsive layout behavior at this viewport size",
                    "accessibility": "Check color contrast, focus indicators, semantic structure, ARIA attributes",
                    "general": "General analysis of this UI screenshot - describe what you see and flag any issues"
                }
            }));
            Ok(())
        },
        Commands::Inspect { base_url, route, width, height, wait_secs, output } => {
            cmd_inspect(&base_url, &route, width, height, wait_secs, &output).await
        },
        Commands::Batch { base_url, output_dir, json, report_path } => {
            cmd_batch(&base_url, &output_dir, json, report_path.as_deref()).await
        },
    }
}
