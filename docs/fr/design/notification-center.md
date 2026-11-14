# Centre de notifications : la grammaire du rejet

Rejeter une notification ne doit jamais signifier la perdre. Chaque
surface qui disparaît — la pile de toasts d'angle, les portes de
confirmation bloquantes, la bande d'urgence plein écran, les puces
persistantes d'un hôte — enregistre ce qu'elle a montré dans le journal
du centre de notifications, et une cloche rappelle la liste partout où
l'hôte la monte.

## Ce qui est journalisé par défaut

Par décision utilisateur (2026-11-15), seuls les tons qui méritent un
second regard :

- les toasts error et warning ; les portes bloquantes traitées ; tous
  les épisodes d'alerte d'urgence (active, snoozed et cleared — les
  conditions résolues restent consultables) ; les puces persistantes
  qu'un hôte enregistre explicitement.
- les toasts success / info / loading optent par push via
  `journal: true` — journaliser chaque « Enregistré. » de 3 secondes
  ne ferait que noyer la liste sous le bruit.

## Rétention et rejeu

Le journal est limité à la session : le sessionStorage survit aux
rechargements et disparaît avec la session du navigateur, avec une
mémoire circulaire de 100 entrées (la plus ancienne tombée selon la
dernière mise à jour). Un enregistrement n'est qu'un ENREGISTREMENT —
le bouton d'action d'un toast est une closure de l'appelant et n'est
jamais rejoué depuis la liste. Le seul cas réversible est une alerte
d'urgence snoozée : son entrée porte le vrai chemin de unsnooze
(« Afficher à nouveau » ramène la bande).

## La règle de lecture

Ouvrir le panneau EST le reçu de lecture. Le point propre à la cloche
(la marque intégrée du bouton icône, pas un badge enroulé) répond à
« ai-je manqué quelque chose », pas à « y a-t-il quelque chose à
l'écran en ce moment ».

## Placement

Le placement appartient au consommateur — hikari possède la grammaire
de stockage et les composants. Placement de référence pour les faces
admin/console : un bouton icône en cloche dans le cluster d'actions en
haut à droite, **à gauche de l'engrenage des paramètres** (le
HeaderEndCluster du webui chest) — les shells de bureau avec des
contrôles de fenêtre supplémentaires restent intacts à l'extrême
droite. Ce n'est jamais un bouton dans le corps de page, et jamais une
inscription via un slot d'action à portée de page (le chrome de page
se démonte avec la page ; la cloche est globale).

Le déclencheur est un `HkIconButton` sur l'échelle de tailles du
chrome ; la surface est un `HkPopover` avec `sheetOnMobile` — flyout
ancré sur les écrans larges, feuille inférieure sur téléphone, avec un
franchissement de point de rupture sûr en direct.

## Implémentation de référence

`runtime/notificationCenter.ts` (le journal et ses crochets sources) +
`components/HkNotificationBell.tsx` (cloche + panneau en une seule
composition). Les sources écrivent via `recordNotification` /
`setNotificationState` ; les hôtes montent `<HkNotificationBell />` et
décident où il vit.
