use proc_macro::TokenStream;
use syn::parse_macro_input;

mod utils;

#[proc_macro_derive(DeriveRoutes, attributes(component))]
pub fn routes(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as utils::routes::DeriveRoutes);
    utils::routes::root(input).into()
}

#[proc_macro_derive(DeriveAppProps)]
pub fn app_props(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as utils::app_props::DeriveAppProps);
    utils::app_props::root(input).into()
}

#[proc_macro_derive(DeriveAppStates)]
pub fn app_states(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as utils::app_states::DeriveAppStates);
    utils::app_states::root(input).into()
}
