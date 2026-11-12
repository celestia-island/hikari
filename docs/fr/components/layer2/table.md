# Table

Composant Table pour afficher des données structurées.

## Utilisation de Base

```hikari
rsx! {
    div { style: "padding:1rem;",
        table { style: "border-collapse:collapse;width:100%;font-size:14px;",
            thead { tr { th { style: "border:1px solid #e2e2ea;padding:8px;background:#f7f7fa;text-align:left;", "Name" }
                         th { style: "border:1px solid #e2e2ea;padding:8px;background:#f7f7fa;text-align:left;", "Status" } } }
            tbody { tr { td { style: "border:1px solid #e2e2ea;padding:8px;", "Task A" }
                         td { style: "border:1px solid #e2e2ea;padding:8px;color:#22c55e;", "Done" } } }
        }
    }
}
```

## API

| Propriété | Description | Type | Défaut |
|-----------|-------------|------|--------|
| columns | Définitions des colonnes | Vec\<Column\> | - |
| data | Source de données | Vec\<T\> | - |

## Tableau éditable

`HkEditableTable` est une coque d'édition en ligne **composée sur `HkTable`** : la grille, le rythme d'en-tête, le survol, les bandes de section et la structure restent dans `HkTable` ; la coque ajoute les cellules éditables, les affordances d'ajout/suppression et la validation ligne par ligne. Le composant est entièrement **contrôlé** : les objets de ligne et le tableau appartiennent à l'hôte, qui applique lui-même les intentions `add` / `remove(row, index)`. La coque ne modifie jamais une ligne, ce qui préserve un historique d'annulation ou un brouillon côté serveur.

```hikari:tsx
<HkEditableTable
  columns={[
    { key: "tier", title: "Offre" },
    { key: "price", title: "Prix unitaire", align: "right" },
  ]}
  rows={rows}
  rowKey="id"
  canAdd
  canRemove={() => rows.length > 1}
  validate={(row) => (row.price ? null : "Le prix unitaire est requis")}
  onAdd={() => rows.push(draftRow())}
  onRemove={(row) => rows.splice(rows.indexOf(row), 1)}
>
  {{
    "cell-tier": ({ row }) => <span>{row.tier}</span>,
    "edit-price": ({ row, error, errorId }) => (
      <HkMoneyInput
        currency={usd}
        error={error ?? undefined}
        aria-describedby={errorId ?? undefined}
        modelValue={row.price}
        onUpdate:modelValue={(next: string) => (row.price = next)}
      />
    ),
    "row-error": ({ index, error }) => <span>Ligne {index + 1} : {error}</span>,
  }}
</HkEditableTable>
```

Contrat de slots : `cell-<key>` affiche une colonne (omis : le texte `row[key]` de `HkTable`), `edit-<key>` monte l'éditeur de l'hôte — il l'emporte tant que le tableau est actif, et avec `disabled` le slot d'affichage reprend, si bien que la même grille devient lecture seule sans re-slotter —, et `row-error` rend la ligne d'une ligne invalide (omis : « Ligne N : message » localisé). Chaque slot de cellule reçoit `{ row, value, index, error, errorId, disabled }` ; liez `errorId` à l'`aria-describedby` de l'éditeur pour que le message soit lu avec le champ. Les lignes d'erreur vivent dans le composant (jamais dans le chrome de la page), sont clées par `rowKey` et annoncées dans une région live courtoise.

| Propriété | Description | Type | Défaut |
|-----------|-------------|------|--------|
| columns | Définitions de colonnes | HkEditableColumn[] | — |
| rows | Lignes de l'hôte (jamais modifiées) | Record\<string, unknown\>[] | [] |
| rowKey | Champ d'identité de ligne | string | — |
| validate | Validateur pur par ligne | (row, rows) => string \| null | — |
| canAdd / canRemove | Rendre la bande d'ajout / l'affordance de suppression par ligne | bool / (row) => bool | false / — |
| addLabel / emptyText / caption | Remplacements de texte localisé | string | — |
| disabled | Lecture seule (les éditeurs repassent en slots d'affichage) | bool | false |
