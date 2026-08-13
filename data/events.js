/**
 * La Hulpe 3 Fantasy Manager — Générateurs du Journal du Club
 *
 * Chaque générateur reçoit un `context` (voir services/journalService.js) et
 * renvoie soit `null` (rien à raconter ce cycle), soit
 * `{ icon, title, text, kind }` où `kind` ∈ 'award' | 'stat' | 'fun' | 'progress'
 * (purement visuel, voir .journal-entry.kind-* dans styles.css).
 *
 * Pour ajouter une nouvelle rubrique au journal : ajouter un objet
 * `{ id, run(context) }` au tableau JOURNAL_GENERATORS. Rien d'autre à
 * modifier — journalService les exécute tous automatiquement.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.data = window.LH3.data || {};

  function topByPe(managerResults) {
    if (!managerResults.length) return [];
    const max = Math.max(...managerResults.map((r) => r.peEarned));
    if (max <= 0) return [];
    return managerResults.filter((r) => r.peEarned === max);
  }

  const JOURNAL_GENERATORS = [
    {
      id: 'meilleur-pronostiqueur',
      run(ctx) {
        const top = topByPe(ctx.managerResults);
        if (!top.length) return null;
        const names = top.map((r) => r.managerName).join(' et ');
        return {
          icon: '🏆',
          kind: 'award',
          title: 'Meilleur pronostiqueur de la journée',
          text: `${names} rafle la mise avec ${top[0].peEarned} PE gagnés sur "${ctx.match.opponent}".`,
        };
      },
    },
    {
      id: 'score-exact',
      run(ctx) {
        const winners = ctx.managerResults.filter((r) => r.breakdown && r.breakdown.exactScore);
        if (!winners.length) return null;
        const names = winners.map((r) => r.managerName).join(', ');
        const s = ctx.match.result;
        return {
          icon: '🎯',
          kind: 'stat',
          title: 'Score exact trouvé !',
          text: `${names} avai${winners.length > 1 ? 'ent' : 't'} vu juste avec ${s.scoreFor}-${s.scoreAgainst}.`,
        };
      },
    },
    {
      id: 'coach-de-la-semaine',
      run(ctx) {
        const top = topByPe(ctx.managerResults);
        if (!top.length) return null;
        const winner = top[0];
        return {
          icon: '🧢',
          kind: 'award',
          title: 'Coach de la semaine',
          text: `${winner.coachName || winner.managerName} est désigné Coach de la Semaine pour sa lecture du match face à ${ctx.match.opponent}.`,
        };
      },
    },
    {
      id: 'capitaine-fetiche',
      run(ctx) {
        const counts = {};
        (ctx.allManagers || []).forEach((m) => {
          const cid = m.squad && m.squad.captainId;
          if (!cid) return;
          counts[cid] = (counts[cid] || 0) + 1;
        });
        const entries = Object.entries(counts);
        if (!entries.length) return null;
        entries.sort((a, b) => b[1] - a[1]);
        const [playerId, count] = entries[0];
        if (count < 2) return null; // pas assez significatif pour en parler
        const player = ctx.getPlayerName(playerId);
        return {
          icon: '👑',
          kind: 'fun',
          title: 'Le brassard qui revient souvent',
          text: `${player} est le capitaine le plus souvent désigné à travers les équipes de la ligue (${count} managers lui font confiance).`,
        };
      },
    },
    {
      id: 'meilleure-progression',
      run(ctx) {
        const withDelta = ctx.managerResults.filter((r) => r.overallDelta > 0);
        if (!withDelta.length) return null;
        withDelta.sort((a, b) => b.overallDelta - a.overallDelta);
        const winner = withDelta[0];
        return {
          icon: '📈',
          kind: 'progress',
          title: 'Meilleure progression',
          text: `L'équipe de ${winner.managerName} progresse le plus cette semaine : +${winner.overallDelta} de note d'équipe depuis la dernière journée.`,
        };
      },
    },
    {
      id: 'surprise-de-la-journee',
      run(ctx) {
        const withPrediction = ctx.managerResults.filter((r) => r.prediction && r.prediction.scoreFor !== null);
        if (!withPrediction.length) return null;
        const actual = ctx.match.result;
        const actualTotal = actual.scoreFor + actual.scoreAgainst;
        const ranked = withPrediction.map((r) => ({
          ...r,
          gap: Math.abs((r.prediction.scoreFor + r.prediction.scoreAgainst) - actualTotal),
        })).sort((a, b) => b.gap - a.gap);
        const biggest = ranked[0];
        if (biggest.gap < 15) return null; // pas assez surprenant pour en parler
        return {
          icon: '😲',
          kind: 'fun',
          title: 'Surprise de la journée',
          text: `${biggest.managerName} attendait ${biggest.prediction.scoreFor + biggest.prediction.scoreAgainst} points au compteur total, la réalité (${actualTotal}) en a décidé autrement — belle leçon d'humilité.`,
        };
      },
    },
    {
      id: 'stats-amusantes',
      run(ctx) {
        const withPrediction = ctx.managerResults.filter((r) => r.breakdown);
        if (withPrediction.length < 2) return null;
        const correctCount = withPrediction.filter((r) => r.breakdown.resultCorrect).length;
        const pct = Math.round((correctCount / withPrediction.length) * 100);
        return {
          icon: '🔢',
          kind: 'stat',
          title: 'Le saviez-vous ?',
          text: `${correctCount} manager${correctCount > 1 ? 's' : ''} sur ${withPrediction.length} avaient vu juste sur le vainqueur face à ${ctx.match.opponent} (${pct}%).`,
        };
      },
    },
  ];

  window.LH3.data.JOURNAL_GENERATORS = JOURNAL_GENERATORS;
})();
