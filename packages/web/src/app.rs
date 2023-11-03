use crate::utils::{
    contexts::{
        app_props::{AppPageProps, AppPropsContextShell},
        app_states::AppStatesContextShell,
    },
    routes::{switch, Route},
};
use hikari_proto::register_routes;

register_routes!(
    Route,
    switch,
    AppPageProps,
    AppPropsContextShell,
    AppStatesContextShell
);
