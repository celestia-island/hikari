use proc_macro2::TokenStream;
use quote::quote;
use syn::parse::{Parse, ParseStream};
use syn::{DeriveInput, Ident};

pub struct DeriveAppStates {
    ident: Ident,
}

impl Parse for DeriveAppStates {
    fn parse(input: ParseStream) -> syn::Result<Self> {
        let DeriveInput { ident, .. } = input.parse()?;

        Ok(Self { ident })
    }
}

pub fn root(input: DeriveAppStates) -> TokenStream {
    let DeriveAppStates { ident, .. } = &input;

    quote! {
        #[automatically_derived]
        impl ::hikari_boot::AppStates for #ident {
            type AppStates = Self;
        }
    }
}
