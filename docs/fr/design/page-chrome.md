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
`HkIconButton` et `useChromeActionSize`. Les hôtes s'enregistrent via un
contexte de barre d'actions qui rend les slots ci-dessus ; le `useActionBar` /
`usePageCreateAction` du webui de chest est l'implémentation de référence de
cette grammaire.

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
