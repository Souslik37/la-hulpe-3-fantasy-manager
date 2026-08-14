/**
 * La Hulpe 3 Fantasy Manager — Configuration
 *
 * Toutes les valeurs d'équilibrage du jeu vivent ici. Rien d'autre dans le
 * code ne doit contenir de nombre magique lié au gameplay : si une valeur
 * mérite d'être ajustée un jour, elle doit être ajustable ICI.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.data = window.LH3.data || {};

  const CONFIG = {
    season: {
      number: 1,
      totalMatchdays: 18,
      startingPoints: 500, // points d'attributs à répartir en début de saison
      baseAttribute: 50,
      maxAttribute: 100,
    },

    // Liste canonique des 10 attributs joueur, dans l'ordre d'affichage.
    attributes: [
      { key: 'force', label: 'Force', short: 'FOR', icon: '💪' },
      { key: 'vitesse', label: 'Vitesse', short: 'VIT', icon: '⚡' },
      { key: 'technique', label: 'Technique', short: 'TEC', icon: '🎯' },
      { key: 'plaquage', label: 'Plaquage', short: 'PLQ', icon: '🛡️' },
      { key: 'vision', label: 'Vision', short: 'VIS', icon: '👁️' },
      { key: 'endurance', label: 'Endurance', short: 'END', icon: '🫁' },
      { key: 'mental', label: 'Mental', short: 'MEN', icon: '🧠' },
      { key: 'discipline', label: 'Discipline', short: 'DIS', icon: '📏' },
      { key: 'leadership', label: 'Leadership', short: 'LEA', icon: '📣' },
      { key: 'troisiemeMiTemps', label: 'Troisième Mi-Temps', short: '3MT', icon: '🍻' },
    ],

    // Paliers de rareté d'après la note générale (overall).
    rarity: {
      order: ['bronze', 'argent', 'or', 'diamant', 'legende'],
      tiers: {
        bronze: { label: 'Bronze', min: 0, max: 59 },
        argent: { label: 'Argent', min: 60, max: 69 },
        or: { label: 'Or', min: 70, max: 79 },
        diamant: { label: 'Diamant', min: 80, max: 89 },
        legende: { label: 'Légende', min: 90, max: 100 },
      },
    },

    // Récompenses en PE par élément de pronostic juste. "Bonus" car ils
    // s'additionnent : un score exact rapporte à la fois le bonus "résultat"
    // ET le bonus "score exact". Le PE EST le budget de points d'attributs
    // (pas de conversion séparée, voir CONFIG.season.startingPoints et
    // playerService.pointsAvailable) — bien pronostiquer fait donc
    // directement progresser ton équipe, c'est le but du jeu. Calibré (et
    // vérifié par simulation sur 18 journées, voir NOTES.md) pour qu'un
    // MANAGER LAMBDA (résultats moyens, ~8/18) atteigne déjà ~70 overall de
    // moyenne sur ses 15 titulaires en fin de saison, un bon manager ~86, et
    // qu'une saison quasi parfaite plafonne à 100 — tout le monde progresse
    // clairement, pas seulement les meilleurs pronostiqueurs. Le résultat
    // (deviné/pas) est volontairement le critère le plus généreux après le
    // score exact : c'est le plus facile à deviner, donc celui qui fait
    // progresser un manager lambda.
    pe: {
      correctResult: 80, // victoire / nul / défaite deviné
      exactScore: 200, // score exact deviné (les deux équipes) — le plus dur à deviner, donc le plus gros bonus
      correctDifference: 50, // écart de points deviné
      correctTotalTries: 50, // nombre total d'essais deviné
      correctTotalPoints: 50, // nombre total de points deviné
      perCorrectTryScorer: 25, // par joueur marqueur correctement deviné
      perWrongTryScorer: -10, // par joueur coché qui n'a PAS marqué
      correctManOfMatch: 60,
      correctBlunderOfMatch: 40,
    },

    // Nombre maximum de marqueurs d'essai cochables par pronostic — force à
    // choisir plutôt qu'à cocher large (sans quoi cocher tous les titulaires
    // resterait rentable même avec une pénalité douce, voir perWrongTryScorer).
    maxTryScorerPicks: 5,

    // Paliers de Prestige (méta-progression lente sur la saison), calibrés
    // sur l'économie de PE ci-dessus : "Légende du Club" doit être difficile
    // mais atteignable en fin de saison pour un manager très assidu et bon
    // pronostiqueur, pas un mur infranchissable ni un acquis en 3 journées.
    prestige: {
      levels: [
        { level: 1, name: 'Rookie', peRequired: 0 },
        { level: 2, name: 'Espoir', peRequired: 400 },
        { level: 3, name: 'Titulaire', peRequired: 1200 },
        { level: 4, name: 'Confirmé', peRequired: 2500 },
        { level: 5, name: 'Vétéran', peRequired: 4500 },
        { level: 6, name: 'Légende du Club', peRequired: 7000 },
      ],
    },

    squad: {
      startersCount: 15,
    },

    // Bonus d'assiduité (présence aux entraînements), distribué par l'admin
    // ~tous les 2 mois (voir page Administration + Calendrier). Purement
    // additif, jamais de pénalité — un vrai coup de pouce qui garantit
    // qu'un manager lambda progresse quand même, sans dépendre du talent
    // de pronostiqueur. Calibré pour rester modeste par rapport à l'économie
    // des pronostics (un match bien deviné rapporte ~250-350 PE) : même en
    // "Très bon" aux 4 évaluations de la saison, l'assiduité seule (1000 PE
    // max) ne doit jamais rivaliser avec une saison de bons pronostics —
    // c'est un plus, pas le vrai levier de classement. Paliers volontairement
    // inégaux : chaque échelon vaut +50, sauf le dernier (Très bon) qui
    // ajoute un vrai bonus d'excellence de +100 plutôt que +50.
    presence: {
      tiers: [
        { key: 'tres-faible', label: 'Très faible', pe: 0 },
        { key: 'faible', label: 'Faible', pe: 50 },
        { key: 'moyen', label: 'Moyen', pe: 100 },
        { key: 'bon', label: 'Bon', pe: 150 },
        { key: 'tres-bon', label: 'Très bon', pe: 250 },
      ],
    },
  };

  window.LH3.data.CONFIG = CONFIG;
})();
