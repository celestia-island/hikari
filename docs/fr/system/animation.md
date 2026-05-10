# Système d'animation

Système d'animation déclaratif haute performance prenant en charge les valeurs statiques, les valeurs dynamiques, les chronologies complexes et plus de 30 fonctions d'easing.

## Table des matières

- [Aperçu](#aperçu)
- [Fonctionnalités principales](#fonctionnalités-principales)
- [AnimationBuilder](#animationbuilder)
- [Tween](#tween)
- [Easing](#easing)
- [Timeline](#timeline)
- [Presets](#presets)
- [Spotlight](#spotlight)
- [Context](#context)
- [Style](#style)
- [Exemples d'utilisation](#exemples-dutilisation)

## Aperçu

`hikari-animation` fournit une solution d'animation complète :

- **API déclarative** : Syntaxe fluide de type CSS
- **Valeurs dynamiques** : Valeurs d'animation calculées à l'exécution (comme le suivi de souris)
- **Haute performance** : Optimisé WASM, mises à jour debounced, requestAnimationFrame
- **Sécurité de type** : Propriétés CSS vérifiées à la compilation
- **Préréglages riches** : Fade, slide, scale et autres animations courantes

## Fonctionnalités principales

### 1. AnimationBuilder

Constructeur d'animation avancé prenant en charge :

- **Contrôle multi-éléments** : Contrôler plusieurs éléments DOM simultanément
- **Valeurs dynamiques** : Calcul en temps réel basé sur AnimationContext
- **Transitions automatiques** : Gestion intelligente des transitions
- **Sécurité de type** : L'énumération CssProperty empêche les fautes de frappe

### 2. Système Tween

Système d'animation d'interpolation :

- **Interpolation de valeurs** : Transitions numériques fluides
- **Easing personnalisé** : Plus de 30 fonctions d'easing intégrées
- **Contrôle du temps** : Contrôle de la durée et du délai
- **Itération de boucle** : Support pour la lecture en boucle

### 3. Fonctions d'easing

Riche bibliothèque de fonctions d'easing :

- **Basique** : Linear, EaseIn, EaseOut, EaseInOut
- **Sine** : Easing sinusoïdal
- **Quad** : Easing quadratique
- **Cubic** : Easing cubique
- **Quart** : Easing quartique
- **Quint** : Easing quintique
- **Expo** : Easing exponentiel
- **Circ** : Easing circulaire
- **Back** : Effet de retour/dépassement
- **Elastic** : Effet élastique
- **Bounce** : Effet de rebond

### 4. Timeline

Contrôle de la chronologie :

- **Animation séquentielle** : Jouer plusieurs animations en séquence
- **Animation parallèle** : Jouer plusieurs animations simultanément
- **Exécution différée** : Contrôle précis du timing
- **Groupes d'animation** : Organiser des séquences d'animation complexes

### 5. Presets

Bibliothèque d'animations prédéfinies :

- **Fade** : Fondu entrant/sortant
- **Slide** : Glissement entrant/sortant
- **Scale** : Animation de mise à l'échelle
- **Rotate** : Animation de rotation
- **Flip** : Animation de retournement
- **Zoom** : Zoom avant/arrière

### 6. Spotlight

Effet spotlight :

- **Suivi de souris** : L'effet de lueur suit le curseur de la souris
- **Éclairage dégradé** : Dégradés radiaux fluides
- **Performance** : Mises à jour debounced, repeintes throttled
- **Auto-init** : Scanner et initialiser les éléments spotlight

## AnimationBuilder

### Utilisation de base

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;
use std::collections::HashMap;

// Créer un mappage d'éléments
let mut elements = HashMap::new();
elements.insert("button".to_string(), button_element);

// Appliquer des styles statiques
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .add_class("button", "hi-flex")
    .apply();
```

### Animation de valeur dynamique

```rust
// Effet de suivi de souris
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply_with_transition("150ms", "ease-out");
```

### Animation multi-éléments

```rust
// Contrôler plusieurs éléments simultanément
let mut elements = HashMap::new();
elements.insert("button".to_string(), button_element);
elements.insert("icon".to_string(), icon_element);

AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .add_style("icon", CssProperty::Transform, "scale(1.1)")
    .add_class("button", "hi-flex")
    .apply();
```

### Animation de transition

```rust
// Animation avec transition
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Width, "100px")
    .apply_with_transition("300ms", "ease-in-out");

// Propriétés de transition personnalisées
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Transform, "rotate(90deg)")
    .apply_with_transition("500ms", "cubic-bezier(0.68, -0.55, 0.265, 1.55)");
```

### Référence API

```rust
impl AnimationBuilder {
    pub fn new(elements: &HashMap<String, Element>) -> Self;

    pub fn add_style(self, element: &str, property: CssProperty, value: &str) -> Self;
    pub fn add_style_dynamic<F>(self, element: &str, property: CssProperty, f: F) -> Self
    where
        F: Fn(&AnimationContext) -> String + 'static;

    pub fn add_class(self, element: &str, class: &str) -> Self;
    pub fn remove_class(self, element: &str, class: &str) -> Self;

    pub fn apply(self);
    pub fn apply_with_transition(self, duration: &str, easing: &str);
}
```

## Tween

Interpolation entre des valeurs au fil du temps.

### Tween de base

```rust
use hikari_animation::tween::{Tween, TweenBuilder};

let tween = TweenBuilder::new()
    .from(0.0)
    .to(100.0)
    .duration(1000) // ms
    .easing(ease::EaseOut)
    .build();
```

### Tween avec callbacks

```rust
let tween = TweenBuilder::new()
    .from(0.0)
    .to(1.0)
    .duration(500)
    .on_update(|value| {
        println!("Valeur actuelle: {}", value);
    })
    .on_complete(|| {
        println!("Animation terminée !");
    })
    .build();
```

### Tweens chaînés

```rust
let mut timeline = Timeline::new();

timeline.push(
    TweenBuilder::new()
        .from(0.0)
        .to(100.0)
        .duration(300)
        .build()
);

timeline.push(
    TweenBuilder::new()
        .from(100.0)
        .to(0.0)
        .duration(300)
        .delay(200)
        .build()
);

timeline.play();
```

## Easing

Les fonctions d'easing contrôlent la vitesse de l'animation.

### Easing de base

```rust
use hikari_animation::easing;

// Linear - pas d'easing
linear(0.5); // 0.5

// Ease In - commence lentement, termine rapidement
ease_in(0.5); // 0.25

// Ease Out - commence rapidement, termine lentement
ease_out(0.5); // 0.75

// Ease In Out - lent aux deux extrémités
ease_in_out(0.5); // 0.5
```

### Easing avancé

```rust
// Back - dépasse légèrement
back_out(0.5); // 1.2

// Elastic - oscille
elastic_out(0.5); // 1.0

// Bounce - rebondit à la fin
bounce_out(0.5); // 0.75
```

### Toutes les fonctions d'easing

```rust
// Basique
pub fn linear(t: f64) -> f64;
pub fn ease_in(t: f64) -> f64;
pub fn ease_out(t: f64) -> f64;
pub fn ease_in_out(t: f64) -> f64;

// Sine
pub fn sine_in(t: f64) -> f64;
pub fn sine_out(t: f64) -> f64;
pub fn sine_in_out(t: f64) -> f64;

// Quad
pub fn quad_in(t: f64) -> f64;
pub fn quad_out(t: f64) -> f64;
pub fn quad_in_out(t: f64) -> f64;

// Cubic
pub fn cubic_in(t: f64) -> f64;
pub fn cubic_out(t: f64) -> f64;
pub fn cubic_in_out(t: f64) -> f64;

// Quart
pub fn quart_in(t: f64) -> f64;
pub fn quart_out(t: f64) -> f64;
pub fn quart_in_out(t: f64) -> f64;

// Quint
pub fn quint_in(t: f64) -> f64;
pub fn quint_out(t: f64) -> f64;
pub fn quint_in_out(t: f64) -> f64;

// Expo
pub fn expo_in(t: f64) -> f64;
pub fn expo_out(t: f64) -> f64;
pub fn expo_in_out(t: f64) -> f64;

// Circ
pub fn circ_in(t: f64) -> f64;
pub fn circ_out(t: f64) -> f64;
pub fn circ_in_out(t: f64) -> f64;

// Back
pub fn back_in(t: f64) -> f64;
pub fn back_out(t: f64) -> f64;
pub fn back_in_out(t: f64) -> f64;

// Elastic
pub fn elastic_in(t: f64) -> f64;
pub fn elastic_out(t: f64) -> f64;
pub fn elastic_in_out(t: f64) -> f64;

// Bounce
pub fn bounce_in(t: f64) -> f64;
pub fn bounce_out(t: f64) -> f64;
pub fn bounce_in_out(t: f64) -> f64;
```

## Timeline

Contrôler les séquences d'animation et le timing.

### Animations séquentielles

```rust
use hikari_animation::Timeline;

let mut timeline = Timeline::new();

// Ajouter des animations en séquence
timeline.add(
    AnimationBuilder::new(&elements)
        .add_style("box", CssProperty::Opacity, "0")
        .build()
);

timeline.add(
    AnimationBuilder::new(&elements)
        .add_style("box", CssProperty::Opacity, "1")
        .with_delay(200)
        .build()
);

timeline.play();
```

### Animations parallèles

```rust
let mut timeline = Timeline::new();

// Jouer des animations simultanément
timeline.add_parallel(
    AnimationBuilder::new(&elements)
        .add_style("box", CssProperty::Transform, "translateX(100px)")
        .build()
);

timeline.add_parallel(
    AnimationBuilder::new(&elements)
        .add_style("box", CssProperty::Opacity, "0.5")
        .build()
);

timeline.play();
```

### Contrôle de la timeline

```rust
let timeline = Timeline::new();

// Contrôler la lecture
timeline.play();      // Démarrer la lecture
timeline.pause();     // Mettre en pause
timeline.reverse();   // Inverser la lecture
timeline.seek(0.5);   // Aller à 50%

// Contrôler la vitesse
timeline.set_speed(2.0);  // Vitesse 2x
timeline.set_speed(0.5);  // Vitesse 0.5x

// Contrôle de boucle
timeline.set_loop(true);
timeline.set_repeat_count(3);
```

## Presets

Animations prédéfinies.

### Animations de fondu

```rust
use hikari_animation::presets;

// Fondu entrant
presets::fade_in(&elements, "box", 300);

// Fondu sortant
presets::fade_out(&elements, "box", 300);

// Fondu vers une opacité spécifique
presets::fade_to(&elements, "box", 0.5, 300);
```

### Animations de glissement

```rust
// Glissement entrant depuis la gauche
presets::slide_in_left(&elements, "box", 300);

// Glissement entrant depuis la droite
presets::slide_in_right(&elements, "box", 300);

// Glissement sortant vers la gauche
presets::slide_out_left(&elements, "box", 300);

// Glissement entrant depuis le haut
presets::slide_in_top(&elements, "box", 300);
```

### Animations de mise à l'échelle

```rust
// Agrandir
presets::scale_up(&elements, "box", 1.5, 300);

// Réduire
presets::scale_down(&elements, "box", 0.8, 300);

// Pulsation
presets::pulse(&elements, "box", 300);
```

### Animations de rotation

```rust
// Rotation horaire
presets::rotate_cw(&elements, "box", 90, 500);

// Rotation anti-horaire
presets::rotate_ccw(&elements, "box", 90, 500);

// Retournement
presets::flip_x(&elements, "box", 500);
presets::flip_y(&elements, "box", 500);
```

### Presets personnalisés

```rust
use hikari_animation::presets::PresetBuilder;

let custom_preset = PresetBuilder::new()
    .duration(500)
    .easing("ease-out")
    .add_keyframe(0.0, vec![
        (CssProperty::Opacity, "0"),
        (CssProperty::Transform, "translateY(-20px)")
    ])
    .add_keyframe(1.0, vec![
        (CssProperty::Opacity, "1"),
        (CssProperty::Transform, "translateY(0)")
    ])
    .build();

custom_preset.apply(&elements, "element");
```

## Spotlight

Effet de lueur suivant la souris pour les éléments.

### Spotlight de base

```rust
use hikari_animation::spotlight;

// Initialiser spotlight sur tous les boutons
spotlight::init();

// Ou initialiser sur des éléments spécifiques
spotlight::init_selector(".hi-button");
```

### Spotlight personnalisé

```rust
spotlight::Config {
    size: 200,              // Taille du spotlight en px
    opacity: 0.15,          // Opacité (0-1)
    color: "#00A0E9",       // Couleur de la lueur
    blur: 20,              // Rayon de flou en px
    transition: "150ms"     // Vitesse de transition
}.init();
```

### Spotlight dans les composants

```rust
rsx! {
    Button {
        label: "Survolez-moi",
        class: "hi-spotlight",  // Activer spotlight
        "Data: spot-{spot_id}"   // Identifiant unique
    }
}
```

### Désactiver Spotlight

```rust
// Désactiver sur des éléments spécifiques
spotlight::disable_selector(".no-spotlight");

// Désactiver tout
spotlight::disable_all();
```

## Context

Le contexte d'animation fournit des informations d'exécution.

### Position de la souris

```rust
AnimationBuilder::new(&elements)
    .add_style_dynamic("target", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply();
```

### Animation basée sur le temps

```rust
.add_style_dynamic("clock", CssProperty::Transform, |ctx| {
    let time = ctx.elapsed_time();
    let angle = (time.as_millis() % 1000) as f64 / 1000.0 * 360.0;
    format!("rotate({}deg)", angle)
})
```

### Position de défilement

```rust
.add_style_dynamic("header", CssProperty::Background, |ctx| {
    let scroll_y = ctx.scroll_y();
    let opacity = (scroll_y / 100.0).min(1.0);
    format!("rgba(0, 160, 233, {})", opacity)
})
```

## Style

Manipulation de propriétés CSS avec sécurité de type.

### Énumération CssProperty

```rust
use hikari_animation::style::CssProperty;

// Propriétés de couleur
CssProperty::Color
CssProperty::BackgroundColor
CssProperty::BorderColor

// Propriétés de disposition
CssProperty::Width
CssProperty::Height
CssProperty::Margin
CssProperty::Padding

// Propriétés de transformation
CssProperty::Transform
CssProperty::Translate
CssProperty::Scale
CssProperty::Rotate

// Propriétés d'effet
CssProperty::Opacity
CssProperty::BoxShadow
CssProperty::Filter
```

### Manipulation de style

```rust
// Définir une propriété unique
builder.add_style("element", CssProperty::Color, "#00A0E9");

// Définir une transformation
builder.add_style("element", CssProperty::Transform, "translate(10px, 20px)");

// Définir l'opacité
builder.add_style("element", CssProperty::Opacity, "0.5");

// Transformation complexe
builder.add_style("element", CssProperty::Transform,
    "perspective(1000px) rotateX(45deg) translateZ(50px)");
```

### Propriétés CSS personnalisées

```rust
// Propriété personnalisée
builder.add_style("element", CssProperty::Custom("--my-var"), "value");

// Et l'utiliser
builder.add_style("element", CssProperty::Color, "var(--my-var)");
```

## Exemples d'utilisation

### Effet de survol de bouton

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;

#[component]
fn AnimatedButton() -> Element {
    let elements = use_signal(|| {
        let mut map = HashMap::new();
        map.insert("btn".to_string(), get_button_element());
        map
    });

    rsx! {
        button {
            class: "hi-button hi-spotlight",
            onmouseenter: move |_| {
                AnimationBuilder::new(&elements())
                    .add_style("btn", CssProperty::Transform, "scale(1.05)")
                    .add_style("btn", CssProperty::BoxShadow, "0 8px 16px rgba(0, 160, 233, 0.3)")
                    .apply_with_transition("200ms", "ease-out");
            },
            onmouseleave: move |_| {
                AnimationBuilder::new(&elements())
                    .add_style("btn", CssProperty::Transform, "scale(1)")
                    .add_style("btn", CssProperty::BoxShadow, "none")
                    .apply_with_transition("200ms", "ease-out");
            },
            "Survolez-moi"
        }
    }
}
```

### Animation de chargement

```rust
#[component]
fn LoadingSpinner() -> Element {
    let elements = use_signal(|| HashMap::new());

    use_effect(move || {
        let elements = elements.clone();
        async move {
            loop {
                AnimationBuilder::new(&elements())
                    .add_style("spinner", CssProperty::Transform, "rotate(0deg)")
                    .build();

                AnimationBuilder::new(&elements())
                    .add_style("spinner", CssProperty::Transform, "rotate(360deg)")
                    .apply_with_transition("1000ms", "linear");

                tokio::time::sleep(Duration::from_millis(1000)).await;
            }
        }
    });

    rsx! {
        div {
            id: "spinner",
            style: "width: 40px; height: 40px; border: 4px solid var(--hi-color-primary); border-top-color: transparent; border-radius: 50%;"
        }
    }
}
```

### Défilement parallaxe

```rust
#[component]
fn ParallaxSection() -> Element {
    let scroll_y = use_signal(|| 0.0);

    rsx! {
        div {
            onscroll: move |e| {
                scroll_y.set(e.scroll_y());

                AnimationBuilder::new(&elements())
                    .add_style_dynamic("bg", CssProperty::Transform, |ctx| {
                        let y = ctx.scroll_y() * 0.5;
                        format!("translateY({}px)", y)
                    })
                    .apply_with_transition("100ms", "ease-out");
            },
            div {
                id: "bg",
                style: "position: fixed; width: 100%; height: 100%; background: url(bg.jpg);"
            },
            div {
                style: "position: relative; z-index: 1;",
                "Contenu"
            }
        }
    }
}
```

### Compteur animé

```rust
#[component]
fn AnimatedCounter() -> Element {
    let mut count = use_signal(|| 0);

    use_effect(move || {
        let target = 1000;
        let duration = 2000; // 2 secondes
        let steps = 60;
        let step_value = target as f64 / steps as f64;
        let step_duration = duration / steps;

        async move {
            for i in 0..=steps {
                count.set((i as f64 * step_value) as i32);
                tokio::time::sleep(Duration::from_millis(step_duration)).await;
            }
        }
    });

    rsx! {
        div {
            class: "counter",
            "{count()}"
        }
    }
}
```

## Optimisation des performances

### Debounce des mises à jour

```rust
use hikari_animation::AnimationBuilder;

// AnimationBuilder debounce automatiquement les mises à jour
AnimationBuilder::new(&elements)
    .add_style_dynamic("element", CssProperty::Transform, |ctx| {
        // Ceci est debounced - ne se met pas à jour à chaque mousemove
        let x = ctx.mouse_x();
        format!("translateX({}px)", x)
    })
    .apply_with_transition("100ms", "ease-out");
```

### RequestAnimationFrame

Le système d'animation utilise `requestAnimationFrame` pour des animations fluides à 60fps :

```rust
// Intégration RAF automatique
AnimationBuilder::new(&elements)
    .add_style("anim", CssProperty::Opacity, "1")
    .apply_with_transition("1000ms", "ease");
```

### Accélération GPU

Utiliser transform et opacity pour les animations accélérées par GPU :

```rust
// ✅ Bon - Accéléré par GPU
builder.add_style("element", CssProperty::Transform, "translateX(100px)");
builder.add_style("element", CssProperty::Opacity, "0.5");

// ❌ À éviter - déclenche le layout
builder.add_style("element", CssProperty::Width, "100px");
builder.add_style("element", CssProperty::Margin, "10px");
```

### Indice will-change

```css
/* Indiquer au navigateur pour optimisation */
.animated-element {
    will-change: transform, opacity;
}
```

## Référence API

### AnimationBuilder

```rust
pub struct AnimationBuilder<'a> {
    elements: &'a HashMap<String, Element>,
}

impl<'a> AnimationBuilder<'a> {
    pub fn new(elements: &'a HashMap<String, Element>) -> Self;

    pub fn add_style(self, element: &str, property: CssProperty, value: &str) -> Self;
    pub fn add_style_dynamic<F>(self, element: &str, property: CssProperty, f: F) -> Self
    where
        F: Fn(&AnimationContext) -> String + 'static;

    pub fn add_class(self, element: &str, class: &str) -> Self;
    pub fn remove_class(self, element: &str, class: &str) -> Self;

    pub fn apply(self);
    pub fn apply_with_transition(self, duration: &str, easing: &str);
    pub fn apply_with_custom_transition(self, transition: &str);
}
```

### AnimationContext

```rust
pub struct AnimationContext<'a> {
    pub mouse_x: f64,
    pub mouse_y: f64,
    pub scroll_x: f64,
    pub scroll_y: f64,
    pub elapsed_time: Duration,
    pub window_width: f64,
    pub window_height: f64,
}

impl<'a> AnimationContext<'a> {
    pub fn mouse_x(&self) -> f64;
    pub fn mouse_y(&self) -> f64;
    pub fn scroll_x(&self) -> f64;
    pub fn scroll_y(&self) -> f64;
    pub fn elapsed_time(&self) -> Duration;
}
```

### Timeline

```rust
pub struct Timeline {
    // interne
}

impl Timeline {
    pub fn new() -> Self;

    pub fn add(&mut self, animation: Animation) -> &mut Self;
    pub fn add_parallel(&mut self, animation: Animation) -> &mut Self;

    pub fn play(&mut self);
    pub fn pause(&mut self);
    pub fn stop(&mut self);
    pub fn reverse(&mut self);
    pub fn seek(&mut self, progress: f64);

    pub fn set_speed(&mut self, speed: f64);
    pub fn set_loop(&mut self, loop: bool);
    pub fn set_repeat_count(&mut self, count: usize);
}
```

## Bonnes pratiques

### 1. Utiliser les transitions avec parcimonie

```rust
// ✅ Bon - Uniquement lors de l'interaction utilisateur
button {
    onmouseenter: move |_| {
        builder.apply_with_transition("200ms", "ease");
    }
}

// ❌ À éviter - Animation continue
loop {
    builder.apply_with_transition("16ms", "linear"); // 60fps, lourd !
}
```

### 2. Préférer transform au layout

```rust
// ✅ Bon - Accéléré par GPU
builder.add_style("el", CssProperty::Transform, "translateX(100px)");

// ❌ À éviter - Layout thrashing
builder.add_style("el", CssProperty::Margin, "100px");
```

### 3. Utiliser l'easing approprié

```rust
// Sensation naturelle
"ease-out"      // Décélérer
"ease-in-out"   // Accélérer puis décélérer

// Sensation mécanique
"linear"        // Vitesse constante

// Sensation ludique
"elastic-out"   // Rebondit
"bounce-out"    // Rebondit à la fin
```

### 4. Respecter le mouvement réduit

```rust
use_effect(move || {
    let prefers_reduced_motion = window()
        .match_media("(prefers-motion: reduce)")
        .ok()
        .and_then(|m| m.matches());

    if prefers_reduced_motion.unwrap_or(false) {
        // Utiliser des animations plus simples
        builder.apply_with_transition("0ms", "linear");
    } else {
        // Animation complète
        builder.apply_with_transition("300ms", "ease-out");
    }
});
```

## Systèmes liés

- [Système de thème](./theme.md) - Variables CSS pour les animations
- [Composants](../components/) - Composants UI animés
- [Système de palette](./palette.md) - Définitions des couleurs
