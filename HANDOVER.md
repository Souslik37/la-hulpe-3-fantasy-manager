# Handover — La Hulpe 3 Fantasy Manager

Document écrit pour permettre à un nouvel assistant (ChatGPT ou autre) de
reprendre ce projet sans avoir vécu les sessions précédentes. Rédigé
août 2026. **Ce fichier prime sur README.md et NOTES.md partout où ils se
contredisent** — les deux datent en partie d'avant l'ajout du backend
Supabase et contiennent des chiffres obsolètes (détaillé plus bas).

## 1. C'est quoi

Fantasy manager pour l'équipe de rugby amateur "La Hulpe 3" (Belgique).
Chaque manager du club crée un compte, construit une équipe avec le vrai
effectif de joueurs du club, pronostique les matchs de la saison, gagne des
PE (Points d'Expérience) qu'il dépense sur les attributs de ses joueurs, et
grimpe au classement. Usage réel, en production, par ~20 personnes du club.

- **Site en ligne** : https://souslik37.github.io/la-hulpe-3-fantasy-manager/
- **Dépôt GitHub** : https://github.com/Souslik37/la-hulpe-3-fantasy-manager (branche `main`, déployé via GitHub Pages sur push)
- **Dossier local** : `/Users/alex/Desktop/Claude/la-hulpe-3-fantasy-manager`
- **Propriétaire/admin** : Alexandre (le seul compte avec `role: 'admin'`)

## 2. Stack technique

100% HTML/CSS/JS natif, **aucun build, aucun bundler, aucun framework**.
Scripts classiques (pas d'ES modules — cassé par CORS en `file://`),
chargés dans un ordre précis via `<script src="...">` dans `index.html`,
partageant tous un unique namespace global `window.LH3` (`LH3.data`,
`LH3.utils`, `LH3.services`, `LH3.components`, `LH3.pages`).

Backend : **Supabase** (Postgres + Auth + Row Level Security), ajouté après
une première version 100% LocalStorage (voir section 6, README obsolète).

**Aucun serveur à soi, aucun coût d'hébergement** : GitHub Pages (statique,
gratuit) + Supabase (tier gratuit). Pas de CI/CD — un `git push` sur `main`
suffit, GitHub Pages republie automatiquement en 1-2 min.

### Convention de travail établie avec l'utilisateur

**L'assistant ne fait jamais `git push`** — uniquement `git add` + `git
commit` en local. L'utilisateur pousse toujours lui-même, manuellement,
quand il est prêt. C'est une préférence explicite et répétée, pas une
limitation technique — la respecter dès le début évite d'avoir à se
justifier.

## 3. Supabase — tout ce qu'il faut savoir

- **URL du projet** : `https://bhaigsokingvntqyytsm.supabase.co`
- **Clé publishable** (anon key) : dans `data/supabaseConfig.js`, **volontairement publique** (visible côté client, c'est normal pour ce type de clé — la vraie sécurité vient des règles RLS, pas du secret de cette clé). Ne jamais y mettre une clé `service_role`.
- **Auth "nom + code à 4 chiffres"** (`services/authService.js`) : en coulisses, un vrai compte Supabase Auth email/mot de passe. Le nom devient `slug(nom)@players.lahulpe3.local`, le code un mot de passe dérivé déterministe (`LH3-{slug}-{pin}`). L'utilisateur ne voit jamais "email"/"mot de passe". Sécurité volontairement légère (4 chiffres) — adapté à un groupe d'amis, assumé comme tel dans le code.
- **Le schéma complet vit dans `supabase/schema.sql`** — c'est la source de vérité. Contient les `create table`, tous les `create policy` (RLS), et tous les `grant`. **Toute modification de schéma doit être répercutée dans ce fichier ET exécutée manuellement dans le SQL Editor de Supabase** (aucun assistant IA n'a d'accès en écriture direct à la base — seulement l'utilisateur, via le dashboard Supabase).
- **Je (l'assistant précédent) n'ai jamais eu d'accès en écriture à la base.** Toutes les vérifications que je fais sont des `curl` en lecture seule avec la clé publishable, jamais des écritures. Toute nouvelle colonne/table/policy nécessite de fournir le SQL à l'utilisateur pour qu'il le colle lui-même dans SQL Editor.

### ⚠️ Point d'attention le plus important actuellement

RLS sur la table `managers` n'autorisait, jusqu'à très récemment, un
manager à modifier QUE sa propre ligne (`managers_update_own`, `auth.uid()
= id`). Aucune policy ne permettait à l'admin d'écrire sur la ligne d'un
**autre** manager. Or plusieurs fonctionnalités centrales ont besoin de ça
: noter les pronostics de tout le monde (distribution de PE), les bonus
d'assiduité, les événements du club. Sans la policy admin, ces écritures
échouent **silencieusement** (RLS filtre la ligne → 0 ligne affectée, pas
d'erreur SQL renvoyée → le code applicatif croit que ça a marché).

Le correctif (`managers_admin_write`, calqué sur `players_admin_write`
déjà existant) a été écrit dans `supabase/schema.sql` et le SQL a été
donné à l'utilisateur à coller dans SQL Editor. **Je n'ai aucun moyen de
confirmer qu'il l'a effectivement exécuté** (je ne peux pas tester une
policy d'UPDATE authentifiée avec juste la clé publishable en lecture
seule). **Première chose à vérifier avec l'utilisateur avant de toucher à
quoi que ce soit qui distribue du PE à d'autres managers** (grading de
match, bonus d'assiduité, événements de club) : est-ce que cette policy
est bien en place ? Si un doute, redemander de la (re)coller — la requête
est idempotente (`create policy` échoue juste si elle existe déjà, sans
casser quoi que ce soit).

```sql
create policy "managers_admin_write" on managers for update using (
  exists (select 1 from managers where id = auth.uid() and role = 'admin')
);
```

### Autres pièges Supabase/RLS déjà rencontrés (pour éviter de les refaire)

- **Colonnes `uuid` vs `text`** : `match_comments.id` et `journal.id` sont
  des colonnes Postgres `uuid` strictes. Un id généré côté client au
  mauvais format (ex: `"comment-abc123"`, pas un vrai UUID) fait échouer
  l'INSERT avec une erreur de type Postgres — mais si le générateur d'id
  utilisé ailleurs (`utils/id.js` → `uid()`) est repris par erreur pour une
  de ces deux tables, ça casse silencieusement pour l'utilisateur (juste un
  toast d'erreur générique "vérifie ta connexion", trompeur). `utils/id.js`
  expose maintenant `uuid()` (via `crypto.randomUUID()`) spécifiquement
  pour ces deux tables ; `uid()` reste correct pour les tables à id `text`
  (`club_events`, `presence_periods`, `players`, `matches`).
- **RLS qui filtre silencieusement** : comme ci-dessus, une policy
  manquante ne lève JAMAIS d'erreur côté Postgres/PostgREST pour un UPDATE
  qui ne matche aucune ligne — juste 0 ligne affectée. `error` reste
  `null`. Un `if (!ok)` classique ne détecte rien. Le seul moyen de
  vérifier qu'une écriture admin-sur-autrui a vraiment eu lieu : relire la
  ligne juste après (`select` en lecture, avec la clé publishable, ça
  marche toujours puisque `select` est ouvert à tous).
- **Ordre de retour de PostgREST sans `order()` explicite** : suit
  globalement l'ordre d'insertion, mais n'est PAS un ordre alphabétique ni
  garanti stable dans l'absolu. Plusieurs bugs corrigés cette saison
  venaient de ce genre d'hypothèse implicite (tri manquant, comparateur
  sans "tie-breaker"). Toujours trier explicitement côté appli si l'ordre
  compte pour l'utilisateur (voir `playerService.listPlayers()`).

## 4. Architecture des fichiers (état actuel réel)

```
index.html          Squelette + ordre de chargement des scripts (SOURCE DE VÉRITÉ
                       de ce qui est réellement chargé — plus fiable que README.md)
styles.css             Design complet (thème clair "carnet de sport")
script.js               Routeur (location.hash) + bootstrap

data/                 Données pures
  config.js              Tout l'équilibrage (voir NOTES.md, avec précaution — partiellement obsolète)
  positions.js             Positions du terrain (rugby)
  players.js                Roster de secours / seed initial (le VRAI roster vit dans Supabase, 39 joueurs actuellement, pas 31)
  accents.js                 ~220 entrées d'accents fictifs pour le coach (par nationalité)
  matches.js                  ⚠️ VESTIGIAL / MORT — génère un seed de 18 matchs à partir de
                                CONFIG.season.totalMatchdays, mais rien ne lit plus
                                window.LH3.data.MATCHES au runtime (grep-vérifié, 0 référence).
                                Les vrais matchs (14 actuellement) vivent dans Supabase,
                                gérés depuis Administration → Calendrier. Sans danger, mais
                                si vous voyez "18" quelque part dans le code legacy,
                                c'est ce fichier — ignorer, ou nettoyer si l'occasion se présente.
  events.js                    Générateurs du Journal du Club (7 brèves auto après un résultat noté)
  supabaseConfig.js             URL + clé publishable Supabase

utils/                Fonctions pures
  dom.js, format.js, avatar.js, id.js (uid + uuid), imageResize.js, animate.js

services/             Toute la logique métier
  authService.js            Auth nom+PIN (Supabase Auth en coulisses)
  storageService.js           SEUL module qui parle à Supabase directement (tous les .from(...))
  stateService.js               État central en mémoire + pub-sub (persist/notify)
  playerService.js                Fusion attributs de base + boosts, overall, rareté, listPlayers() (trié alpha)
  peService.js                      PE, paliers de prestige
  managerService.js                  Managers, coach, displayName(), défaut/reroll de compo (aléatoire pondéré)
  seasonService.js                     Calendrier, verrouillage, finalisation de match
  predictionService.js                   Pronostics d'un manager
  scoringService.js                       Notation des pronostics → PE + historique
  journalService.js                        Génère les brèves + rapports avant/après-match riches (payload structuré)
  commentService.js                         Commentaires libres avant/après-match
  communityService.js                        Stats "qui joue où" (Communauté)
  rosterService.js                            Ajout/suppression/renommage de joueur, avatar
  presenceService.js                          Bonus d'assiduité
  eventService.js                              Événements du club (PE bonus ponctuel)

components/           Rendu réutilisable
  toast.js, modal.js, navbar.js, playerCard.js, coachCard.js, squadPitch.js,
  matchdayCard.js, predictionForm.js, matchComments.js, matchReport.js
  (rapport de match riche, modal), accentSearch.js, fieldRandom.js

pages/                Une page = un render(rootElement)
  onboarding.js, home.js, myTeam.js, allPlayers.js, calendar.js,
  predictions.js, standings.js, community.js, statistics.js, journal.js,
  rules.js, admin.js, settings.js

supabase/schema.sql   Source de vérité du schéma DB (tables + RLS + grants)
NOTES.md              Historique des choix d'équilibrage — PARTIELLEMENT OBSOLÈTE (voir section 6)
README.md             Description du projet — OBSOLÈTE sur l'architecture backend (voir section 6)
```

**Règle simple qui garde tout cohérent** : les pages ne touchent jamais
Supabase ni l'état directement — toujours via un service. Si une règle du
jeu doit changer, ça se change dans un seul service (ou dans
`data/config.js` pour une valeur numérique).

## 5. Conventions et principes de design accumulés

Des choses non écrites dans le code mais qui ont guidé beaucoup de
décisions — utile de les connaître avant de proposer des changements :

- **Le PE est une monnaie UNIQUE.** Refusé plusieurs fois : toute
  proposition qui introduit une seconde monnaie ou un mécanisme de
  réservation/restriction de dépense. Les événements du club donnent du PE
  100% libre ; un `attributeKey` optionnel est une suggestion d'affichage
  pure, sans aucune contrainte technique.
- **La page Communauté ne doit JAMAIS donner l'impression de pointer du
  doigt.** Les joueurs jamais titularisés par personne restent affichés
  dans les listes (pas exclus), mais sans badge ni section à part qui
  souligne leur absence de sélection — juste une case vide, neutre.
  Discuté en profondeur plusieurs fois ; toute nouvelle fonctionnalité
  touchant Communauté doit respecter ce principe.
- **`managerService.displayName(manager)`** : partout où l'identité d'un
  manager est montrée "pour le fun" (commentaires, Journal, Communauté,
  Classements, Accueil), c'est le nom du coach (fictif, choisi par le
  manager) qui prime sur le nom de connexion — pas l'inverse. Le nom de
  connexion reste affiché tel quel dans Paramètres et Administration
  (contextes fonctionnels où l'identité réelle doit rester non-ambiguë).
- **Régénération idempotente.** Un pattern qui revient partout
  (`replaceGeneratedEntry`, `unfinalizeMatch`, `resetPeriod`,
  `removeEvent`) : rejouer une action de notation/génération retire
  d'abord ce qui avait été produit précédemment avant d'ajouter la
  nouvelle version — jamais de doublon en re-cliquant deux fois.
- **Aucune donnée fabriquée/fictive présentée comme réelle.** Discuté
  explicitement à propos des joueurs jamais sélectionnés : même "pour être
  gentil", on ne triche jamais avec une fausse statistique — risque de se
  faire prendre en flagrant délit (d'autres pages montrent la vérité) et
  ça abîme la confiance dans TOUTES les autres stats affichées.

## 6. Où README.md et NOTES.md sont dans le champ

- **README.md** décrit une V1 100% LocalStorage, sans compte, sans
  Supabase, "31 joueurs", "18 journées". Ça correspond à une version du
  projet AVANT la migration vers Supabase — l'architecture réelle
  actuelle a un vrai backend, de l'authentification, et 39 joueurs / 14
  matchs réels. Ne pas s'y fier pour tout ce qui touche au backend/à
  l'auth — se fier à ce fichier (HANDOVER.md) et à `supabase/schema.sql`.
- **NOTES.md** documente correctement l'économie de PE et les paliers de
  rareté dans l'ensemble, MAIS le chiffre du bonus d'assiduité (0-600 PE)
  y est resté après un rééquilibrage vers 0-50-100-150-250 (voir
  `data/config.js`, section presence). Corrigé avec une note dans le
  fichier lui-même.
- Les deux restent utiles pour comprendre le RAISONNEMENT derrière
  l'équilibrage (pourquoi 500 points de départ, pourquoi telle grille de
  PE...) — juste pas fiables sur les chiffres exacts sans vérifier contre
  `data/config.js` actuel.

## 7. État réel au moment de ce handover

- Saison 1, 14 matchs réels programmés (pas 18), aucun encore joué/noté.
- ~21 managers inscrits et actifs.
- Aucun événement de club ni bonus d'assiduité encore distribué en
  conditions réelles — ces mécanismes n'ont jamais été exercés avec de
  vraies données, seulement testés en local/en simulation. Première vraie
  utilisation = premier match noté par l'admin, d'où l'importance du point
  RLS de la section 3.
- Fonctionnalités les plus récentes (à connaître, peu documentées
  ailleurs) : commentaires avant/après-match, rapports de match riches
  et cliquables (Journal du Club) avec des "rôles" fun calculés
  automatiquement (Le Téméraire, La Petite Tour Eiffel, Le Voyant, Le
  Crack du Jour...), compo de départ tirée au sort en favorisant les
  joueurs peu/jamais titularisés (pour les nouveaux managers ET via un
  bouton admin "reroll" pour les managers existants qui n'ont jamais
  touché leur compo par défaut).

## 8. Comment tester en local

Aucun serveur requis — ouvrir `index.html` directement dans un navigateur,
ou le glisser dans une fenêtre déjà ouverte. Se connecte au VRAI Supabase
de production (pas d'environnement de test séparé) : toute action de test
(créer un manager, noter un match...) touche les vraies données du club.
Pour tester sans risque, préférer un petit fichier HTML autonome à part
(stub des services concernés), jamais modifier `index.html` pour ça, et
supprimer ce fichier de test avant de committer.
