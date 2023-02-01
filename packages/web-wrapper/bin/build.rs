#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use log::info;
use std::process::{Command, Stdio};

use hikari_web_wrapper::build;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    env_logger::Builder::new()
        .filter(None, log::LevelFilter::Trace)
        .init();

    build().await?;

    info!("Building the application.");
    Command::new("cargo")
        .arg("build")
        .arg("--release")
        .arg("--package")
        .arg("hikari-router")
        .stdout(Stdio::piped())
        .spawn()?
        .wait()?;

    Ok(())
}
