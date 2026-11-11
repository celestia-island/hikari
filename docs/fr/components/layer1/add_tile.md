# Add Tile

HkAddTile est la tuile pointillée standard pour inviter à une action :
l'état vide d'une liste, la ligne « en ajouter un de plus » à la fin
d'une liste et la zone de choix / dépôt de fichiers. Une anatomie,
trois formes canoniques.

## Utilisation de base

```hikari:tsx
<HkAddTile onClick={openAdd}>Aucune source — ajoutez-en une pour commencer</HkAddTile>
```

Le runtime Vue arrive d'abord ; le miroir Rust suivra lorsqu'un hôte
Rust consommera la tuile.

## Formes

- par défaut — bloc vertical centré (icône au-dessus du libellé) :
  l'état vide d'une liste ou d'un panneau.
- `compact` — ligne fine alignée à gauche («＋ en ajouter un de plus »)
  qui se place à la FIN d'une liste de lignes au lieu d'un bouton
  isolé.
- `droppable` — chaque forme accepte en plus le glisser de fichiers.
  L'état de glisser réutilise le langage des overlays existants
  (pointillés primaires sur fond primaire pâle). Un dépôt émet
  `drop-files` uniquement s'il contient au moins un fichier — le
  texte et les URL sont ignorés, l'hôte peut donc se fier à la charge
  utile.

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| disabled | Désactive le clic et refuse les glissements | boolean | false |
| droppable | Accepte le glisser de fichiers (dépôts non vides uniquement) | boolean | false |
| compact | Forme ligne fine en fin de liste | boolean | false |
| icon | Composant d'icône (style lucide) | Component | Plus |

| Slot | Description |
|------|-------------|
| default | Texte du libellé |
| icon | Remplace le glyphe par défaut |

| Event | Description |
|-------|-------------|
| click | Tuile activée (MouseEvent natif) |
| drop-files | Dépôt d'au moins un fichier — `(files: File[], event: DragEvent)` |
