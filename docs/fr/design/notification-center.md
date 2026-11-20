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

## Animation

L'ajout et le retrait d'une ligne sont chorégraphiés par
`HkListTransition` — la primitive de liste de la bibliothèque, celle que
le fil d'Ariane des modales, le champ d'étiquettes, la surface de mot de
passe, le sélecteur d'affixes et le waterfall utilisent déjà — dans sa variante `pop` (un fondu qui se pose depuis une légère
mise à l'échelle) avec des déplacements FLIP : les lignes restantes
glissent dans l'espace libéré par celle qui disparaît. Deux propriétés
viennent de la primitive et de la plateforme, pas de la cloche : elle
**signale** chaque lot d'entrée/sortie au contexte d'animation
d'exécution (`runtime/animationBus.ts`, pour que les pairs JS sachent
qu'une transition est en cours), et ses propres règles de réduction des
animations, avec l'interrupteur global d'animations CSS
(`html[data-css-animations="0"]`), replient le mouvement.

Trois conséquences vérifiables :

- Ouvrir le panneau ne rejoue pas l'entrée de la liste (`appear` reste
  désactivé) — seules les lignes qui arrivent ou partent réellement
  s'animent.
- Le conteneur de la liste survit au basculement vers l'état vide : un
  journal sans ligne garde la liste montée, car démonter un groupe de
  transitions annule ses fantômes sortants en plein vol.
- La bascule vers l'état vide se fait en deux temps : pendant que la
  dernière ligne (ou « Tout effacer ») s'estompe, la liste conserve sa
  dernière hauteur — une ligne sortante est positionnée À L'INTÉRIEUR du
  conteneur de défilement, donc une liste qui rétrécit rognerait son propre
  fantôme (vrai pour la ligne la plus basse de N'IMPORTE quel retrait, pas
  seulement du vidage) — et le texte « Aucune notification » n'apparaît
  qu'après la fenêtre de sortie. Un hôte qui replie le mouvement (requête
  `prefers-reduced-motion`, drapeau park du bus, ou
  `html[data-css-animations="0"]`) saute entièrement ce maintien et reçoit
  le texte immédiatement.

## Implémentation de référence

`runtime/notificationCenter.ts` (le journal et ses crochets sources) +
`components/HkNotificationBell.tsx` (cloche + panneau en une seule
composition). Les sources écrivent via `recordNotification` /
`setNotificationState` ; les hôtes montent `<HkNotificationBell />` et
décident où il vit.

Les ids enregistrés par l'hôte partagent un espace de chaînes plat avec les miroirs intégrés : les préfixes `toast:` / `blocking:` / `emergency:` sont réservés par ceux-ci — un hôte qui enregistre des puces persistantes ou des éléments personnalisés choisit son propre préfixe (p. ex. `myapp:`) pour qu'un id personnalisé ne puisse jamais détourner un épisode intégré.

## L'exception d'urgence

Les lignes d'urgence sont la seule exception : tant que l'épisode est VIVANT (actif ou snoozé), la ligne ne porte pas de contrôle de suppression — son entrée de journal détient l'unique poignée de restauration de l'alerte, et un re-raise pollé ressusciterait une ligne supprimée. Le geste de l'utilisateur s'applique aux enregistrements (toasts, portes de confirmation) et aux urgences résolues une fois leur épisode terminé ; jamais à un épisode vivant.
