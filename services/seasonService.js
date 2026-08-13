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

  window.LH3.services.seasonService = {
    listMatches, getMatch, getCurrentOpenMatch, updateMatchInfo, setMatchStatus, finalizeMatch,
  };
})();
