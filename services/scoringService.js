/**
 * La Hulpe 3 Fantasy Manager — Correction des pronostics & attribution des PE
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.services = window.LH3.services || {};

  const CONFIG = () => window.LH3.data.CONFIG;

  /**
   * Compare un pronostic à un résultat officiel et renvoie le détail des
   * points gagnés (chaque critère est indépendant et s'additionne).
   */
  function gradePrediction(prediction, result) {
    const pe = CONFIG().pe;
    const breakdown = {
      resultCorrect: false, exactScore: false, differenceCorrect: false,
      totalTriesCorrect: false, totalPointsCorrect: false,
      correctScorers: [], wrongScorers: [], motmCorrect: false, blunderCorrect: false,
      peEarned: 0,
    };

    if (prediction.scoreFor === null || prediction.scoreAgainst === null) {
      return breakdown; // aucun pronostic soumis pour cette journée
    }

    const derived = window.LH3.services.predictionService.derive(prediction.scoreFor, prediction.scoreAgainst);
    const actualDerived = window.LH3.services.predictionService.derive(result.scoreFor, result.scoreAgainst);

    let earned = 0;

    if (derived.result === actualDerived.result) {
      breakdown.resultCorrect = true;
      earned += pe.correctResult;
    }
    if (prediction.scoreFor === result.scoreFor && prediction.scoreAgainst === result.scoreAgainst) {
      breakdown.exactScore = true;
      earned += pe.exactScore;
    }
    if (derived.difference === actualDerived.difference) {
      breakdown.differenceCorrect = true;
      earned += pe.correctDifference;
    }
    if (prediction.totalTries !== null && prediction.totalTries === result.totalTries) {
      breakdown.totalTriesCorrect = true;
      earned += pe.correctTotalTries;
    }
    if (derived.totalPoints === actualDerived.totalPoints) {
      breakdown.totalPointsCorrect = true;
      earned += pe.correctTotalPoints;
    }

    // Chaque marqueur coché est jugé indépendamment : bonus s'il a vraiment
    // marqué, pénalité sinon. Coché "au hasard"/en masse devient risqué —
    // c'est le but (voir la page Règles).
    const predictedScorers = new Set(prediction.tryScorers || []);
    const actualScorers = new Set(result.tryScorers || []);
    predictedScorers.forEach((playerId) => {
      if (actualScorers.has(playerId)) {
        breakdown.correctScorers.push(playerId);
        earned += pe.perCorrectTryScorer;
      } else {
        breakdown.wrongScorers.push(playerId);
        earned += pe.perWrongTryScorer;
      }
    });

    if (prediction.manOfMatchId && prediction.manOfMatchId === result.manOfMatchId) {
      breakdown.motmCorrect = true;
      earned += pe.correctManOfMatch;
    }
    if (prediction.blunderId && prediction.blunderId === result.blunderId) {
      breakdown.blunderCorrect = true;
      earned += pe.correctBlunderOfMatch;
    }

    // Chaque critère peut individuellement être négatif (marqueurs ratés),
    // mais le total d'UNE journée ne fait jamais reculer ton PE cumulé — au
    // pire, une journée complètement ratée rapporte 0, jamais moins.
    breakdown.peEarned = Math.max(0, earned);
    return breakdown;
  }

  /**
   * Réservé à l'admin (seul rôle autorisé par les règles Supabase à lire
   * TOUS les pronostics d'une journée). Va chercher les pronostics de tout
   * le monde pour ce match, note chacun, et renvoie les PE + l'historique
   * vers Supabase. Ne touche jamais coach/player_boosts/squad des autres
   * managers (voir storageService.saveManagerProgress).
   */
  async function gradeAllPredictionsForMatch(matchId) {
    const match = window.LH3.services.seasonService.getMatch(matchId);
    if (!match || !match.result) return;

    const rows = await window.LH3.services.storageService.loadPredictionsForMatch(matchId);
    const state = window.LH3.services.stateService.getState();

    for (const row of rows) {
      const manager = state.managers[row.manager_id];
      if (!manager) continue; // pronostic d'un manager pas chargé localement (rare)

      const prediction = {
        scoreFor: row.score_for, scoreAgainst: row.score_against, totalTries: row.total_tries,
        tryScorers: row.try_scorers || [], manOfMatchId: row.man_of_match_id, blunderId: row.blunder_id,
        submittedAt: row.submitted_at,
      };
      manager.predictions = manager.predictions || {};
      manager.predictions[matchId] = prediction;

      // Un admin peut corriger un résultat déjà encodé : on retire d'abord les
      // PE précédemment attribués pour cette journée avant d'appliquer les
      // nouveaux, pour que la correction ne double-compte jamais.
      if (row.pe_earned) {
        window.LH3.services.peService.addPe(manager, -row.pe_earned);
      }

      const breakdown = gradePrediction(prediction, match.result);
      manager.predictionResults = manager.predictionResults || {};
      manager.predictionResults[matchId] = breakdown;
      if (breakdown.peEarned !== 0) {
        // peEarned peut être négatif (pénalité marqueurs ratés nette) — addPe
        // l'applique tel quel, y compris quand c'est un retrait.
        window.LH3.services.peService.addPe(manager, breakdown.peEarned);
      }

      recordHistorySnapshot(manager, match);

      await window.LH3.services.storageService.savePredictionGrading(manager.id, matchId, breakdown);
      await window.LH3.services.storageService.saveManagerProgress(manager.id, manager.pe, manager.history);
    }

    window.LH3.services.stateService.notify();
  }

  /**
   * Historique léger (PE + note d'équipe à chaque journée jouée), utilisé par
   * la page Statistiques et par le générateur de journal "meilleure
   * progression". Purement additif : ne modifie aucune règle de jeu, ne fait
   * que consigner un instantané. Idempotent (une correction de résultat met
   * à jour l'instantané existant au lieu d'en empiler un nouveau).
   */
  function recordHistorySnapshot(manager, match) {
    const teamOverall = window.LH3.services.playerService.teamOverall(manager);

    const snapshot = {
      matchday: match.matchday,
      matchId: match.id,
      date: match.date,
      pe: manager.pe,
      teamOverall,
    };

    manager.history = manager.history || [];
    const existingIdx = manager.history.findIndex((h) => h.matchId === match.id);
    if (existingIdx > -1) manager.history[existingIdx] = snapshot;
    else manager.history.push(snapshot);
    manager.history.sort((a, b) => a.matchday - b.matchday);
  }

  window.LH3.services.scoringService = { gradePrediction, gradeAllPredictionsForMatch };
})();
