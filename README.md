# La Hulpe 3 — Fantasy Manager

Une petite application de fantasy manager pour l'équipe de rugby La Hulpe 3.
Chaque manager crée un coach, construit son effectif à partir des 31 joueurs
du club, répartit des points d'attributs, pronostique les 18 journées de la
saison et grimpe au classement grâce à ses PE (Points d'Expérience).

100% HTML/CSS/JS natif. **Aucun serveur, aucune dépendance, aucun build.**
Toutes les données vivent dans le LocalStorage du navigateur.

## Lancer l'application

Ouvre `index.html` dans un navigateur. C'est tout.

> Astuce : si tu double-cliques le fichier, certains navigateurs peuvent
> restreindre certaines API de fichiers (rare pour cette appli, qui n'en a
> pas besoin). En cas de souci, glisse simplement `index.html` dans une
> fenêtre de navigateur déjà ouverte.

## Pourquoi pas d'ES modules (`import`/`export`) ?

Volontaire. Les navigateurs bloquent le chargement de modules ES et les
`fetch()` locaux par CORS quand une page est ouverte en `file://` (double-
clic direct), ce qui casserait l'exigence "ça marche juste en ouvrant
index.html". L'app utilise donc des scripts classiques, chargés dans un
ordre précis via `<script src="...">` dans `index.html`, qui partagent tous
un unique espace de noms global : `window.LH3` (`LH3.data`, `LH3.utils`,
`LH3.services`, `LH3.components`, `LH3.pages`). C'est le compromis qui
garde le code découpé en petits fichiers propres sans jamais nécessiter de
serveur ni d'étape de build.

## Architecture

```
index.html          Squelette de page + ordre de chargement des scripts
styles.css           Tout le design (thème clair "carnet de sport", cartes,
                        rareté, animations discrètes)
script.js             Routeur (basé sur location.hash) + bootstrap

data/                 Données pures, aucune logique
  config.js             Tout l'équilibrage du jeu (voir NOTES.md)
  players.js             Les 31 joueurs et leurs attributs de base
  matches.js               Le calendrier de saison (seed, éditable en Admin)
  events.js                 Générateurs du Journal du Club (extensible)

utils/                Fonctions pures, aucun état
  dom.js                 Création d'éléments, échappement HTML
  format.js               Dates, rareté, arrondis
  avatar.js                Avatars temporaires (initiales + couleur)
  id.js                     Génération d'identifiants
  animate.js                 Compteurs animés (discrets, voir prefers-reduced-motion)

services/             Toute la logique métier + le seul point d'accès à l'état
  stateService.js         État central en mémoire + pub-sub
  storageService.js         Seul module à toucher LocalStorage
  playerService.js           Fusion attributs de base + boosts, rareté
  managerService.js           Managers, coachs, génération de coach aléatoire
  seasonService.js             Calendrier, verrouillage, finalisation de match
  predictionService.js           Pronostics d'un manager
  scoringService.js               Correction des pronostics → PE + historique
  peService.js                     PE, conversion en points, paliers de prestige
  journalService.js                 Fait tourner les générateurs du Journal

components/           Rendu réutilisable entre pages
  navbar.js, playerCard.js, coachCard.js, matchdayCard.js,
  predictionForm.js, modal.js, toast.js

pages/                Une page = un `render(rootElement)`
  onboarding.js, home.js, myTeam.js, allPlayers.js, calendar.js,
  predictions.js, standings.js, statistics.js, journal.js, admin.js,
  settings.js
```

**Règle simple qui garde tout ça cohérent** : les pages ne touchent jamais
`localStorage` ni l'état directement — elles appellent toujours un service,
qui appelle `stateService.persist()`. Si une règle du jeu doit changer,
elle se change dans un seul service (ou dans `data/config.js` si c'est une
valeur numérique).

## Comment fonctionne le multi-manager (sans compte, sans serveur)

Le calendrier, les résultats et le journal sont **partagés** (un seul
`state.matches`/`state.journal`). Chaque manager a son propre coach, son
propre effectif, ses propres boosts et ses propres pronostics dans
`state.managers[id]`. Comme tout vit dans le même LocalStorage, plusieurs
membres du club peuvent avoir chacun leur profil manager **sur le même
navigateur/ordinateur** (utile pour une session commune, ex. lors d'un
entraînement) — voir Paramètres → "Ajouter un manager". Le Classement
compare alors tous les profils présents localement.

Ce n'est **pas** de la synchronisation entre appareils différents : chaque
navigateur a sa propre sauvegarde. C'est le rôle des comptes/Supabase
prévus plus tard (voir Simplifications).

## Simplifications assumées pour cette V1

- **Pas de comptes ni de sync entre appareils** — un profil manager vit
  dans le LocalStorage d'un navigateur donné. L'architecture des services
  (surtout `stateService`/`storageService`) est conçue pour qu'un futur
  backend (Supabase par ex.) puisse remplacer `storageService` sans toucher
  au reste de l'app.
- **Pas de drag-and-drop** pour la composition d'équipe : interaction
  "sélectionner puis cliquer une autre case" à la place, qui fonctionne
  aussi bien au clic qu'au tactile sans dépendance externe.
- **Avatars temporaires** (initiales + couleur générées). Chaque joueur et
  coach a un champ `avatarUrl` prêt à l'emploi : dès que de vraies
  illustrations existent, il suffit de renseigner ce champ (aucun autre
  changement de code nécessaire, voir `utils/avatar.js`).
- **Calendrier de saison en données d'exemple** (adversaires "Adversaire
  J1"...J18", dates provisoires) — à éditer depuis Administration.
- **Une seule saison à la fois.** `config.season.number` existe déjà pour
  préparer le multi-saisons, mais aucune UI de changement de saison n'est
  construite.

## Prochaines étapes recommandées

1. **Importer les avatars cartoon des joueurs** — voir la marche à suivre
   détaillée juste en dessous.
2. **Comptes + Supabase** — remplacer `storageService` par un client
   Supabase (lecture/écriture), garder `stateService` identique côté appel.
3. **Statistiques communautaires / Hall of Fame** — une fois les données
   centralisées (post-Supabase), agréger au-delà d'un seul navigateur.
4. **Saisons multiples** — archiver `state.matches`/`state.journal` par
   saison, garder les managers mais réinitialiser points/PE d'une saison à
   l'autre.
5. **Plus de générateurs de Journal** — il suffit d'ajouter une entrée à
   `data/events.js` (voir le commentaire en tête de fichier).

## Importer les avatars cartoon des joueurs

L'architecture a été pensée pour que ce soit la manipulation la plus simple
possible — aucun changement de code ailleurs que les données.

1. **Prépare les images.** Format carré (ex : 256×256 ou 512×512 px), PNG
   avec fond transparent de préférence (le rond de couleur actuel disparaît
   automatiquement dès qu'`avatarUrl` est renseigné). Un nom de fichier par
   joueur, par exemple `amaury.png`.
2. **Range-les dans le projet**, par exemple dans `assets/avatars/` (dossier
   déjà prévu, actuellement vide) :
   ```
   assets/avatars/amaury.png
   assets/avatars/ambroise.png
   ...
   ```
3. **Renseigne `avatarUrl` dans `data/players.js`** — chaque joueur a déjà
   un champ prêt à l'emploi :
   ```js
   { id: 'amaury', name: 'Amaury', avatarUrl: 'assets/avatars/amaury.png', baseAttributes: ... }
   ```
   Comme les `id` sont déjà des versions "slug" du nom (`amaury`,
   `max-poelaert`, `alex-lc`...), tu peux nommer tes fichiers pareil et
   générer les 31 lignes rapidement (recherche/remplace ou un petit script).
4. **Coach** : chaque manager peut définir l'avatar de son propre coach de
   la même façon, depuis Paramètres (le champ `coach.avatarUrl` suit le même
   principe — actuellement non exposé dans le formulaire, il suffit d'un
   champ texte "URL de l'avatar" en plus dans `pages/settings.js` /
   `pages/onboarding.js` si tu veux le piloter depuis l'interface plutôt
   qu'en modifiant les données directement).
5. **Rien d'autre à changer.** `utils/avatar.js` (`renderAvatar`) bascule
   automatiquement sur une vraie image dès qu'`avatarUrl` est présent, sur
   toutes les cartes, tous les pickers et tout le reste de l'app — c'est
   littéralement la seule fonction qui décide "initiales colorées" vs
   "image".

Si tu préfères ne pas committer 31 fichiers image dans le dossier du projet
(par exemple si les illustrations viennent d'un outil externe ou d'une IA
générative), `avatarUrl` accepte aussi bien une URL relative locale qu'une
URL absolue (`https://...`) — dans ce dernier cas, une connexion internet
sera nécessaire pour les afficher, ce qui casse le côté "tout marche hors-
ligne" ; pour rester fidèle à l'esprit de l'app, mieux vaut héberger les
images en local dans `assets/`.

## Licence / statut

Projet personnel pour le club La Hulpe 3. Pensé pour être lisible, propre
et maintenable sur plusieurs saisons — n'hésite pas à réorganiser si le jeu
évolue dans une direction imprévue ici.
