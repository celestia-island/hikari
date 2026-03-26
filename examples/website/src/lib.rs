//! Hikari Design System website.
//!
//! Built with Tairitsu framework, compiled to wasm32-wasip2.

mod app;
mod components;
mod pages;
mod theme;

use anyhow::Result;

use tairitsu_web::WitPlatform;
use tracing::error;

fn run_app() -> Result<()> {
    let platform = WitPlatform::new()?;
    let vnode = app::render();
    platform.mount_vnode_to_app(&vnode)?;
    Ok(())
}

#[no_mangle]
pub extern "C" fn tairitsu_component_bootstrap() {
    if let Err(err) = run_app() {
        error!("website failed to start: {err}");
    }
}
