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

## Feuilles de sélecteur et recherche épinglée

Une surface déroulante (`HkSelectPanel`, sous `HkSelect` / `HkMenu` / les
sélecteurs à pastille) a deux bandes de contenu, et la bande à laquelle
appartient un élément ne se négocie pas :

- **`default` défile.** Lignes, cartes, catalogues — tout ce qui peut
  dépasser la surface.
- **`pinnedHeader` ne défile pas.** Le chrome qui doit rester atteignable
  pendant que la liste défile : d'abord le champ de filtrage en direct. Il
  se rend hors de la zone de défilement sur les deux formes — une bande sous
  la ligne de titre de la feuille sur téléphone, la tête de la colonne du
  popout sur ordinateur (dont le corps porte alors l'unique barre de
  défilement). Un champ de recherche dans le contenu défilant part au premier
  geste ; c'est un défaut, pas un choix de style (2026-11-27).

Les feuilles téléphone de la famille sélecteur/menu épousent leur contenu
jusqu'à **80 % de la vue** ; au-delà, le contenu défile à l'intérieur. Un plafond
réglé pour le popout d'ordinateur (`maxHeight`, p. ex. `min(18rem, 45dvh)`)
n'atteint jamais la feuille. La feuille coupe aussi l'enchaînement du
défilement : un geste sur la poignée, la ligne de titre ou la bande épinglée ne
traîne jamais la page derrière elle.

## Mouvement des listes

Chaque fois que des éléments de liste changent — ajout, retrait, reclassement —
le déplacement passe par `HkListTransition` de hikari (un `TransitionGroup`
clé dont le FLIP est signalé au bus d'animation du runtime), jamais un tween
écrit à la main. Un seul défaut pour toute surface en forme de liste (lignes,
cartes, cascades) : la piste de déplacement dure 0,3 s, l'entrée et la sortie
0,15 s chacune et commencent en même temps que le déplacement. L'hôte
personnalise avec les props `duration` / `enterDuration` / `leaveDuration`
(temps CSS ; un `duration` seul dérive les deux moitiés). `surface` est la
seule exception (des lignes qui sont des fenêtres gardent les timings
d'entrée/sortie de la famille fenêtre).

Deux règles permanentes côté hôte : une liste qui vit directement dans un viewport de défilement garde `move` désactivé (le fantôme partant est épinglé à l'ancêtre positionné le plus proche, et un scrollport n'est pas la boîte visuelle de la liste) ; et une ligne de liste ne porte jamais `transition: all` — les pistes du primitif prennent en charge le `transition` de la ligne pendant la durée d'une seule chorégraphie, et une piste `all` y perdrait sa face de survol.

Un sélecteur multiple (`HkAffixPicker` en mode `multi`, `layout="rows"`) ne
construit rien devant la recherche pour sa sélection : les lignes cochées
portent la marque de coche de tête et remontent en tête dans l'ordre du
catalogue derrière un séparateur ; un toucher bascule la ligne et elle glisse
vers ou depuis son emplacement. `layout="tags"` est la forme éditeur de valeur
(une valeur saisie affichée par entrée) et garde la liste de pastilles
au-dessus de la recherche.

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
- Une entrée de `items` est `{ key, text, href? }` : `key` est l'identité stable
  utilisée par le rendu de liste, `text` est la chaîne affichée (un numéro de
  déclaration, un nom de système, …) et `href` est facultatif — omis, l'entrée
  s'affiche comme un simple `<span>` ; fourni, comme un lien.
- Une entrée avec `href` s'ouvre toujours dans un nouvel onglet : `target="_blank"`
  plus `rel="noopener noreferrer"` (le même contrat que le numéro de
  déclaration — un site tiers ne doit jamais détenir de poignée sur la fenêtre de
  la page de connexion). C'est le comportement du composant : les hôtes ne
  doivent pas envelopper les entrées dans leur propre `<a>`.
- Les entrées-liens (déclarations) utilisent `items` + `as="nav"` +
  `ariaLabel` ; le contenu libre (pastille d'état) passe par le slot par
  défaut, après `items`.

Il est interdit aux hôtes d'écrire à la main des voies compressées
`flex-wrap: nowrap` ou de laisser le texte peindre hors d'une bande à hauteur
fixe. Implémentation de référence : `HkCornerText`.
