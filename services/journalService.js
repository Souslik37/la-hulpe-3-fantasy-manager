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

  /** Admin uniquement (RLS journal ne permet l'écriture qu'à un compte admin) : retire une brève générée. */
  async function removeEntry(id) {
    const state = window.LH3.services.stateService.getState();
    if (!state.journal.some((e) => e.id === id)) return { ok: false, reason: 'Brève introuvable.' };

    const ok = await window.LH3.services.storageService.deleteJournalEntriesByIds([id]);
    if (!ok) return { ok: false, reason: 'Suppression impossible — vérifie ta connexion et réessaie.' };

    state.journal = state.journal.filter((e) => e.id !== id);
    window.LH3.services.stateService.notify();
    return { ok: true };
  }

  function quoteLines(comments, managers) {
    return comments.map((c) => '"' + c.text + '" — ' + ((managers[c.managerId] && managers[c.managerId].name) || 'un manager'));
  }

  function managerName(state, managerId) {
    return (state.managers[managerId] && state.managers[managerId].name) || 'un manager';
  }

  function getPlayerName(playerId) {
    const p = window.LH3.services.playerService.getPlayerBase(playerId);
    return p ? p.name : 'un joueur inconnu';
  }

  /**
   * "Rôles" fun du rapport avant-match — un petit portrait par style de
   * pronostic, calculés sur les pronostics déjà soumis. Toujours basés sur
   * un classement (le plus/le moins) plutôt qu'un seuil fixe : jamais de
   * rôle vide faute de "bonne réponse", il y a toujours un premier/dernier.
   * Demande au moins 2 pronostics pour être fun (sinon tout le monde "gagne"
   * chaque rôle tout seul).
   */
  function computePreMatchRoles(submitted, state) {
    if (submitted.length < 2) return [];
    const name = (id) => managerName(state, id);
    const withStats = submitted.map((r) => ({
      r, total: r.score_for + r.score_against, gap: Math.abs(r.score_for - r.score_against),
    }));
    const roles = [];

    const byGap = withStats.slice().sort((a, b) => b.gap - a.gap)[0];
    roles.push({ icon: '🔥', name: 'Le Téméraire', manager: name(byGap.r.manager_id), detail: `${byGap.gap} pts d'écart prédits (${byGap.r.score_for}–${byGap.r.score_against})` });

    const byMinTotal = withStats.slice().sort((a, b) => a.total - b.total)[0];
    roles.push({ icon: '🗼', name: 'La Petite Tour Eiffel', manager: name(byMinTotal.r.manager_id), detail: `${byMinTotal.total} points au total prédits` });

    const byMaxTotal = withStats.slice().sort((a, b) => b.total - a.total)[0];
    roles.push({ icon: '💣', name: 'Le Bombardier', manager: name(byMaxTotal.r.manager_id), detail: `${byMaxTotal.total} points au total prédits` });

    const byScorerCount = submitted.slice().sort((a, b) => (b.try_scorers || []).length - (a.try_scorers || []).length)[0];
    const scorerCount = (byScorerCount.try_scorers || []).length;
    if (scorerCount > 0) {
      roles.push({ icon: '🎯', name: 'Le Sniper', manager: name(byScorerCount.manager_id), detail: `${scorerCount} marqueur${scorerCount > 1 ? 's' : ''} coché${scorerCount > 1 ? 's' : ''}` });
    }

    const avgFor = withStats.reduce((s, x) => s + x.r.score_for, 0) / submitted.length;
    const avgAgainst = withStats.reduce((s, x) => s + x.r.score_against, 0) / submitted.length;
    const withDistToAvg = withStats.map((x) => ({ ...x, distToAvg: Math.abs(x.r.score_for - avgFor) + Math.abs(x.r.score_against - avgAgainst) })).sort((a, b) => a.distToAvg - b.distToAvg);
    roles.push({ icon: '🐑', name: 'Le Mouton', manager: name(withDistToAvg[0].r.manager_id), detail: 'Pronostic le plus proche de la moyenne du groupe' });
    const electron = withDistToAvg[withDistToAvg.length - 1];
    if (electron.r.manager_id !== withDistToAvg[0].r.manager_id) {
      roles.push({ icon: '🦄', name: 'L\'Électron Libre', manager: name(electron.r.manager_id), detail: 'Pronostic le plus éloigné des autres' });
    }

    const bySubmitTime = submitted.slice().sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
    roles.push({ icon: '🌅', name: 'Le Premier de Classe', manager: name(bySubmitTime[0].manager_id), detail: 'Premier pronostic envoyé' });
    const last = bySubmitTime[bySubmitTime.length - 1];
    if (last.manager_id !== bySubmitTime[0].manager_id) {
      roles.push({ icon: '🐌', name: 'Le Dernier Moment', manager: name(last.manager_id), detail: 'Dernier pronostic envoyé' });
    }

    return roles;
  }

  /**
   * "Rôles" fun du rapport après-match — cette fois sur qui avait raison.
   * Même principe que computePreMatchRoles : "le plus proche de" plutôt
   * qu'un seuil, donc toujours un gagnant même un jour où personne n'a
   * rien deviné d'exact (voir Le Voyant / Le Sang-Froid).
   */
  function computePostMatchRoles(graded, result, state) {
    if (graded.length < 2) return [];
    const name = (id) => managerName(state, id);
    const withDist = graded.map((r) => ({ r, dist: Math.abs(r.score_for - result.scoreFor) + Math.abs(r.score_against - result.scoreAgainst) }))
      .sort((a, b) => a.dist - b.dist);
    const roles = [];

    const voyant = withDist[0];
    roles.push({
      icon: '🔮', name: 'Le Voyant', manager: name(voyant.r.manager_id),
      detail: voyant.dist === 0 ? 'Score exact trouvé !' : `À ${voyant.dist} pt${voyant.dist > 1 ? 's' : ''} du score réel (${voyant.r.score_for}–${voyant.r.score_against})`,
    });

    const sangFroid = withDist.find((x) => x.r.manager_id !== voyant.r.manager_id);
    if (sangFroid) {
      roles.push({ icon: '🧊', name: 'Le Sang-Froid', manager: name(sangFroid.r.manager_id), detail: `À ${sangFroid.dist} pt${sangFroid.dist > 1 ? 's' : ''} du score réel` });
    }

    const byScorerCorrect = graded.slice().sort((a, b) => (b.breakdown.correctScorers || []).length - (a.breakdown.correctScorers || []).length)[0];
    const correctCount = (byScorerCorrect.breakdown.correctScorers || []).length;
    if (correctCount > 0) {
      roles.push({ icon: '🎯', name: 'Sniper confirmé', manager: name(byScorerCorrect.manager_id), detail: `${correctCount} marqueur${correctCount > 1 ? 's' : ''} correctement deviné${correctCount > 1 ? 's' : ''}` });
    }

    if (graded.length >= 3) {
      const grandEcart = withDist[withDist.length - 1];
      if (grandEcart.r.manager_id !== voyant.r.manager_id) {
        roles.push({ icon: '🎢', name: 'Le Grand Écart', manager: name(grandEcart.r.manager_id), detail: `À ${grandEcart.dist} pts du score réel (${grandEcart.r.score_for}–${grandEcart.r.score_against})` });
      }
    }

    // Peut désigner plusieurs managers à la fois (ex: 2 personnes ont
    // toutes les deux deviné homme du match + boulette) — jamais un seul
    // "gagnant" arbitraire choisi parmi des ex æquo.
    const bothLucky = graded.filter((r) => r.breakdown.motmCorrect && r.breakdown.blunderCorrect);
    const oneLucky = graded.filter((r) => r.breakdown.motmCorrect || r.breakdown.blunderCorrect);
    const luckyPool = bothLucky.length ? bothLucky : oneLucky;
    if (luckyPool.length) {
      let detail;
      if (bothLucky.length) detail = 'Homme du match ET boulette devinés';
      else if (luckyPool.length === 1) detail = luckyPool[0].breakdown.motmCorrect ? 'Homme du match deviné' : 'Boulette devinée';
      else detail = 'Homme du match ou boulette deviné';
      roles.push({ icon: '🍀', name: 'Le Chanceux du Jour', manager: luckyPool.map((r) => name(r.manager_id)).join(', '), detail });
    }

    const { formatSigned } = window.LH3.utils.format;
    const maxPe = Math.max(...graded.map((r) => r.pe_earned || 0));
    const minPe = Math.min(...graded.map((r) => r.pe_earned || 0));
    const crackPool = graded.filter((r) => (r.pe_earned || 0) === maxPe);
    const boulePool = graded.filter((r) => (r.pe_earned || 0) === minPe);
    roles.push({ icon: '🚀', name: 'Le Crack du Jour', manager: crackPool.map((r) => name(r.manager_id)).join(', '), detail: `${formatSigned(maxPe)} PE sur cette journée` });
    if (minPe !== maxPe) {
      roles.push({ icon: '🤡', name: 'Le Boulet du Jour', manager: boulePool.map((r) => name(r.manager_id)).join(', '), detail: `${formatSigned(minPe)} PE sur cette journée` });
    }

    return roles;
  }

  /**
   * Admin uniquement (RLS predictions n'autorise que l'admin à tout lire).
   * Compile les pronostics déjà soumis + les commentaires "avant-match" en
   * une brève de journal — `payload` structuré pour un affichage riche
   * (voir components/matchReport.js), `text` gardé en repli simple.
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
    let payload = { type: 'pre-match', opponent: match.opponent, predictionsCount: submitted.length, comments: comments.map((c) => ({ author: managerName(state, c.managerId), text: c.text })) };

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
        .map(([id, count]) => ({ name: getPlayerName(id), count }));
      if (topScorers.length) parts.push('Marqueurs les plus attendus : ' + topScorers.map((s) => s.name + ' (' + s.count + ')').join(', ') + '.');

      const totalPointsList = submitted.map((r) => r.score_for + r.score_against);
      const totalTriesList = submitted.map((r) => r.total_tries).filter((n) => n !== null && n !== undefined);
      const avg = (list) => Math.round(list.reduce((a, b) => a + b, 0) / list.length);
      const maxTotalPoints = Math.max(...totalPointsList);

      payload = Object.assign(payload, {
        resultSplit: { V: pct(counts.V), N: pct(counts.N), D: pct(counts.D) },
        avgTotalPoints: avg(totalPointsList),
        maxTotalPoints,
        avgTotalTries: totalTriesList.length ? avg(totalTriesList) : null,
        topScorers,
        roles: computePreMatchRoles(submitted, state),
      });
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
      payload,
      createdAt: new Date().toISOString(),
    };
    await replaceGeneratedEntry(matchId, 'pre-match-report', entry);
    window.LH3.services.stateService.notify();
    return { ok: true };
  }

  /**
   * Admin uniquement (RLS predictions n'autorise que l'admin à tout lire).
   * Compile le vrai résultat + qui a deviné quoi + les commentaires
   * "après-match" en une brève de journal — nécessite le résultat officiel
   * déjà encodé (les stats/récompenses par générateur restent gérées
   * séparément par generateForMatchday, déclenché automatiquement).
   */
  async function generatePostMatchComments(matchId) {
    const match = window.LH3.services.seasonService.getMatch(matchId);
    if (!match) return { ok: false, reason: 'Match introuvable.' };
    if (!match.result) return { ok: false, reason: 'Le résultat officiel n\'est pas encore encodé.' };

    const state = window.LH3.services.stateService.getState();
    const comments = window.LH3.services.commentService.listComments(matchId, 'post');
    const rows = await window.LH3.services.storageService.loadPredictionsForMatch(matchId);
    const graded = rows.filter((r) => r.breakdown);

    const result = match.result;
    const exactScoreWinners = graded.filter((r) => r.breakdown.exactScore).map((r) => managerName(state, r.manager_id));
    const resultCorrectCount = graded.filter((r) => r.breakdown.resultCorrect).length;

    const payload = {
      type: 'post-match',
      opponent: match.opponent,
      scoreFor: result.scoreFor,
      scoreAgainst: result.scoreAgainst,
      totalTries: result.totalTries,
      totalPoints: result.scoreFor + result.scoreAgainst,
      tryScorers: (result.tryScorers || []).map(getPlayerName),
      manOfMatch: result.manOfMatchId ? getPlayerName(result.manOfMatchId) : null,
      blunder: result.blunderId ? getPlayerName(result.blunderId) : null,
      gradedCount: graded.length,
      resultCorrectCount,
      resultCorrectPct: graded.length ? Math.round((resultCorrectCount / graded.length) * 100) : null,
      exactScoreWinners,
      roles: computePostMatchRoles(graded, result, state),
      comments: comments.map((c) => ({ author: managerName(state, c.managerId), text: c.text })),
    };

    const textParts = [`Score final : ${result.scoreFor} – ${result.scoreAgainst} (${result.totalTries || 0} essais, ${payload.totalPoints} points).`];
    if (graded.length) textParts.push(`${resultCorrectCount}/${graded.length} managers avaient deviné le bon résultat.`);
    if (exactScoreWinners.length) textParts.push('Score exact trouvé par ' + exactScoreWinners.join(', ') + '.');
    if (comments.length) textParts.push('Dans les couloirs du club : ' + quoteLines(comments, state.managers).join(' '));

    const entry = {
      id: window.LH3.utils.id.uuid(),
      generatorId: 'post-match-comments',
      matchId: match.id,
      matchday: match.matchday,
      date: match.date,
      icon: '💬',
      title: 'Après-match : La Hulpe 3 vs ' + match.opponent,
      text: textParts.join(' '),
      kind: 'fun',
      payload,
      createdAt: new Date().toISOString(),
    };
    await replaceGeneratedEntry(matchId, 'post-match-comments', entry);
    window.LH3.services.stateService.notify();
    return { ok: true };
  }

  window.LH3.services.journalService = { generateForMatchday, listEntries, removeEntry, generatePreMatchReport, generatePostMatchComments };
})();
