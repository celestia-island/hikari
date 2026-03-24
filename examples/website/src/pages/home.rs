//! Home page — hero section and navigation cards.

use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    rsx! {
        div { id: "page-home", class: "hikari-page",
            section { class: "page-hero",
                div { class: "page-hero__inner",
                    h1 { class: "page-hero__title",
                        "Hikari"
                    }
                    p { class: "page-hero__subtitle",
                        "A comprehensive Rust UI component library"
                    }
                    p { class: "page-hero__desc",
                        "Built with a reactive virtual DOM, compiled to WebAssembly. Hikari provides a rich set of components from basic primitives to complex data visualisations."
                    }
                    div { class: "page-hero__actions",
                        a { href: "/components", class: "hi-btn hi-btn--primary hi-btn--lg",
                            "Explore Components"
                        }
                        a { href: "/system", class: "hi-btn hi-btn--secondary hi-btn--lg",
                            "Design System"
                        }
                    }
                }
            }
            section { class: "page-section",
                h2 { class: "page-section__title",
                    "What is Hikari?"
                }
                div { class: "card-grid",
                    div { class: "card",
                        h3 { class: "card__title",
                            "Component Library"
                        }
                        p { class: "card__body",
                            "Layered architecture: Layer 1 (base primitives), Layer 2 (composed patterns), Layer 3 (complex widgets)."
                        }
                    }
                    div { class: "card",
                        h3 { class: "card__title",
                            "Design System"
                        }
                        p { class: "card__body",
                            "500+ traditional Chinese colours, CSS utility classes, icon library, animations, and i18n system."
                        }
                    }
                    div { class: "card",
                        h3 { class: "card__title",
                            "WebAssembly First"
                        }
                        p { class: "card__body",
                            "Ships as a wasm32-wasip2 component. Rendered with the Tairitsu virtual DOM — no JavaScript framework required."
                        }
                    }
                }
            }
        }
    }
}
