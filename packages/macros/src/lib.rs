use proc_macro::TokenStream;
use syn::parse_macro_input;

mod utils;

#[proc_macro_derive(DeriveApplication)]
pub fn app(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as utils::app::DeriveApp);
    utils::app::root(input).into()
}

#[proc_macro_derive(DeriveRoutes, attributes(component))]
pub fn routes(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as utils::routes::DeriveRoutes);
    utils::routes::root(input).into()
}
