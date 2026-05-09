//! Hikari Design System website.
//!
//! Built with Tairitsu framework, compiled to wasm32-wasip2.
//!
//! Type-safe CSS class enums — one per component SCSS source.
//! Each enum variant maps 1:1 to a `.class-name` in that stylesheet.
//! Typos are caught at compile time.

tairitsu_macros::include_scss!("../../packages/components/src/styles/components/button.scss");
tairitsu_macros::include_scss!("../../packages/components/src/styles/components/input.scss", prefix: "HiInput");
tairitsu_macros::include_scss!("../../packages/components/src/styles/components/switch.scss", prefix: "HiSwitch");
tairitsu_macros::include_scss!("../../packages/components/src/styles/components/toast.scss", prefix: "HiToast");
tairitsu_macros::include_scss!("../../packages/components/src/styles/components/table.scss", prefix: "HiTable");
tairitsu_macros::include_scss!("../../packages/components/src/styles/components/skeleton.scss", prefix: "HiSkeleton");

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
mod scrollbar_host;
mod theme;
mod ui;

use tairitsu_web::WitPlatform;

fn run_app() {
    i18n_init::init();
    let platform = WitPlatform::new().expect("WitPlatform init failed");
    let vnode = app::render();
    let _ = platform.mount_vnode_to_app(vnode);

    #[cfg(target_family = "wasm")]
    {
        let host = scrollbar_host::PlatformScrollbarHost::new(&platform);
        hikari_components::scripts::scrollbar_container::init_all(&host);
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn tairitsu_component_bootstrap() {
    run_app();
}

#[unsafe(no_mangle)]
pub extern "C" fn hikari_anim_freeze() {
    hikari_components::platform::freeze_animations();
}

#[unsafe(no_mangle)]
pub extern "C" fn hikari_anim_unfreeze() {
    hikari_components::platform::unfreeze_animations();
}
