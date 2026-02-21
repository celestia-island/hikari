use anyhow::{Context, Result};
use chromiumoxide::{
    browser::{Browser, BrowserConfig},
    cdp::browser_protocol::page::CaptureScreenshotFormat,
};
use clap::{Parser, Subcommand};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::{path::PathBuf, time::Duration};
use tracing::{info, warn};

#[derive(Parser, Debug)]
#[command(author, version, about = "Interactive browser debug tool for Hikari")]
struct Args {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    Navigate {
        #[arg(short, long, default_value = "http://localhost:3000")]
        url: String,
        #[arg(short, long, default_value = "screenshot.png")]
        output: String,
        #[arg(short, long, default_value = "8")]
        wait: u64,
        #[arg(short = 'j', long)]
        inject: Option<String>,
        #[arg(short, long)]
        full_page: bool,
    },
    Script {
        #[arg(short, long, default_value = "http://localhost:3000")]
        url: String,
        #[arg(short, long)]
        script: String,
        #[arg(short, long, default_value = "8")]
        wait: u64,
    },
    Interactive {
        #[arg(short, long, default_value = "debug_commands.json")]
        input: String,
        #[arg(short, long, default_value = "screenshots")]
        output_dir: String,
    },
    Check {
        #[arg(short, long, default_value = "http://localhost:3000")]
        url: String,
        #[arg(short, long, default_value = "8")]
        wait: u64,
    },
}

#[derive(Debug, Serialize, Deserialize)]
struct DebugCommand {
    action: String,
    url: Option<String>,
    selector: Option<String>,
    script: Option<String>,
    wait_ms: Option<u64>,
    output: Option<String>,
    full_page: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
struct DebugResult {
    success: bool,
    message: String,
    output_path: Option<String>,
    script_result: Option<serde_json::Value>,
}

struct BrowserDebug {
    browser: Browser,
}

impl BrowserDebug {
    async fn new() -> Result<Self> {
        let chrome_bin = std::env::var("CHROME_BIN")
            .unwrap_or_else(|_| "chromium".to_string());

        let config = BrowserConfig::builder()
            .no_sandbox()
            .chrome_executable(&chrome_bin)
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
            .context("Failed to launch browser")?;

        tokio::spawn(async move {
            while let Some(event) = handler.next().await {
                if let Err(e) = event {
                    warn!("Browser handler error: {:?}", e);
                }
            }
        });

        Ok(Self { browser })
    }

    async fn navigate_and_screenshot(
        &mut self,
        url: &str,
        output: &str,
        wait_secs: u64,
        inject_script: Option<&str>,
        full_page: bool,
    ) -> Result<String> {
        info!("Navigating to: {}", url);

        let page = self.browser
            .new_page(url.to_string())
            .await
            .context("Failed to create page")?;

        tokio::time::sleep(Duration::from_secs(wait_secs)).await;

        if let Some(script) = inject_script {
            info!("Injecting script...");
            let _ = page.evaluate(script)
                .await
                .map_err(|e| warn!("Script injection warning: {}", e));
            tokio::time::sleep(Duration::from_millis(500)).await;
        }

        let _ = page
            .evaluate("window.resizeTo(1920, 1080)")
            .await
            .map_err(|e| warn!("Failed to set viewport via JS: {}", e));

        let screenshot_path = PathBuf::from(output);
        
        let params = chromiumoxide::page::ScreenshotParams::builder()
            .format(CaptureScreenshotFormat::Png)
            .full_page(full_page)
            .build();

        page.save_screenshot(params, &screenshot_path)
            .await
            .context("Failed to save screenshot")?;

        page.close().await?;

        let path_str = screenshot_path.canonicalize()
            .unwrap_or(screenshot_path)
            .to_string_lossy()
            .to_string();
        
        info!("Screenshot saved: {}", path_str);
        Ok(path_str)
    }

    async fn execute_script(
        &mut self,
        url: &str,
        script: &str,
        wait_secs: u64,
    ) -> Result<serde_json::Value> {
        info!("Navigating to: {}", url);

        let page = self.browser
            .new_page(url.to_string())
            .await
            .context("Failed to create page")?;

        tokio::time::sleep(Duration::from_secs(wait_secs)).await;

        info!("Executing script...");
        let result = page.evaluate(script)
            .await
            .context("Failed to execute script")?;

        let value: serde_json::Value = result.into_value()?;
        
        page.close().await?;

        Ok(value)
    }

    async fn check_page(&mut self, url: &str, wait_secs: u64) -> Result<DebugResult> {
        info!("Checking page: {}", url);

        let page = self.browser
            .new_page(url.to_string())
            .await
            .context("Failed to create page")?;

        tokio::time::sleep(Duration::from_secs(wait_secs)).await;

        let check_script = r#"
            (function() {
                const loading = document.getElementById('loading');
                const main = document.getElementById('main');
                const errors = [];
                
                if (loading && loading.style.display !== 'none') {
                    errors.push('Loading indicator still visible');
                }
                
                if (!main || main.children.length === 0) {
                    errors.push('Main content area is empty');
                }
                
                return {
                    ready: errors.length === 0,
                    errors: errors,
                    title: document.title,
                    url: window.location.href
                };
            })()
        "#;

        let result = page.evaluate(check_script)
            .await
            .context("Failed to check page")?;

        let value: serde_json::Value = result.into_value()?;
        
        page.close().await?;

        Ok(DebugResult {
            success: value["ready"].as_bool().unwrap_or(false),
            message: if value["ready"].as_bool().unwrap_or(false) {
                "Page loaded successfully".to_string()
            } else {
                format!("Page issues: {:?}", value["errors"])
            },
            output_path: None,
            script_result: Some(value),
        })
    }

    async fn run_commands(&mut self, input_file: &str, output_dir: &str) -> Result<Vec<DebugResult>> {
        let content = std::fs::read_to_string(input_file)
            .context("Failed to read commands file")?;
        
        let commands: Vec<DebugCommand> = serde_json::from_str(&content)
            .context("Failed to parse commands JSON")?;

        std::fs::create_dir_all(output_dir)?;

        let mut results = Vec::new();

        for cmd in commands {
            let result = self.execute_command(&cmd, output_dir).await;
            results.push(result);
        }

        Ok(results)
    }

    async fn execute_command(&mut self, cmd: &DebugCommand, output_dir: &str) -> DebugResult {
        match cmd.action.as_str() {
            "navigate" | "screenshot" => {
                let url = cmd.url.as_deref().unwrap_or("http://localhost:3000");
                let output = cmd.output.as_deref()
                    .map(|o| format!("{}/{}", output_dir, o))
                    .unwrap_or_else(|| format!("{}/screenshot.png", output_dir));
                
                match self.navigate_and_screenshot(
                    url,
                    &output,
                    cmd.wait_ms.unwrap_or(8000) / 1000,
                    cmd.script.as_deref(),
                    cmd.full_page.unwrap_or(true),
                ).await {
                    Ok(path) => DebugResult {
                        success: true,
                        message: "Screenshot captured".to_string(),
                        output_path: Some(path),
                        script_result: None,
                    },
                    Err(e) => DebugResult {
                        success: false,
                        message: format!("Failed: {}", e),
                        output_path: None,
                        script_result: None,
                    },
                }
            }
            "script" => {
                let url = cmd.url.as_deref().unwrap_or("http://localhost:3000");
                let script = cmd.script.as_deref().unwrap_or("return document.title;");
                
                match self.execute_script(url, script, cmd.wait_ms.unwrap_or(8000) / 1000).await {
                    Ok(value) => DebugResult {
                        success: true,
                        message: "Script executed".to_string(),
                        output_path: None,
                        script_result: Some(value),
                    },
                    Err(e) => DebugResult {
                        success: false,
                        message: format!("Script failed: {}", e),
                        output_path: None,
                        script_result: None,
                    },
                }
            }
            "check" => {
                let url = cmd.url.as_deref().unwrap_or("http://localhost:3000");
                match self.check_page(url, cmd.wait_ms.unwrap_or(8000) / 1000).await {
                    Ok(result) => result,
                    Err(e) => DebugResult {
                        success: false,
                        message: format!("Check failed: {}", e),
                        output_path: None,
                        script_result: None,
                    },
                }
            }
            _ => DebugResult {
                success: false,
                message: format!("Unknown action: {}", cmd.action),
                output_path: None,
                script_result: None,
            }
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .init();

    let args = Args::parse();
    let mut debug = BrowserDebug::new().await?;

    match args.command {
        Commands::Navigate { url, output, wait, inject, full_page } => {
            let path = debug.navigate_and_screenshot(
                &url, &output, wait,
                inject.as_deref(), full_page,
            ).await?;
            
            let result = DebugResult {
                success: true,
                message: "Screenshot captured".to_string(),
                output_path: Some(path),
                script_result: None,
            };
            println!("{}", serde_json::to_string_pretty(&result)?);
        }
        Commands::Script { url, script, wait } => {
            let value = debug.execute_script(&url, &script, wait).await?;
            let result = DebugResult {
                success: true,
                message: "Script executed".to_string(),
                output_path: None,
                script_result: Some(value),
            };
            println!("{}", serde_json::to_string_pretty(&result)?);
        }
        Commands::Interactive { input, output_dir } => {
            let results = debug.run_commands(&input, &output_dir).await?;
            println!("{}", serde_json::to_string_pretty(&results)?);
        }
        Commands::Check { url, wait } => {
            let result = debug.check_page(&url, wait).await?;
            println!("{}", serde_json::to_string_pretty(&result)?);
        }
    }

    Ok(())
}
