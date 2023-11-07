extern crate proc_macro;

mod macros;

use proc_macro::TokenStream;

#[proc_macro_attribute]
pub fn as_routes(arg: TokenStream, input: TokenStream) -> TokenStream {
    macros::as_routes(arg, input)
}
