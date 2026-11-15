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

## L'espace de bord

Un dock garde une **distance minimale** de deux côtés à la fois, et les deux viennent d'une seule
famille de tokens, jamais du padding propre d'une page :

- **l'inset de repos** — la distance entre la surface du dock et le bord du viewport qu'il longe,
  plus l'`env(safe-area-inset-*)` de ce bord (un appareil à encoche garde donc l'écart au-dessus de
  la zone sûre système, tandis qu'un bureau le résout à 0) ;
- **la bande de contenu** — un padding transparent sur la face du dock tournée vers le contenu, si
  bien que le contenu ne s'approche jamais de la surface à moins de ce même écart.

La valeur par défaut est de 16px sur chaque bord (`--hk-dock-gap`, déclaré une seule fois par la
couche foundation). Un dock qui a besoin de plus de place passe `gap` (une longueur CSS) à
`HkDockBar` / `DockBar` ; un hôte peut aussi remplacer un seul bord avec
`--hk-dock-gap-<top|right|bottom|left>` sur n'importe quel ancêtre, ou tous les bords d'un coup avec
l'ancien `--hk-dock-inset`. Les noms par bord sont résolus là où ils sont lus, donc une surcharge de
`--hk-dock-gap` en dessous atteint encore tous les bords.

La bande appartient au dock, jamais à la vue qui l'héberge — d'où l'absence de padding côté vue :
dans un slot `pin` le dock est un frère flex du viewport défilant, donc le viewport cède la bande
par la mise en page et un contenu étiré à `min-height: 100%` ne peut pas la masquer ; pour un dock
flottant, la boîte que l'hôte mesure (son propre `getBoundingClientRect`, padding compris) la
contient déjà.

**Occupation publiée = bande + surface + inset**, quel que soit le mode de placement. Un
consommateur qui réserve la queue du dock lit la valeur publiée et ne doit PAS rajouter la hauteur
du dock (ni un inset de dock) une seconde fois : les deux distances y sont déjà. Les empiler à
nouveau est exactement la bande morte que ce contrat supprime.

## Choisir

| Hôte | Placement |
|---|---|
| Région défilante, le chrome appartient au contenu | `dockMode="ride"` |
| Région défilante, le chrome possède le cadre de la région | `dockMode="pin"` |
| Superposition canevas / page, aucune région défilante ne le possède | `HkDockBar` |

`ride` n'existe que sur la queue verticale : les conteneurs `axis="horizontal"` conservent `pin`,
car leur queue est l'axe transversal.
