//! Home page — hero section and navigation cards.

use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    rsx! {
        div { id: "page-home", class: "hikari-page",
            section { class: "page-hero",
                div { class: "page-hero__inner",
                    img {
                        class: "page-hero__logo",
                        src: "/images/logo.png",
                        alt: "Hikari Logo",
                        width: "80"
                    }
                    h1 { class: "page-hero__title", "Hikari" }
                    p { class: "page-hero__subtitle", "A modern Rust UI component library for Tairitsu." }
                    p { class: "page-hero__tagline", "There is no shame in wanting to feel happy." }
                    div { class: "page-hero__actions",
                        a {
                            href: "/components",
                            class: "hi-btn hi-btn--primary hi-btn--lg",
                            "Explore Components ",
                            span { class: "btn-arrow", "→" }
                        }
                        a {
                            href: "/system",
                            class: "hi-btn hi-btn--secondary hi-btn--lg",
                            "View Documentation"
                        }
                    }
                }
            }
            section { class: "page-section",
                h2 { class: "page-section__title", "What is Hikari?" }
                div { class: "card-grid",
                    div { class: "card",
                        h3 { class: "card__title", "Component Library" }
                        p { class: "card__body",
                            "Layered architecture: Layer 1 (base primitives), Layer 2 (composed patterns), Layer 3 (complex widgets)."
                        }
                    }
                    div { class: "card",
                        h3 { class: "card__title", "Design System" }
                        p { class: "card__body",
                            "500+ traditional Chinese colours, CSS utility classes, icon library, animations, and i18n system."
                        }
                    }
                    div { class: "card",
                        h3 { class: "card__title", "WebAssembly First" }
                        p { class: "card__body",
                            "Ships as a wasm32-wasip2 component. Rendered with the Tairitsu virtual DOM — no JavaScript framework required."
                        }
                    }
                }
            }
            section { class: "page-section",
                h2 { class: "page-section__title", "Demos" }
                p { class: "page-section__desc",
                    "Complete application examples showcasing Hikari components in realistic scenarios."
                }
            }
        }
    }
}
