# Notes de conception & équilibrage

Ce fichier documente les choix d'équilibrage qui ne sont pas évidents à la
seule lecture du code, et pourquoi les valeurs par défaut de
[`data/config.js`](data/config.js) sont ce qu'elles sont. Tout y est
modifiable sans toucher au reste du code.

## Les 500 points de départ

Chaque attribut est plafonné à 100 et part de 50, donc chaque attribut peut
recevoir au maximum **+50**. Avec 500 points et 10 attributs :

- **Tout miser sur un seul joueur** (10 × 50 = 500) le fait passer de 50 à
  100 sur tous ses attributs → une carte Légende parfaite, mais un effectif
  d'un seul homme.
- **Répartir sur les 31 joueurs** (500 / 31 ≈ 16 points chacun, donc environ
  1,6 point par attribut) ne fait presque bouger personne de Bronze.

Ce n'est pas un défaut : c'est le choix stratégique central du jeu (façon
FUT/Football Manager), donc **la valeur de 500 n'a pas été changée**. Elle
crée un vrai dilemme "un héros vs un collectif" dès le premier lancement.

## Paliers de rareté

```
Bronze   0–59   (tout le monde y démarre, à 50 de moyenne)
Argent  60–69
Or      70–79
Diamant 80–89
Légende 90–100
```

Comme la note générale de départ est exactement 50, **tous les joueurs
démarrent Bronze**. Les paliers sont volontairement larges (10 points
chacun) pour que la progression reste lente et visible sur toute la saison,
plutôt que de voir la moitié de l'effectif passer Diamant après une seule
séance de répartition de points.

Les 5 couleurs de rareté (`--bronze/--argent/--or/--diamant/--legende-a` dans
`styles.css`) ont été choisies avec le validateur du skill dataviz
(`validate_palette.js --pairs all`, puisque deux cartes de n'importe quelles
raretés peuvent se retrouver côte à côte) : bande de luminosité, plancher de
chroma (rien qui "lise gris"), séparation daltonisme et contraste — toutes
les combinaisons passent. La combinaison retenue au registre "argent" est un
bleu acier plutôt qu'un gris pur : un gris neutre classique échouait
systématiquement le plancher de chroma et devenait indiscernable du bronze
pour un oeil normal.

## Note générale (overall)

Moyenne arithmétique simple des 10 attributs, arrondie à l'entier le plus
proche (`playerService.computeOverall`). Volontairement simple et
transparent plutôt qu'une moyenne pondérée par attribut — plus facile à
comprendre pour les joueurs, et plus facile à retoucher plus tard si
certains attributs doivent compter davantage (il suffira de modifier une
seule fonction).

## PE (Points d'Expérience) — une seule monnaie, pas de conversion

Historique : la V1 avait 20 PE = 1 point d'attribut, avec un budget de
points d'attributs séparé du PE compétitif ("deux jeux en un"). Changé sur
demande explicite de l'utilisateur (le PE se sentait "pour rien" — un
pronostic parfait ne rapportait que quelques points d'attribut). Le PE EST
désormais directement le budget de points d'attributs (voir
`playerService.pointsAvailable` : `startingPoints + max(0, manager.pe)`,
plus de fonction de conversion séparée). Bien pronostiquer et être assidu
fait donc directement progresser l'équipe — c'est maintenant *le but du
jeu*, pas un axe volontairement détaché.

Chaque critère de pronostic rapporte indépendamment (ils s'additionnent) :

| Critère juste           | PE  |
|--------------------------|-----|
| Résultat (V/N/D)          | 80  |
| Score exact                | 200  |
| Écart de points             | 50  |
| Nombre total d'essais         | 50  |
| Nombre total de points          | 50  |
| Par marqueur d'essai deviné (max 5/pronostic)       | 24  |
| Par marqueur coché qui ne marque pas       | -12  |
| Homme du match                       | 60  |
| Boulette du match                       | 40  |

Un pronostic "parfait" (tout juste, avec par exemple 3 marqueurs devinés)
rapporte 80+200+50+50+50+72+60+40 = **602 PE** en une seule journée.

**Historique des rééquilibrages** (5 itérations, chacune vérifiée par
simulation avant application — jamais ajusté "au jugé") :
1. V1 : 20 PE = 1 point d'attribut, budget séparé du PE compétitif.
2. Suppression de la conversion (le PE se sentait "pour rien").
3. x1 : premiers montants post-conversion, jugés encore trop faibles
   (profil "bon" ne dépassait pas 65 overall sur 15 titulaires).
4. x2 sur tout le barème : profil "bon" atteint ~76,5, mais le profil
   "faible/lambda" ne progressait qu'à ~61 — pas assez motivant.
5. **Actuel** : résultat/essais/points remontés spécifiquement (le
   "résultat" est le critère le plus facile à deviner, donc celui qui doit
   le plus aider un manager lambda) + assiduité presque doublée (elle ne
   dépend pas du talent de pronostiqueur, donc c'est le levier le plus sûr
   pour qu'un manager faible progresse quand même). Objectif explicite de
   l'utilisateur : "faut que ça soit fun pour tout le monde, même les
   joueurs lambda... faut que ça rapporte des points !"

**Simulation sur 18 journées** (budget = 500 + total gagné, tout dépensé
sur les 15 titulaires, vérifiée contre `data/config.js` réel) :
- Profil "lambda/faible" (8/18 résultats justes, quasi jamais le score
  exact, mais assidu aux entraînements malgré de mauvais pronostics —
  les deux sont indépendants) : 982 PE pronostics + 1500 PE assiduité =
  2982 budget → **~70 overall moyen** sur les 15 titulaires. Même un
  manager qui pronostique mal voit son équipe nettement progresser.
- Profil "bon" (15/18 résultats justes) : 3066 + 1800 = 5366 budget →
  **~86 overall moyen**.
- Profil "élite" (quasi excellent, 17/18 résultats, assiduité presque
  parfaite) : 5118 + 2250 = 7868 budget → **plafonné à 100** (le budget
  dépasse ce qui est utile pour 15 joueurs).
- Cas théorique absolu (littéralement tout juste sur les 18 journées,
  y compris le score exact à chaque fois — rappel : personne n'atteindra
  jamais ça) : budget de 13 736, de quoi maxer complètement 27 joueurs sur
  31. Accepté tel quel ("ça fait partie du jeu") plutôt que d'ajouter un
  garde-fou artificiel, puisque c'est structurellement inatteignable.

Le bonus d'assiduité (`services/presenceService.js`, ~4 fois/saison) reste
plus petit que les pronostics dans l'absolu — contrairement aux
pronostics, l'assiduité ne demande aucun talent particulier, donc c'est le
canal qui garantit une vraie progression pour tout le monde, pas seulement
les bons pronostiqueurs.

**⚠️ Chiffres historiques ci-dessus obsolètes sur ce point précis** : les
paliers d'assiduité ont été rééquilibrés depuis (0/150/300/450/600 →
0/50/100/150/250, voir `data/config.js`) — l'ancien barème pouvait à lui
seul dépasser une saison entière de bons pronostics, ce qui contredisait
le principe "canal secondaire" énoncé ci-dessus. Voir HANDOVER.md
pour l'état réel actuel.

## Prestige

Paliers recalibrés en cohérence avec l'économie de PE finale (0 → 400 →
1200 → 2500 → 4500 → 7000 PE). Calé sur les totaux de saison réels des
simulations ci-dessus : le profil "lambda" (2482 PE gagnés sur la saison)
atteint Titulaire, "bon" (4866) atteint Vétéran, "élite" (7368) atteint
Légende du Club — donc chaque tranche de manager voit une progression de
palier cohérente avec son niveau réel, pas un mur infranchissable.

## Composition d'équipe : toujours visuelle, mais plus "sans influence"

Les postes sur le terrain et le brassard de capitaine restent purement
visuels (n'importe qui peut jouer n'importe où, ça ne change aucun calcul).
Ce qui a changé : la note générale des cartes (donc la qualité de
l'équipe) N'EST PLUS indépendante du PE — voir section ci-dessus. La page
Classements le reflète : l'onglet "PE &
Prestige" est le classement officiel, l'onglet "Notes d'équipe" en est un
reflet dérivé (le PE alimente le budget, jamais l'inverse — avoir une belle
équipe ne redonne pas de PE).

## Historique par manager (`manager.history`)

Ajouté pour la page Statistiques (historique des PE, évolution de la note
d'équipe) et le générateur de journal "meilleure progression" : à chaque
résultat officiel encodé, `scoringService.recordHistorySnapshot` ajoute un
instantané `{matchday, pe, teamOverall}` pour chaque manager. Purement
additif — aucune règle de scoring n'a changé, c'est juste de la
consignation. Idempotent comme le reste de `gradeAllPredictionsForMatch` :
corriger un résultat déjà encodé met à jour l'instantané existant plutôt
que d'en empiler un nouveau.
