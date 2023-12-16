mod utils;

#[proc_macro]
pub fn register_routes(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let input = proc_macro2::TokenStream::from(input);
    let output = utils::register_routes::transform_macro(input);
    proc_macro::TokenStream::from(output)
}
