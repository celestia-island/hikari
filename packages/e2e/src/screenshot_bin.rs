// hikari-e2e/src/screenshot_bin.rs
// E2E screenshot generator using headless Chromium (chromiumoxide)

use anyhow::{Context, Result};
use chromiumoxide::browser::{Browser, BrowserConfig};
use chromiumoxide::page::Page;
use clap::Parser;
use futures::StreamExt;
use std::path::PathBuf;
use std::time::Duration;
use tracing::{error, info, warn};

/// Command line arguments for screenshot generator
#[derive(Parser, Debug, Clone)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Starting route index (0-based)
    #[arg(short, long, default_value_t = 0)]
    start: usize,

    /// Ending route index (exclusive)
    #[arg(short, long)]
    end: Option<usize>,

    /// Concurrency level (number of parallel pages to process)
    #[arg(short, long, default_value_t = 1)]
    concurrency: usize,
}

/// Base URL for website
const BASE_URL: &str = "http://localhost:3000";

/// Output directory for screenshots
const SCREENSHOT_DIR: &str = "/tmp/e2e_screenshots";

/// All routes to capture screenshots for
const ROUTES: &[(&str, &str)] = &[
    // Home
    ("/", "home"),
    ("/components", "components"),
    ("/demos", "demos"),
    ("/demos/animation", "demos_animation"),
    ("/demos/layer1/form", "demos_layer1_form"),
    ("/demos/layer2/dashboard", "demos_layer2_dashboard"),
    ("/demos/layer3/video", "demos_layer3_video"),

    // Layer 1 Basic
    ("/components/layer1/basic", "components_layer1_basic"),
    ("/components/layer1/form", "components_layer1_form"),
    ("/components/layer1/switch", "components_layer1_switch"),
    ("/components/layer1/feedback", "components_layer1_feedback"),
    ("/components/layer1/display", "components_layer1_display"),

    // Entry components
    ("/components/entry/cascader", "components_entry_cascader"),
    ("/components/entry/transfer", "components_entry_transfer"),
    ("/components/entry/number_input", "components_entry_number_input"),
    ("/components/entry/search", "components_entry_search"),

    // Layer 2
    ("/components/layer2", "components_layer2"),
    ("/components/layer2/navigation", "components_layer2_navigation"),
    ("/components/layer2/data", "components_layer2_data"),
    ("/components/layer2/form", "components_layer2_form"),
    ("/components/layer2/feedback", "components_layer2_feedback"),

    // Layer 3
    ("/components/layer3/overview", "components_layer3_overview"),
    ("/components/layer3/media", "components_layer3_media"),
    ("/components/layer3/editor", "components_layer3_editor"),
    ("/components/layer3/visualization", "components_layer3_visualization"),

    // Extra components
    ("/components/extra/collapsible", "components_extra_collapsible"),
    ("/components/extra/timeline", "components_extra_timeline"),
    ("/components/extra/user_guide", "components_extra_user_guide"),
    ("/components/extra/zoom_controls", "components_extra_zoom_controls"),

    // System
    ("/system", "system"),
    ("/system/css", "system_css"),
    ("/system/icons", "system_icons"),
    ("/system/palette", "system_palette"),
    ("/system/animations", "system_animations"),
];

/// Screenshot generator using headless Chromium
pub struct ScreenshotGenerator {
    browser: Browser,
}

impl ScreenshotGenerator {
    /// Create a new screenshot generator
    pub async fn new() -> Result<Self> {
        info!("Initializing headless Chromium browser...");

        // Get Chrome binary path from environment or use default
        let chrome_bin = std::env::var("CHROME_BIN")
            .unwrap_or_else(|_| "chromium".to_string());

        // Configure browser with Chrome binary path and additional args
        let config = BrowserConfig::builder()
            .no_sandbox()
            .chrome_executable(&chrome_bin)
            .args(vec![
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--headless=new",
                "--disable-extensions",
            ])
            .build()
            .map_err(|e| anyhow::anyhow!("Failed to build browser config: {}", e))?;

        // Launch browser
        let (browser, mut handler) = Browser::launch(config)
            .await
            .context("Failed to launch Chromium browser")?;

        // Spawn handler in background
        tokio::spawn(async move {
            while let Some(event) = handler.next().await {
                if let Err(e) = event {
                    warn!("Browser handler error: {:?}", e);
                }
            }
        });

        info!("Headless Chromium browser initialized");
        Ok(Self { browser })
    }

    /// Capture screenshot for a single page
    pub async fn capture_page(&mut self, route: &str, name: &str) -> Result<()> {
        let url = format!("{}{}", BASE_URL, route);
        info!("[{}] Navigating to {}", name, url);

        // Create new page and navigate
        let page = self
            .browser
            .new_page(url.clone())
            .await
            .context("Failed to create new page")?;

        // Wait for page load
        self.wait_for_page_load(&page)
            .await
            .context("Failed to wait for page load")?;

        info!("[{}] Page loaded, setting viewport...", name);

        // Set viewport via JavaScript (chromiumoxide limitation workaround)
        let _ = page
            .evaluate("window.resizeTo(1920, 1080)")
            .await
            .map_err(|e| warn!("Failed to set viewport via JS: {}", e));

        info!("[{}] Waiting for dynamic content...", name);

        // Wait for Hikari UI to fully load
        info!("[{}] Waiting for Hikari UI to load (checking DOM)...", name);
        tokio::time::sleep(Duration::from_secs(2)).await;

        // Check if #main element exists and is not loading
        info!("[{}] Checking if page is fully loaded...", name);
        let is_loaded_result = page
            .evaluate(r#"
                // Check if loading indicator is gone
                const loadingElement = document.getElementById('loading');
                const mainElement = document.getElementById('main');
                const isLoaded = !loadingElement || loadingElement.style.display === 'none' ||
                                (mainElement && mainElement.children.length > 0);
                isLoaded
            "#)
            .await;

        let is_loaded = is_loaded_result
            .map(|r| r.into_value::<bool>())
            .unwrap_or(Ok(false))
            .unwrap_or(false);

        if !is_loaded {
            // Additional wait time for WASM initialization
            info!("[{}] Page still loading, waiting additional 4 seconds...", name);
            tokio::time::sleep(Duration::from_secs(4)).await;

            // Final check
            info!("[{}] Final loading check...", name);
            tokio::time::sleep(Duration::from_secs(2)).await;
        }

        info!("[{}] Wait complete, preparing screenshot...", name);

        // Capture screenshot as PNG
        let screenshot_dir = PathBuf::from(SCREENSHOT_DIR);
        std::fs::create_dir_all(&screenshot_dir)
            .context("Failed to create screenshot directory")?;

        let screenshot_path = screenshot_dir.join(format!("{}.png", name));

        info!("[{}] Capturing screenshot to {}...", name, screenshot_path.display());

        // Capture screenshot directly to file
        page.save_screenshot(
            chromiumoxide::page::ScreenshotParams::builder()
                .full_page(true)
                .build(),
            &screenshot_path,
        )
        .await
        .with_context(|| format!("Failed to capture screenshot to {}", screenshot_path.display()))?;

        info!("[{}] ✓ Screenshot saved to {}", name, screenshot_path.display());

        // Close page
        page.close().await.context("Failed to close page")?;

        Ok(())
    }

    /// Wait for page to finish loading
    async fn wait_for_page_load(&self, page: &Page) -> Result<()> {
        // Wait for DOM content loaded
        tokio::time::sleep(Duration::from_millis(500)).await;

        // Wait for WASM module to fully load and render
        // WASM applications need more time to initialize
        tokio::time::sleep(Duration::from_secs(6)).await;

        // Check if page is still open
        let _ = page
            .evaluate("document.readyState")
            .await
            .context("Failed to check page ready state")?;

        Ok(())
    }

    /// Capture screenshots for a range of routes
    pub async fn capture_range(&mut self, start: usize, end: usize) -> Result<()> {
        let routes = &ROUTES[start..end];
        info!("Starting screenshot capture for routes [{}..{}], total: {} routes", start, end, routes.len());

        let mut success_count = 0;
        let mut failure_count = 0;

        for (route, name) in routes.iter() {
            match self.capture_page(route, name).await {
                Ok(_) => success_count += 1,
                Err(e) => {
                    let source_str = e.source().map(|s| s.to_string()).unwrap_or_else(|| "None".to_string());
                    error!("Failed to capture {}: {}", name, e);
                    error!("  - Source: {}", source_str);
                    failure_count += 1;
                }
            }
        }
        info!("\n=== Screenshot Capture Complete ===");
        info!("Route range: [{}..{}]", start, end);
        info!("Successful: {}", success_count);
        info!("Failed: {}", failure_count);
        info!("Total: {}", routes.len());
        info!("================================\n");

        Ok(())
    }
}

/// Main entry point for screenshot generator
#[tokio::main]
async fn main() -> Result<()> {
    // Parse command line arguments
    let args = Args::parse();

    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .init();

    info!("=== Hikari E2E Screenshot Generator (chromiumoxide) ===");
    info!("Base URL: {}", BASE_URL);
    info!("Output directory: {}", SCREENSHOT_DIR);
    info!("Chrome binary: {}", std::env::var("CHROME_BIN").unwrap_or_else(|_| "chromium".to_string()));
    info!("Route range: [{}..{:?}]", args.start, args.end);
    info!("Concurrency: {}", args.concurrency);
    info!("===============================================================\n");

    // Calculate end index
    let end = args.end.unwrap_or(ROUTES.len());
    if end > ROUTES.len() {
        error!("End index {} exceeds total routes {}", end, ROUTES.len());
        anyhow::bail!("Invalid route range");
    }

    if args.start >= end {
        error!("Start index {} must be less than end index {}", args.start, end);
        anyhow::bail!("Invalid route range");
    }

    // Create screenshot generator
    let mut generator = ScreenshotGenerator::new().await?;

    // Capture screenshots for specified range
    generator.capture_range(args.start, end).await?;

    info!("Screenshot generation completed successfully");

    Ok(())
}
