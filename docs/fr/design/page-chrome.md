# Chrome de page : la grammaire de la barre d'actions

Les pages d'administration et de console partagent UN contrat d'en-tête : la
page possède le cluster d'actions en haut à droite via des slots à objet
déclaré, et c'est dans ce cluster — pas dans le corps de la page — que vivent
ses affordances principales.

## Les slots canoniques

Chaque enregistrement déclare un OBJET ; le cluster rend les slots canoniques
par rang, indépendamment de l'ordre d'enregistrement des vues :

```text
[créer][filtrer][rechercher][rafraîchir][fenêtre]
```

Les enregistrements dont l'objet n'est pas un slot canonique sont des
personnalisés : ils se rendent APRÈS la zone canonique, tassés de droite à
gauche en ordre d'enregistrement inverse — la zone canonique ne bouge jamais.

## La règle de création

L'action de création principale d'une page — celle qui crée une nouvelle
entité de premier niveau (un fournisseur, un canal, un groupe, une règle
d'accès, un thème sur la ligne partagée) — est un **bouton icône plus dans le
cluster en haut à droite, à gauche du rafraîchissement**. Ce n'est jamais un
bouton isolé dans le corps de la page.

Le libellé visible qu'aurait porté le bouton dans le corps devient le nom
accessible et l'infobulle du bouton ; la page continue de posséder sa propre
boîte de dialogue de création.

**Les ajouts contextuels sont exemptés.** Un plus qui ajoute une ligne à une
sous-liste dans un éditeur, une boîte de dialogue, un assistant ou une carte
(« ajouter une ligne de modèle », « ajouter un membre », « ajouter un montage »)
fait partie de la grammaire locale, pas de l'action de création de la page —
il reste où il est.

## Géométrie

Le cluster est une seule rangée de chrome : chaque bouton icône suit la même
échelle de tailles (`useChromeActionSize`), glyphes de 16 px. Un bouton à
taille figée entre des voisins à taille d'échelle se lit comme une autre
famille — assemblez le cluster avec les helpers partagés, jamais de tailles
clouées à la main.

## Implémentation de référence

hikari fournit le chrome : la rangée d'actions de `HkAdminHeader`,
`HkIconButton` et `useChromeActionSize`. Les hôtes s'enregistrent via la
paire de composables `provideActionBar` / `useActionBar`, qui rend les
slots ci-dessus ; c'est l'implémentation de référence de cette grammaire.

## Repli mobile

Un groupe de boutons ancré dans le slot central de l'en-tête ou du pied
de page se replie aux largeurs téléphone (<768, `useBreakpoint().isMobile`
— le seuil de la famille sheet) : la bande devient un déclencheur de
type sélecteur nommant l'élément ACTIF, et ses options s'ouvrent en
feuille inférieure (`HkSelectPanel` avec `sheetOnMobile`). Un seul
contrat de valeur pilote les deux formes — les liens profonds `?tab=`
survivent au point de rupture. `HkAdaptiveTabs` est l'implémentation
par défaut ; les commutateurs de listes de projets dynamiques avec des lignes
propres (le sélecteur de plateforme) sont le cas particulier exempté,
pas le modèle à copier.

## Texte des coins de pied de page

Le texte dans l'un des six coins d'en-tête/pied de page (gauche/centre/droite
×2) passe par `HkCornerText` d'hikari : une instance = une voie de texte pour
un coin.

- `align` choisit le coin : `start` (coins gauches) / `center` (voie centrale)
  / `end` (coins droits) ; les lignes renvoyées restent collées au même bord —
  une voie de coin droit reste alignée à droite après retour à la ligne.
- Les entrées sont des atomes `nowrap` : la voie revient à la ligne ENTRE les
  entrées, jamais à l'intérieur (un numéro de déclaration ne doit pas se
  couper en plein milieu).
- Encre chrome atténuée par défaut (`text-2xs` + opacité 0.6) ; `muted: false`
  restaure l'encre pleine.
- Plusieurs lignes dans un coin (ligne d'identité au-dessus de la ligne des
  déclarations) : empiler les instances verticalement — la bande d'état fixe
  de 3rem contient deux lignes text-2xs.
- Les entrées-liens (déclarations) utilisent `items` + `as="nav"` +
  `ariaLabel` ; le contenu libre (pastille d'état) passe par le slot par
  défaut, après `items`.

Il est interdit aux hôtes d'écrire à la main des voies compressées
`flex-wrap: nowrap` ou de laisser le texte peindre hors d'une bande à hauteur
fixe. Implémentation de référence : `HkCornerText`.
