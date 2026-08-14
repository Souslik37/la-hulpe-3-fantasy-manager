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
        id: window.LH3.utils.id.uuid(),
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

  /** Retire une éventuelle entrée précédente du même generatorId pour cette journée (régénération idempotente). */
  async function replaceGeneratedEntry(matchId, generatorId, entry) {
    const state = window.LH3.services.stateService.getState();
    const oldIds = state.journal.filter((e) => e.generatorId === generatorId && e.matchId === matchId).map((e) => e.id);
    if (oldIds.length) {
      state.journal = state.journal.filter((e) => !oldIds.includes(e.id));
      await window.LH3.services.storageService.deleteJournalEntriesByIds(oldIds);
    }
    if (!entry) return;
    state.journal.unshift(entry);
    await window.LH3.services.storageService.saveJournalEntries([entry]);
  }

  function quoteLines(comments, managers) {
    return comments.map((c) => '"' + c.text + '" — ' + ((managers[c.managerId] && managers[c.managerId].name) || 'un manager'));
  }

  /**
   * Admin uniquement (RLS predictions n'autorise que l'admin à tout lire).
   * Compile les pronostics déjà soumis (résultat, marqueurs les plus
   * cochés) + les commentaires "avant-match" en une brève de journal.
   */
  async function generatePreMatchReport(matchId) {
    const match = window.LH3.services.seasonService.getMatch(matchId);
    if (!match) return { ok: false, reason: 'Match introuvable.' };

    const rows = await window.LH3.services.storageService.loadPredictionsForMatch(matchId);
    const submitted = rows.filter((r) => r.score_for !== null && r.score_against !== null);
    const state = window.LH3.services.stateService.getState();
    const comments = window.LH3.services.commentService.listComments(matchId, 'pre');

    if (!submitted.length && !comments.length) {
      return { ok: false, reason: 'Aucun pronostic ni commentaire pour le moment — reviens plus tard.' };
    }

    const parts = [];
    if (submitted.length) {
      const counts = { V: 0, N: 0, D: 0 };
      submitted.forEach((r) => {
        const d = window.LH3.services.predictionService.derive(r.score_for, r.score_against);
        if (d.result) counts[d.result]++;
      });
      const pct = (n) => Math.round((n / submitted.length) * 100);
      parts.push(`${submitted.length} pronostic${submitted.length > 1 ? 's' : ''} déjà soumis : ${pct(counts.V)}% misent sur la victoire, ${pct(counts.N)}% sur le nul, ${pct(counts.D)}% sur la défaite.`);

      const scorerCounts = {};
      submitted.forEach((r) => (r.try_scorers || []).forEach((id) => { scorerCounts[id] = (scorerCounts[id] || 0) + 1; }));
      const topScorers = Object.entries(scorerCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([id, count]) => { const p = window.LH3.services.playerService.getPlayerBase(id); return (p ? p.name : 'un joueur') + ' (' + count + ')'; });
      if (topScorers.length) parts.push('Marqueurs les plus attendus : ' + topScorers.join(', ') + '.');
    }
    if (comments.length) parts.push('Dans les couloirs du club : ' + quoteLines(comments, state.managers).join(' '));

    const entry = {
      id: window.LH3.utils.id.uuid(),
      generatorId: 'pre-match-report',
      matchId: match.id,
      matchday: match.matchday,
      date: match.date,
      icon: '📋',
      title: 'Avant-match : La Hulpe 3 vs ' + match.opponent,
      text: parts.join(' '),
      kind: 'preview',
      createdAt: new Date().toISOString(),
    };
    await replaceGeneratedEntry(matchId, 'pre-match-report', entry);
    window.LH3.services.stateService.notify();
    return { ok: true };
  }

  /** Admin uniquement. Compile les commentaires "après-match" en une brève (les stats/récompenses restent gérées par generateForMatchday). */
  async function generatePostMatchComments(matchId) {
    const match = window.LH3.services.seasonService.getMatch(matchId);
    if (!match) return { ok: false, reason: 'Match introuvable.' };

    const state = window.LH3.services.stateService.getState();
    const comments = window.LH3.services.commentService.listComments(matchId, 'post');
    if (!comments.length) return { ok: false, reason: 'Aucun commentaire après-match pour le moment.' };

    const entry = {
      id: window.LH3.utils.id.uuid(),
      generatorId: 'post-match-comments',
      matchId: match.id,
      matchday: match.matchday,
      date: match.date,
      icon: '💬',
      title: 'Les réactions après La Hulpe 3 vs ' + match.opponent,
      text: quoteLines(comments, state.managers).join(' '),
      kind: 'fun',
      createdAt: new Date().toISOString(),
    };
    await replaceGeneratedEntry(matchId, 'post-match-comments', entry);
    window.LH3.services.stateService.notify();
    return { ok: true };
  }

  window.LH3.services.journalService = { generateForMatchday, listEntries, generatePreMatchReport, generatePostMatchComments };
})();
