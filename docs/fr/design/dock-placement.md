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
hauteur de **l'occupation mesurée du dock**, et se colle au bord inférieur visible
(`position: sticky; bottom: 0`) :

- contenu court — le dock suit la fin du contenu à sa position de flux, l'air au-dessus de lui
  vaut cette occupation mesurée, et la hauteur de fenêtre résiduelle tombe **sous** le dock ;
- contenu long — le dock reste sur le bord inférieur visible (il ne défile jamais hors de vue
  sur l'axe vertical ; sur un tableau à deux axes il reste ancré au bord de départ inline au lieu
  de partir avec le contenu), et le même air s'ouvre à la fin du défilement.

« L'occupation » est la boîte que le conteneur mesure et publie en `--hk-scroll-dock-bottom` : la
place du dock lui-même, pas nécessairement sa surface visible — l'espace que l'hôte met DANS
cette bande (un inset de dock, le padding de fin d'une ligne) s'y ajoute, donc l'air colle au
dock à hauteur du padding propre de l'hôte. Les hôtes lisent cette valeur publiée au lieu
d'écrire une recette d'espaceur ou une valeur magique, et l'air suit chaque recomposition du
dock (une ligne qui change, un changement de point de rupture).

Un hôte ride doit aussi laisser son contenu finir AU-DESSUS du bas du viewport : une boîte de
contenu qui s'étire jusqu'à la hauteur du viewport (`min-height: 100%`) place l'espaceur et le
dock du flux sous la ligne de flottaison, si bien que le dock ne peut que coller au bord et que
l'air redevient la hauteur de fenêtre résiduelle. `HkKanban` libère sa propre boîte de lanes sur
un tableau ride ; un hôte maison fait de même.

`autoFollow` n'est pas supporté avec un dock ride, pour la même raison : il cale une boîte de
contenu de hauteur d'écran sur le bas, donc la queue ride passe sous la ligne de flottaison. Le
conteneur avertit une fois par instance de conteneur dans les builds de développement quand les
deux sont actifs.

Tant qu'il est collé, l'enveloppe ride et son espaceur sont `pointer-events: none` ; la partie du
contenu du slot qui doit capter les événements (les contrôles du dock lui-même) doit déclarer
elle-même `pointer-events: auto`.

## Ride n'est pas une réservation au niveau du cadre

Ride n'est **pas** la recette retirée qui réservait `hauteur du dock + respiration` sur le
viewport avec un `::after` pour un dock flottant au-dessus de la zone défilante depuis
l'extérieur du flux — et ce n'est pas « réserver un deuxième dock d'espace vide » non plus.
Cette bande apparaissait comme de l'air mort *avant* la fin du défilement, et le dock ne suivait
jamais le contenu. Le corps du dock en mode ride est l'enfant dans le flux : rien n'est
pré-réservé pour quelque chose peint ailleurs, et c'est la boîte sticky qui fait suivre le
contenu plutôt que la fenêtre.

## Choisir

| Hôte | Placement |
|---|---|
| Région défilante, le chrome appartient au contenu | `dockMode="ride"` |
| Région défilante, le chrome possède le cadre de la région | `dockMode="pin"` |
| Superposition canevas / page, aucune région défilante ne le possède | `HkDockBar` |

`ride` n'existe que sur la queue verticale : les conteneurs `axis="horizontal"` conservent `pin`,
car leur queue est l'axe transversal.
