// hikari-e2e/src/tests/mod.rs
// Test modules for E2E testing

pub mod basic_simple;

use anyhow::Result;

use thirtyfour::WebDriver;

#[allow(async_fn_in_trait)]
pub trait Test {
    fn name(&self) -> &str;
    fn setup(&self) -> Result<()>;
    async fn run_with_driver(&self, driver: &WebDriver) -> Result<basic_simple::TestResult>;
}

pub use basic_simple::{BasicComponentsTests, TestResult, TestStatus};
