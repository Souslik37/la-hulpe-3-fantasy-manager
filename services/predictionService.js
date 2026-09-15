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

  /**
   * Admin uniquement (RLS predictions_insert_own_or_admin) : soumet le
   * pronostic d'UN AUTRE manager à sa place — pour rattraper un vrai pépin
   * de soumission (score manquant avant le correctif, ou "j'ai rempli mais
   * pas cliqué valider"), sans devoir rouvrir la journée pour tout le
   * monde. Contrairement à savePrediction, fonctionne même si la journée
   * n'est plus "ouverte". Si le match est déjà noté, re-note tout le monde
   * juste après (idempotent, voir scoringService.gradeAllPredictionsForMatch)
   * pour que ce pronostic compte immédiatement dans les PE.
   */
  async function adminBackfillPrediction(managerId, matchId, data) {
    const match = window.LH3.services.seasonService.getMatch(matchId);
    if (!match) return { ok: false, reason: 'Match introuvable.' };
    const maxScorers = window.LH3.data.CONFIG.maxTryScorerPicks;
    if (data.tryScorers && data.tryScorers.length > maxScorers) {
      return { ok: false, reason: `Maximum ${maxScorers} marqueurs par pronostic.` };
    }

    const prediction = Object.assign(emptyPrediction(), data, { submittedAt: new Date().toISOString() });
    const ok = await window.LH3.services.storageService.savePredictionRow(managerId, matchId, prediction);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };

    if (match.result) {
      await window.LH3.services.scoringService.gradeAllPredictionsForMatch(matchId);
    }
    window.LH3.services.stateService.notify();
    return { ok: true };
  }

  window.LH3.services.predictionService = { emptyPrediction, getPrediction, derive, savePrediction, adminBackfillPrediction };
})();
