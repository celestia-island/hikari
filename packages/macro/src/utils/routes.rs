use std::collections::HashMap;

use proc_macro2::TokenStream;
use quote::quote;
use syn::parse::{Parse, ParseStream};
use syn::punctuated::Punctuated;
use syn::spanned::Spanned;
use syn::{Data, DeriveInput, Fields, Ident, Path, Variant};

const COMPONENT_ATTR_IDENT: &str = "component";

pub struct DeriveRoutes {
    ident: Ident,
    components: HashMap<Ident, Path>,
}

impl Parse for DeriveRoutes {
    fn parse(input: ParseStream) -> syn::Result<Self> {
        let DeriveInput { ident, data, .. } = input.parse()?;

        let data = match data {
            Data::Enum(data) => data,
            Data::Struct(s) => {
                return Err(syn::Error::new(
                    s.struct_token.span(),
                    "expected enum, found struct",
                ))
            }
            Data::Union(u) => {
                return Err(syn::Error::new(
                    u.union_token.span(),
                    "expected enum, found union",
                ))
            }
        };

        let components = parse_variants_attributes(&data.variants)?;

        Ok(Self { ident, components })
    }
}

fn parse_variants_attributes(
    variants: &Punctuated<Variant, syn::token::Comma>,
) -> syn::Result<HashMap<Ident, Path>> {
    let mut components: HashMap<Ident, Path> = Default::default();

    for variant in variants.iter() {
        if let Fields::Unnamed(ref field) = variant.fields {
            return Err(syn::Error::new(
                field.span(),
                "only named fields are supported",
            ));
        }

        let attrs = &variant.attrs;
        let at_attrs = attrs
            .iter()
            .filter(|attr| attr.path().is_ident(COMPONENT_ATTR_IDENT))
            .collect::<Vec<_>>();

        let attr = match at_attrs.len() {
            1 => *at_attrs.first().unwrap(),
            0 => {
                return Err(syn::Error::new(
                    variant.span(),
                    format!("{COMPONENT_ATTR_IDENT} attribute must be present on every variant"),
                ))
            }
            _ => {
                return Err(syn::Error::new_spanned(
                    quote! { #(#at_attrs)* },
                    format!("only one {COMPONENT_ATTR_IDENT} attribute must be present"),
                ))
            }
        };
        let lit = attr.parse_args::<Path>()?;

        components.insert(variant.ident.clone(), lit);
    }

    Ok(components)
}

pub fn root(input: DeriveRoutes) -> TokenStream {
    let DeriveRoutes {
        components, ident, ..
    } = &input;
    let (ats, components): (Vec<_>, Vec<_>) = components
        .iter()
        .map(|(ident, path)| {
            let ats = quote! { #ident };
            let components = quote! { ::yew::html! { <#path /> } };
            (ats, components)
        })
        .unzip();

    quote! {
        impl ::hikari_boot::DeclRoutes for #ident {
            #[allow(bindings_with_variant_name)]
            fn switch(route: &Self) -> ::yew::Html {
                match route {
                    #(#ats => #components,)*
                }
            }
        }
    }
}
