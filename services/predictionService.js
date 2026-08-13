/**
 * La Hulpe 3 Fantasy Manager — Pronostics
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.services = window.LH3.services || {};

  function emptyPrediction() {
    return {
      scoreFor: null,
      scoreAgainst: null,
      totalTries: null,
      tryScorers: [],
      manOfMatchId: null,
      blunderId: null,
      submittedAt: null,
    };
  }

  function getPrediction(manager, matchId) {
    return (manager.predictions && manager.predictions[matchId]) || emptyPrediction();
  }

  /** Champs dérivés automatiquement du score exact saisi. */
  function derive(scoreFor, scoreAgainst) {
    if (scoreFor === null || scoreAgainst === null || scoreFor === undefined || scoreAgainst === undefined) {
      return { result: null, difference: null, totalPoints: null };
    }
    let result = 'N';
    if (scoreFor > scoreAgainst) result = 'V';
    else if (scoreFor < scoreAgainst) result = 'D';
    return {
      result,
      difference: Math.abs(scoreFor - scoreAgainst),
      totalPoints: scoreFor + scoreAgainst,
    };
  }

  function savePrediction(manager, matchId, data) {
    const match = window.LH3.services.seasonService.getMatch(matchId);
    if (!match || match.status !== 'ouvert') {
      return { ok: false, reason: 'Les pronostics sont fermés pour cette journée.' };
    }
    const maxScorers = window.LH3.data.CONFIG.maxTryScorerPicks;
    if (data.tryScorers && data.tryScorers.length > maxScorers) {
      return { ok: false, reason: `Maximum ${maxScorers} marqueurs par pronostic.` };
    }
    manager.predictions = manager.predictions || {};
    const prediction = Object.assign(emptyPrediction(), data, {
      submittedAt: new Date().toISOString(),
    });
    manager.predictions[matchId] = prediction;

    // Les pronostics vivent dans leur propre table (pas dans la ligne du
    // manager) : sauvegarde dédiée, en tâche de fond comme le reste.
    window.LH3.services.storageService.savePredictionRow(manager.id, matchId, prediction).then((ok) => {
      if (!ok) window.LH3.components.toast.show('Pronostic gardé localement mais pas encore synchronisé — vérifie ta connexion.', 'error');
    });
    window.LH3.services.stateService.notify();
    return { ok: true };
  }

  window.LH3.services.predictionService = { emptyPrediction, getPrediction, derive, savePrediction };
})();
