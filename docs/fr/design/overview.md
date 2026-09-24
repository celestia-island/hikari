# Architecture des paquets : hikari-components

Le système de composants de Hikari tient dans un seul paquet, `hikari-components` : les
composants de rendu écrits en `rsx!`, avec leurs hooks réactifs, leurs classes de palette
typées et leur CSS `StyledComponent`.

> **Retiré : `hikari-extra-components`.** Ce paquet fournissait, à côté des composants de
> rendu, des *modèles de données* indépendants du framework (`TimelineState`,
> `ZoomControlsState`, `GuideStep`, le modèle de graphe de nœuds, …) : un même concept
> existait donc sous deux types homonymes — `TimelinePosition` valait `Left` par défaut
> dans l'un et `Alternate` dans l'autre. Aucun membre de l'espace de travail n'en
> dépendait et le modèle de graphe n'était référencé que par ses propres tests ; le paquet
> a donc été supprimé. Les composants qu'il doublonnait restent ici :
> `display::{Timeline, DragLayer, UserGuide, ZoomControls}`,
> `production::{VideoPlayer, RichTextEditor, CodeHighlight}`.
