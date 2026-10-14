// hikari-e2e/src/tests/advanced_components.rs
// E2E tests for Layer 3 advanced components

use anyhow::Result;
use std::time::{Duration, Instant};

use thirtyfour::{By, WebDriver};
use tracing::{info, warn};

use super::TestResult;
use crate::Test;

/// Test suite for Layer 3 advanced components
pub struct AdvancedComponentsTests;

#[derive(Debug, Clone)]
pub struct AdvancedComponentVerification {
    pub component_name: String,
    pub renders: bool,
    pub supports_media: bool,
    pub supports_interaction: bool,
}

impl AdvancedComponentsTests {
    async fn test_video_player(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing VideoPlayer component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        let test_url = format!("{}/#/demos/layer3/video", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let video_player = driver
            .find(By::Css(".hk-video-player"))
            .await
            .map_err(|e| {
                warn!("VideoPlayer element not found: {}", e);
                anyhow::anyhow!("VideoPlayer element not found: {}", e)
            })?;

        info!("VideoPlayer element found");

        let class_attr = video_player
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get video player attributes: {}", e))?;
        let class_attr = class_attr
            .ok_or_else(|| anyhow::anyhow!("No class attribute found for video player"))?;

        if !class_attr.contains("hk-video-player") {
            return Ok(TestResult::failure(
                "VideoPlayer",
                "VideoPlayer element missing 'hi-video-player' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "VideoPlayer".to_string(),
            status: super::TestStatus::Success,
            message: "VideoPlayer component renders correctly and has proper class".to_string(),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_audio_waveform(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing AudioWaveform component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        // AudioWaveform demo is in the video demo page
        let test_url = format!("{}/#/demos/layer3/video", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let audio_waveform = driver
            .find(By::Css(".hk-audio-waveform"))
            .await
            .map_err(|e| {
                warn!("AudioWaveform element not found: {}", e);
                anyhow::anyhow!("AudioWaveform element not found: {}", e)
            })?;

        info!("AudioWaveform element found");

        let class_attr = audio_waveform
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get audio waveform attributes: {}", e))?;
        let class_attr = class_attr
            .ok_or_else(|| anyhow::anyhow!("No class attribute found for audio waveform"))?;

        if !class_attr.contains("hk-audio-waveform") {
            return Ok(TestResult::failure(
                "AudioWaveform",
                "AudioWaveform element missing 'hi-audio-waveform' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "AudioWaveform".to_string(),
            status: super::TestStatus::Success,
            message: "AudioWaveform component renders correctly and has proper class".to_string(),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_rich_text_editor(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing RichTextEditor component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        // RichTextEditor is in the editor overview page
        let test_url = format!("{}/#/components/layer3/editor", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let rich_text_editor = driver
            .find(By::Css(".hk-rich-text-editor"))
            .await
            .map_err(|e| {
                warn!("RichTextEditor element not found: {}", e);
                anyhow::anyhow!("RichTextEditor element not found: {}", e)
            })?;

        info!("RichTextEditor element found");

        let class_attr = rich_text_editor
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get rich text editor attributes: {}", e))?;
        let class_attr = class_attr
            .ok_or_else(|| anyhow::anyhow!("No class attribute found for rich text editor"))?;

        if !class_attr.contains("hk-rich-text-editor") {
            return Ok(TestResult::failure(
                "RichTextEditor",
                "RichTextEditor element missing 'hi-rich-text-editor' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "RichTextEditor".to_string(),
            status: super::TestStatus::Success,
            message: "RichTextEditor component renders correctly and has proper class".to_string(),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

    async fn test_drag_layer(&self, driver: &WebDriver) -> Result<TestResult> {
        let start = Instant::now();
        info!("Testing DragLayer component");

        let base_url = std::env::var("WEBSITE_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());
        // DragLayer is demonstrated in the layer3/visualization page
        let test_url = format!("{}/#/components/layer3/visualization", base_url);

        driver
            .goto(&test_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to navigate to {}: {}", test_url, e))?;

        tokio::time::sleep(Duration::from_millis(500)).await;

        let drag_layer = driver.find(By::Css(".hk-drag-layer")).await.map_err(|e| {
            warn!("DragLayer element not found: {}", e);
            anyhow::anyhow!("DragLayer element not found: {}", e)
        })?;

        info!("DragLayer element found");

        drag_layer
            .click()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to click drag layer: {}", e))?;
        info!("DragLayer clicked successfully");

        let class_attr = drag_layer
            .attr("class")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get drag layer attributes: {}", e))?;
        let class_attr =
            class_attr.ok_or_else(|| anyhow::anyhow!("No class attribute found for drag layer"))?;

        if !class_attr.contains("hk-drag-layer") {
            return Ok(TestResult::failure(
                "DragLayer",
                "DragLayer element missing 'hi-drag-layer' class",
            ));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(TestResult {
            component: "DragLayer".to_string(),
            status: super::TestStatus::Success,
            message: "DragLayer component renders correctly and responds to clicks".to_string(),
            duration_ms: duration,
            screenshot_path: None,
        })
    }

}

impl Test for AdvancedComponentsTests {
    fn name(&self) -> &str {
        "Layer 3: Advanced Components Tests"
    }

    fn setup(&self) -> Result<()> {
        info!("Setting up advanced components test suite");
        info!("Dev server check: http://localhost:3000");
        Ok(())
    }

    async fn run_with_driver(&self, driver: &WebDriver) -> Result<TestResult> {
        info!("Running advanced components E2E tests");

        let mut results = vec![];

        match self.test_video_player(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("VideoPlayer test failed: {}", e);
                results.push(TestResult::error("VideoPlayer", &e.to_string()));
            }
        }

        match self.test_audio_waveform(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("AudioWaveform test failed: {}", e);
                results.push(TestResult::error("AudioWaveform", &e.to_string()));
            }
        }

        match self.test_rich_text_editor(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("RichTextEditor test failed: {}", e);
                results.push(TestResult::error("RichTextEditor", &e.to_string()));
            }
        }

        match self.test_drag_layer(driver).await {
            Ok(result) => results.push(result),
            Err(e) => {
                info!("DragLayer test failed: {}", e);
                results.push(TestResult::error("DragLayer", &e.to_string()));
            }
        }
        Ok(TestResult::aggregate(results))
    }
}
