use hikari_proto::register_routes;

register_routes!(
    app,
    crate::utils::routes::Route,
    crate::utils::routes::switch,
    crate::utils::contexts::app_props::AppPageProps,
    crate::utils::contexts::app_props::AppPropsContextShell,
    crate::utils::contexts::app_states::AppStatesContextShell
);

pub use app::{App, AppProps, ServerApp};
