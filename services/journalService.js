/**
 * La Hulpe 3 Fantasy Manager — Journal du Club
 *
 * Fait tourner tous les générateurs de data/events.js après l'encodage d'un
 * résultat, et conserve les entrées produites dans state.journal.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.services = window.LH3.services || {};

  function buildContext(matchId) {
    const match = window.LH3.services.seasonService.getMatch(matchId);
    const managers = window.LH3.services.managerService.listManagers();

    const managerResults = managers
      .map((m) => {
        const breakdown = m.predictionResults && m.predictionResults[matchId];
        const prediction = window.LH3.services.predictionService.getPrediction(m, matchId);
        if (!breakdown) return null;

        // Delta de note d'équipe depuis la journée précédente jouée par ce
        // manager (les 2 derniers instantanés de son historique) — sert au
        // générateur "meilleure progression".
        const history = m.history || [];
        const idx = history.findIndex((h) => h.matchId === matchId);
        const current = idx > -1 ? history[idx] : null;
        const previous = idx > 0 ? history[idx - 1] : null;
        const overallDelta = current && previous ? current.teamOverall - previous.teamOverall : 0;

        return {
          managerId: m.id,
          managerName: m.name,
          coachName: m.coach && m.coach.name,
          peEarned: breakdown.peEarned,
          breakdown,
          prediction,
          overallDelta,
        };
      })
      .filter(Boolean);

    return {
      match,
      managerResults,
      allManagers: managers,
      getPlayerName(playerId) {
        const p = window.LH3.services.playerService.getPlayerBase(playerId);
        return p ? p.name : 'Joueur inconnu';
      },
    };
  }

  async function generateForMatchday(matchId) {
    const state = window.LH3.services.stateService.getState();
    const context = buildContext(matchId);
    if (!context.match) return;

    // Regénération idempotente : si un admin corrige un résultat déjà
    // encodé, on retire d'abord les entrées précédentes de cette journée
    // (localement ET côté serveur) pour ne jamais dupliquer les brèves.
    state.journal = state.journal.filter((entry) => entry.matchId !== matchId);
    await window.LH3.services.storageService.deleteJournalForMatch(matchId);

    const newEntries = [];
    window.LH3.data.JOURNAL_GENERATORS.forEach((generator) => {
      let entry = null;
      try {
        entry = generator.run(context);
      } catch (e) {
        console.error('[journalService] générateur "' + generator.id + '" en erreur', e);
      }
      if (!entry) return;
      newEntries.push({
        id: window.LH3.utils.id.uid('news'),
        generatorId: generator.id,
        matchId: context.match.id,
        matchday: context.match.matchday,
        date: context.match.date,
        icon: entry.icon,
        title: entry.title,
        text: entry.text,
        kind: entry.kind || 'stat',
        createdAt: new Date().toISOString(),
      });
    });

    newEntries.forEach((e) => state.journal.unshift(e));
    await window.LH3.services.storageService.saveJournalEntries(newEntries);
  }

  function listEntries() {
    const state = window.LH3.services.stateService.getState();
    return state.journal;
  }

  window.LH3.services.journalService = { generateForMatchday, listEntries };
})();
