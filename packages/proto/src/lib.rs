extern crate proc_macro;

use proc_macro::TokenStream;
use proc_macro2::Ident;
use quote::quote;
use syn::{parse_macro_input, DeriveInput};

#[proc_macro_attribute]
pub fn register_routes(_args: TokenStream, input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);

    let enum_name = &input.ident;

    let data = match &input.data {
        syn::Data::Enum(data) => data.clone(),
        _ => panic!("Only enums are supported"),
    };
    let variants = data
        .variants
        .iter()
        .map(|variant| {
            let str = &variant.ident;
            str.to_string()
        })
        .reduce(|a, b| format!("{}, {}", a, b))
        .unwrap();
    let variants = format!(r#""{variants}""#);
    let variants: syn::Expr = syn::parse_str(variants.as_str()).unwrap();

    quote!(
        #input

        impl #enum_name {
            pub fn print_enums_test(&self) {
                // print all the value from #variants

                println!("{}", #variants);
            }
        }
    )
    .into()
}
