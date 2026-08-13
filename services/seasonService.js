/**
 * La Hulpe 3 Fantasy Manager — Saison & Calendrier
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.services = window.LH3.services || {};

  function listMatches() {
    const state = window.LH3.services.stateService.getState();
    return state.matches.slice().sort((a, b) => a.matchday - b.matchday);
  }

  function getMatch(id) {
    const state = window.LH3.services.stateService.getState();
    return state.matches.find((m) => m.id === id) || null;
  }

  function getCurrentOpenMatch() {
    return listMatches().find((m) => m.status === 'ouvert') || null;
  }

  function updateMatchInfo(id, { opponent, date }) {
    const match = getMatch(id);
    if (!match) return;
    if (opponent !== undefined) match.opponent = opponent;
    if (date !== undefined) match.date = date;
    window.LH3.services.stateService.markDirty('matches');
    window.LH3.services.stateService.persist();
  }

  function setMatchStatus(id, status) {
    const match = getMatch(id);
    if (!match) return;
    match.status = status;
    window.LH3.services.stateService.markDirty('matches');
    window.LH3.services.stateService.persist();
  }

  /**
   * Encode le résultat d'un match, note tous les pronostics des managers,
   * distribue les PE et génère les entrées du Journal du Club correspondantes.
   * Réservé à l'admin (seul rôle autorisé à écrire matches/predictions de
   * tout le monde côté Supabase) — async car ça implique plusieurs allers-
   * retours réseau (lecture des pronostics, notation, journal).
   */
  async function finalizeMatch(id, result) {
    const match = getMatch(id);
    if (!match) return;
    match.result = result;
    match.status = 'termine';
    window.LH3.services.stateService.markDirty('matches');
    window.LH3.services.stateService.persist();

    await window.LH3.services.scoringService.gradeAllPredictionsForMatch(match.id);
    await window.LH3.services.journalService.generateForMatchday(match.id);
    window.LH3.services.stateService.notify();
  }

  /**
   * Admin uniquement : annule complètement la notation d'un match déjà joué —
   * reprend les PE distribués à tout le monde, efface le résultat et les
   * breakdowns, retire l'entrée d'historique et les brèves de journal
   * correspondantes, et remet le match "verrouillé". Les pronostics déjà
   * soumis par les managers restent intacts (pas besoin de les re-taper).
   * Même logique que presenceService.resetPeriod — utile pour un essai ou
   * une erreur de manipulation plutôt qu'un vrai résultat à corriger (pour
   * ça, "Modifier résultat" suffit déjà et re-note correctement).
   */
  async function unfinalizeMatch(id) {
    const match = getMatch(id);
    if (!match) return { ok: false, reason: 'Match introuvable.' };

    const state = window.LH3.services.stateService.getState();
    const touchedManagers = [];

    Object.values(state.managers).forEach((manager) => {
      const breakdown = manager.predictionResults && manager.predictionResults[id];
      if (!breakdown) return;
      if (breakdown.peEarned) window.LH3.services.peService.addPe(manager, -breakdown.peEarned);
      delete manager.predictionResults[id];
      manager.history = (manager.history || []).filter((h) => h.matchId !== id);
      touchedManagers.push(manager);
    });

    match.result = null;
    match.status = 'verrouille';
    const savedMatch = await window.LH3.services.storageService.saveMatch(match);
    if (!savedMatch) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };

    for (const manager of touchedManagers) {
      await window.LH3.services.storageService.saveManagerProgress(manager.id, manager.pe, manager.history);
      await window.LH3.services.storageService.savePredictionGrading(manager.id, id, { peEarned: 0 });
    }

    await window.LH3.services.storageService.deleteJournalForMatch(id);
    state.journal = state.journal.filter((e) => e.matchId !== id);

    window.LH3.services.stateService.notify();
    return { ok: true };
  }

  /** Admin uniquement : ajoute un match au calendrier. */
  async function addMatch({ matchday, opponent, date }) {
    opponent = (opponent || '').trim();
    matchday = Number(matchday);
    if (!opponent) return { ok: false, reason: 'Renseigne l\'adversaire.' };
    if (!date) return { ok: false, reason: 'Renseigne une date.' };
    if (!Number.isInteger(matchday) || matchday < 1) return { ok: false, reason: 'Numéro de journée invalide.' };

    const state = window.LH3.services.stateService.getState();
    if (state.matches.some((m) => m.matchday === matchday)) {
      return { ok: false, reason: 'La journée ' + matchday + ' existe déjà — choisis un autre numéro.' };
    }

    const match = { id: 'md-' + matchday, matchday, opponent, date, status: 'verrouille', result: null };
    const ok = await window.LH3.services.storageService.insertMatch(match);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };

    state.matches.push(match);
    window.LH3.services.stateService.notify();
    return { ok: true, match };
  }

  /**
   * Admin uniquement : retire un match du calendrier. S'il avait déjà été
   * noté, on annule d'abord la notation (voir unfinalizeMatch) pour que les
   * PE distribués ne restent pas acquis alors que le match disparaît.
   */
  async function removeMatch(id) {
    const match = getMatch(id);
    if (!match) return { ok: false, reason: 'Match introuvable.' };

    if (match.status === 'termine') {
      const undoRes = await unfinalizeMatch(id);
      if (!undoRes.ok) return undoRes;
    }

    const ok = await window.LH3.services.storageService.deleteMatch(id);
    if (!ok) return { ok: false, reason: 'Suppression impossible — vérifie ta connexion et réessaie.' };

    const state = window.LH3.services.stateService.getState();
    state.matches = state.matches.filter((m) => m.id !== id);
    window.LH3.services.stateService.notify();
    return { ok: true };
  }

  window.LH3.services.seasonService = {
    listMatches, getMatch, getCurrentOpenMatch, updateMatchInfo, setMatchStatus, finalizeMatch,
    unfinalizeMatch, addMatch, removeMatch,
  };
})();
