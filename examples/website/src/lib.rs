//! Hikari Design System website.
//!
//! Built with Tairitsu framework, compiled to wasm32-wasip2.

mod animation;
mod app;
mod components;
mod dynamic_docs;
mod hooks;
mod i18n_init;
mod js;
mod markdown;
mod pages;
mod reactive;
mod routing;
mod theme;
mod ui;

use anyhow::Result;

use tairitsu_web::WitPlatform;
use tracing::error;

fn run_app() {
    i18n_init::init();
    let platform = WitPlatform::new().expect("WitPlatform init failed");
    let vnode = app::render();
    // Mount the VNode to #app element
    let _ = platform.mount_vnode_to_app(&vnode);
}

#[unsafe(no_mangle)]
pub extern "C" fn tairitsu_component_bootstrap() {
    run_app();
}
