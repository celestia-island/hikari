use proc_macro2::TokenStream;
use quote::quote;
use syn::parse::{Parse, ParseStream};
use syn::{DeriveInput, Ident};

pub struct DeriveRoutes {
    ident: Ident,
}

impl Parse for DeriveRoutes {
    fn parse(input: ParseStream) -> syn::Result<Self> {
        let DeriveInput { ident, .. } = input.parse()?;

        Ok(Self { ident })
    }
}

pub fn root(input: DeriveRoutes) -> TokenStream {
    let DeriveRoutes { ident, .. } = &input;

    quote! {
        #[automatically_derived]
        impl ::hikari_boot::Routes for #ident {
        }
    }
}
