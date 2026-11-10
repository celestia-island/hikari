# Placement des docks : pin ou ride

Un dock est du chrome qui appartient à une région — une barre sous un tableau, un pagineur dans
un coin. Dans une région défilante, le dock se monte via un slot de `HkScrollContainer`
(`dockBottom` / `dockTop`), et le conteneur propose deux façons de placer un dock inférieur
(`dockMode`).

## `pin` — par défaut

Le dock est un frère flex **non défilant** du viewport : il reste sur le bord du conteneur, ne
défile jamais, et le viewport rétrécit de sa hauteur.

Indiqué pour du chrome qui possède le cadre de la région — une barre de progression au-dessus
d'un journal, une barre d'outils alignée sur les bords du panneau.

L'air entre la fin du contenu et le dock est celle que la fenêtre laisse : un contenu court
garde une bande morte de hauteur de fenêtre résiduelle entre les deux.

## `ride`

Le dock entre dans le flux du viewport, après le contenu, derrière un espaceur exactement de la
hauteur **mesurée** du dock, et se colle au bord inférieur visible
(`position: sticky; bottom: 0`) :

- contenu court — le dock suit la fin du contenu à sa position de flux, l'air au-dessus de lui
  vaut exactement une hauteur de dock, et la hauteur de fenêtre résiduelle tombe **sous** le
  dock ;
- contenu long — le dock reste sur le bord inférieur visible (il ne défile jamais hors de vue),
  et le même air d'une hauteur de dock s'ouvre à la fin du défilement.

Indiqué pour du chrome qui appartient au CONTENU — la barre inférieure d'un canevas de croisière,
debout sous sa dernière rangée. Le conteneur mesure le dock et publie
`--hk-scroll-dock-bottom` : l'hôte n'écrit plus de recette d'espaceur ni de valeur magique, et
l'air suit chaque recomposition du dock (une ligne qui change, un changement de point de rupture).

## Ride n'est pas une réservation au niveau du cadre

Ride n'est **pas** la recette retirée qui réservait `hauteur du dock + respiration` sur le
viewport avec un `::after` pour un dock flottant au-dessus de la zone défilante depuis
l'extérieur du flux. Cette bande apparaissait comme de l'air mort *avant* la fin du défilement,
et le dock ne suivait jamais le contenu. Le corps du dock en mode ride est l'enfant dans le flux :
rien n'est pré-réservé pour quelque chose peint ailleurs, et c'est la boîte sticky qui fait suivre
le contenu plutôt que la fenêtre.

## Choisir

| Hôte | Placement |
|---|---|
| Région défilante, le chrome appartient au contenu | `dockMode="ride"` |
| Région défilante, le chrome possède le cadre de la région | `dockMode="pin"` |
| Superposition canevas / page, aucune région défilante ne le possède | `HkDockBar` |

`ride` n'existe que sur la queue verticale : les conteneurs `axis="horizontal"` conservent `pin`,
car leur queue est l'axe transversal.
