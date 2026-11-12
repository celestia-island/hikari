# Input Champ de saisie

Le composant Input est un composant de saisie de formulaire de base qui prend en charge plusieurs états et styles personnalisés.

## Configuration à trois niveaux

Le composant Input prend en charge une architecture de configuration de variables CSS à trois niveaux :

- **Layer1 (Niveau de base)**: Définit les valeurs globales par défaut via les thèmes
- **Layer2 (Niveau composant)**: Définit les variables du composant via `input-vars.scss`
- **Custom (Runtime)**: Remplace dynamiquement via les propriétés du composant

## Utilisation de base

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "text", placeholder: "Basic input", style: "padding:8px 12px;border:1px solid #d9d9d9;border-radius:6px;font-size:14px;width:240px;" }
    }
}
```

## État désactivé

Le champ de saisie peut être désactivé, le rendant non éditable lorsqu'il est désactivé.

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "text", placeholder: "Disabled", disabled: true, style: "padding:8px 12px;border:1px solid #d9d9d9;border-radius:6px;font-size:14px;width:240px;background:#f5f5f5;color:#999;" }
    }
}
```

## Couleurs personnalisées

Les couleurs du champ de saisie peuvent être remplacées dynamiquement via les propriétés de la couche Custom.

```rust
Input {
    placeholder: "Custom styled input",
    text_color: Some("#ff0000".to_string()),        // Couleur du texte personnalisée
    border_color: Some("#ff4f00".to_string()),       // Couleur de la bordure personnalisée
    background_color: Some("rgba(255, 255, 255, 0.1)".to_string()), // Couleur de fond personnalisée
}
```

## Remplacement des variables CSS

Les variables CSS peuvent être remplacées par lots via la propriété `css_vars`.

```rust
Input {
    placeholder: "CSS Variables Override",
    css_vars: Some(vec![
        ("--hi-input-radius", "16px".to_string()),
        ("--hi-input-border-color-focus", "#22c55e".to_string()),
        ("--hi-input-shadow-focus", "0 0 0 2px rgba(34, 197, 94, 0.3)".to_string()),
    ]),
}
```

## Intégration d'animation

Les effets d'animation peuvent être intégrés avec AnimationBuilder via la propriété `animation_id`.

```rust
Input {
    placeholder: "Animated Input",
    animation_id: Some("animated-input".to_string()),
}

// Contrôler l'animation avec AnimationBuilder
AnimationBuilder::new()
    .style("--hi-input-border-color", "rgb(255, 79, 0)")
    .style("--hi-input-shadow-focus", "0 0 0 2px rgba(255, 79, 0, 0.3)")
    .duration(300)
    .apply_to_element("animated-input");
```

## API

### Input Props

| Propriété | Description | Type | Par défaut |
|-----------|-------------|------|------------|
| size | Taille du champ de saisie | InputSize | Medium |
| disabled | Si désactivé | bool | false |
| readonly | Si en lecture seule | bool | false |
| placeholder | Texte du placeholder | Option\<String\> | None |
| value | Valeur d'entrée | Option\<String\> | None |
| input_type | Type d'entrée | Option\<String\> | "text" |
| autofocus | Si autofocus automatique | bool | false |
| class | Classe CSS personnalisée | String | "" |
| prefix_icon | Icône de préfixe | Option\<Element\> | None |
| suffix_icon | Icône de suffixe | Option\<Element\> | None |
| oninput | Callback de saisie | Option\<EventHandler\<String\>\> | None |
| onfocus | Callback de focus | Option\<EventHandler\<FocusEvent\>\> | None |
| onblur | Callback de perte de focus | Option\<EventHandler\<FocusEvent\>\> | None |
| onkeydown | Callback de touche enfoncée | Option\<EventHandler\<KeyboardEvent\>\> | None |
| glow | Si l'effet de lueur est activé | bool | true |
| glow_blur | Intensité du flou de lueur | GlowBlur | Medium |
| glow_intensity | Intensité de la lueur | GlowIntensity | Soft |
| glow_color | Couleur de la lueur | GlowColor | Ghost |
| **Propriétés de la couche Custom** | | | |
| text_color | Couleur du texte personnalisée | Option\<String\> | None |
| placeholder_color | Couleur du placeholder personnalisée | Option\<String\> | None |
| border_color | Couleur de la bordure personnalisée | Option\<String\> | None |
| background_color | Couleur de fond personnalisée | Option\<String\> | None |
| animation_id | ID d'animation AnimationBuilder | Option\<String\> | None |
| css_vars | Remplacement par lot de variables CSS | Option\<Vec\<(&'static str, String)\>\> | None |

## Référence des variables CSS

### Variables CSS Input

| Variable | Description | Par défaut |
|----------|-------------|------------|
| --hi-input-text-color | Couleur du texte | var(--hi-color-text-primary) |
| --hi-input-text-color-disabled | Couleur du texte désactivé | var(--hi-color-text-disabled) |
| --hi-input-placeholder-color | Couleur du placeholder | var(--hi-color-text-secondary) |
| --hi-input-placeholder-opacity | Opacité du placeholder | 0.6 |
| --hi-input-bg | Couleur de fond | transparent |
| --hi-input-bg-disabled | Fond désactivé | rgba(255, 255, 255, 0.5) |
| --hi-input-border-color | Couleur de la bordure | var(--hi-color-border) |
| --hi-input-border-color-focus | Couleur de la bordure au focus | var(--hi-color-primary) |
| --hi-input-border-color-disabled | Couleur de la bordure désactivée | var(--hi-border-color-disabled) |
| --hi-input-border-color-error | Couleur de la bordure d'erreur | var(--hi-color-danger) |
| --hi-input-shadow-focus | Ombre au focus | 0 0 0 2px var(--hi-color-primary) |
| --hi-input-radius | Rayon de la bordure | var(--hi-radius-md) |
| --hi-input-padding-x | Padding horizontal | 0.75rem |
| --hi-input-padding-y | Padding vertical | 0.5rem |
| --hi-input-font-size | Taille de la police | var(--hi-font-size-sm) |

## Saisie de montant

`HkMoneyInput` est un champ de montant tenant compte de la devise. Son modèle est un **texte décimal canonique** : des chiffres, au plus un `.`, aucun séparateur de milliers et aucun symbole de devise (`""`, `"12"`, `"1.5"`, `"-0.25"`) ; `""` signifie « non défini / suivre » et n'est jamais converti en `0`.

Le champ n'est **jamais réécrit pendant la frappe** : le texte visible reste exactement ce qui a été saisi, la valeur canonique est émise à la frappe, le formatage d'affichage (milliers et précision de la devise) n'est appliqué qu'à la **perte du focus**, et le texte redevient éditable à la **prise de focus**. C'est pourquoi un `1.5` saisi reste `1.5` au lieu de se réduire à `5` en cours de frappe.

```hikari:tsx
<HkMoneyInput
  label="Prix unitaire"
  currency={{ code: "USD", symbol: "$", decimals: 2 }}
  min={0}
  modelValue={price}
  onUpdate:modelValue={(next: string) => (price = next)}
/>
```

`maxDecimals` vaut par défaut `currency.decimals` ; augmentez-le pour les taux (un prix au million peut demander 4 à 6 chiffres). `min` / `max` ne font que **signaler** le message de plage localisé : un montant hors plage n'est jamais tronqué dans le dos de l'utilisateur. Le symbole de la devise est dessiné dans le champ comme affixe décoratif, l'élément est un simple champ texte avec `inputmode="decimal"`, et `error` / `aria-invalid` / `aria-describedby` sont câblés par le composant.

| Propriété | Description | Type | Défaut |
|-----------|-------------|------|--------|
| modelValue | Texte décimal canonique | string | "" |
| currency | Devise (symbole, code, décimales) | HkCurrency | — |
| maxDecimals | Budget de décimales (précision à la sortie et arrondi) | number | currency.decimals |
| min / max | Bornes indicatives, signalées sans troncature | number | — |
| label / error / required / disabled | Habillage du champ | string / string / bool / bool | — |
| size | Échelon de taille | "sm" \| "md" \| "lg" | "md" |

## Devises

`HkCurrency` est le type de valeur partagé : `{ code, symbol?, name?, decimals }`. Ses utilitaires sont exportés par le barillet du paquet, si bien qu'un hôte peut formater un montant sans monter de contrôle : `formatMoney`, `parseMoney`, `canonicalMoneyText`, `currencyDisplayName`, `normalizeCurrency`, `isValidCurrency` et `currencySymbol`.

```hikari:tsx
formatMoney(1234.5, { code: "USD", decimals: 2 }); // "1,234.50"
parseMoney("1,234.50", 2);                          // 1234.5
currencyDisplayName("USD", "en");                   // "US Dollar"
```

`formatMoney` est volontairement indépendant de la locale (milliers `,`, décimale `.`) afin qu'une chaîne formatée redonne toujours le même nombre ; seule la **nom** de la devise est localisé — `Intl.DisplayNames`, puis le repli de l'appelant, puis le code.

```hikari:tsx
<HkCurrencySelect
  label="Devise de facturation"
  currencies={currencies}
  groups={[{ key: "common", label: "Fréquentes", codes: ["USD", "EUR"] }]}
  modelValue={code}
  onUpdate:modelValue={(next: string) => (code = next)}
/>
```

Les lignes de `HkCurrencySelect` portent le symbole, le code et le nom localisé ; la recherche correspond aux trois. La surface ouverte est le panneau déroulant partagé (popout bureau / feuille basse sur téléphone), le même que celui du composant select.
