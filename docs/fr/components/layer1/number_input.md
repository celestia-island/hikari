# Number Input Saisie numérique

Le composant Number Input est utilisé pour la saisie numérique avec support de l'incrémenteur.

## Utilisation de base

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:inline-flex;border:1px solid #d9d9d9;border-radius:6px;overflow:hidden;",
            button { style: "padding:4px 12px;border:none;background:#f5f5f5;cursor:pointer;", "−" }
            input { type: "text", value: "0", style: "padding:8px;width:60px;border:none;text-align:center;font-size:14px;" }
            button { style: "padding:4px 12px;border:none;background:#f5f5f5;cursor:pointer;", "+" }
        }
    }
}
```

## Tailles

Trois tailles disponibles : Petit, Moyen (par défaut) et Grand.

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        input { type: "text", value: "1", style: "padding:4px 8px;width:50px;border:1px solid #ccc;border-radius:4px;font-size:12px;text-align:center;" }
        input { type: "text", value: "10", style: "padding:8px 12px;width:60px;border:1px solid #ccc;border-radius:6px;font-size:14px;text-align:center;" }
        input { type: "text", value: "100", style: "padding:12px 16px;width:80px;border:1px solid #ccc;border-radius:8px;font-size:16px;text-align:center;" }
    }
}
```

## État désactivé

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:inline-flex;border:1px solid #d9d9d9;border-radius:6px;overflow:hidden;opacity:0.5;",
            button { disabled: true, style: "padding:4px 12px;border:none;background:#f5f5f5;", "−" }
            input { type: "text", value: "0", disabled: true, style: "padding:8px;width:60px;border:none;text-align:center;" }
            button { disabled: true, style: "padding:4px 12px;border:none;background:#f5f5f5;", "+" }
        }
    }
}
```

## Incrémenteur avec plage

Vous pouvez définir la valeur minimale, la valeur maximale et la taille du pas.

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:inline-flex;border:1px solid #d9d9d9;border-radius:6px;",
            button { style: "padding:8px 16px;border:none;background:#3a6ea5;color:#fff;cursor:pointer;", "−" }
            span { style: "padding:8px 24px;font-size:16px;font-weight:600;", "5" }
            button { style: "padding:8px 16px;border:none;background:#3a6ea5;color:#fff;cursor:pointer;", "+" }
        }
    }
}
```

## API

| Propriété | Description | Type | Défaut |
|-----------|-------------|------|--------|
| value | Valeur actuelle | i64 | 0 |
| on_change | Callback de changement de valeur | EventHandler<i64> | - |
| min | Valeur minimale | Option<i64> | None |
| max | Valeur maximale | Option<i64> | None |
| step | Taille du pas | i64 | 1 |
| disabled | Si désactivé | bool | false |
| size | Variante de taille | NumberInputSize | Medium |
| class | Nom de classe personnalisé | String | "" |
| style | Style personnalisé | String | "" |

### NumberInputSize

- `Small` - Petite taille (24px)
- `Medium` - Taille moyenne (32px, par défaut)
- `Large` - Grande taille (40px)
