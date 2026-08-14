/**
 * La Hulpe 3 Fantasy Manager — Dashboard (Accueil)
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.pages = window.LH3.pages || {};

  const { el } = window.LH3.utils.dom;

  function computeTeamOverall(manager) {
    const playerService = window.LH3.services.playerService;
    const cards = manager.squad.starters.map((id) => playerService.getCard(manager, id)).filter(Boolean);
    return cards.length ? Math.round(cards.reduce((a, c) => a + c.overall, 0) / cards.length) : 0;
  }

  function computeRank(manager) {
    const managers = window.LH3.services.managerService.listManagers()
      .slice()
      .sort((a, b) => (b.pe || 0) - (a.pe || 0));
    const idx = managers.findIndex((m) => m.id === manager.id);
    return { rank: idx + 1, total: managers.length };
  }

  // ── Hero : prochain match ────────────────────────────────────────────────
  function buildHero(manager) {
    const match = window.LH3.services.seasonService.getCurrentOpenMatch();
    if (!match) {
      return el('div', { className: 'hero-card' }, [
        el('div', { className: 'hero-eyebrow' }, ['SAISON EN COURS']),
        el('div', { className: 'hero-title' }, ['Aucune journée ouverte pour le moment']),
        el('div', { className: 'hero-meta' }, ['Reviens un peu plus tard, l\'admin ouvrira bientôt la prochaine journée.']),
      ]);
    }
    const days = window.LH3.utils.format.daysUntil(match.date);
    const dayLabel = days === 0 ? 'C\'est aujourd\'hui !' : days === 1 ? 'C\'est demain !' : days > 1 ? `Dans ${days} jours` : 'En cours';
    const hasPredicted = Object.prototype.hasOwnProperty.call(manager.predictions || {}, match.id)
      && manager.predictions[match.id].submittedAt;

    return el('div', { className: 'hero-card' }, [
      el('div', { className: 'hero-eyebrow' }, ['PROCHAIN MATCH · JOURNÉE ' + match.matchday]),
      el('div', { className: 'hero-title' }, ['La Hulpe 3 vs ' + match.opponent]),
      el('div', { className: 'hero-meta' }, [window.LH3.utils.format.formatDateFr(match.date) + ' · ' + dayLabel]),
      el('div', { className: 'hero-actions' }, [
        el('button', { className: 'btn btn-primary', onClick: () => { window.location.hash = '#predictions'; } },
          [hasPredicted ? '✏️ Modifier mon pronostic' : '🎯 Faire mon pronostic']),
        el('div', { className: 'hero-status' }, [hasPredicted ? '✅ Pronostic envoyé' : '⏳ Pronostic à faire']),
      ]),
    ]);
  }

  // ── Stat tiles ───────────────────────────────────────────────────────────
  function buildStatTiles(manager) {
    const playerService = window.LH3.services.playerService;
    const prestige = window.LH3.services.peService.prestigeInfo(manager);
    const rank = computeRank(manager);

    const tiles = [
      { ic: '✨', n: manager.pe || 0, l: 'Points d\'expérience', animate: true },
      { ic: '🎖️', n: prestige.name, l: 'Rang prestige' },
      { ic: '📊', n: '#' + rank.rank + ' / ' + rank.total, l: 'Classement actuel' },
      { ic: '🧮', n: playerService.pointsRemaining(manager), l: 'Points à répartir', animate: true },
    ];

    const wrap = el('div', { className: 'stat-tiles' });
    tiles.forEach((t) => {
      const numEl = el('div', { className: 'n' }, [t.animate ? '0' : String(t.n)]);
      wrap.appendChild(el('div', { className: 'stat-tile' }, [
        el('div', { className: 'ic' }, [t.ic]),
        numEl,
        el('div', { className: 'l' }, [t.l]),
      ]));
      if (t.animate) window.LH3.utils.animate.animateCounter(numEl, t.n);
    });
    return wrap;
  }

  // ── Widget : Mon équipe ──────────────────────────────────────────────────
  function buildTeamWidget(manager) {
    const playerService = window.LH3.services.playerService;
    const overall = computeTeamOverall(manager);
    const captain = manager.squad.captainId ? playerService.getCard(manager, manager.squad.captainId) : null;
    const cards = manager.squad.starters.map((id) => playerService.getCard(manager, id)).filter(Boolean);
    const best = cards.slice().sort((a, b) => b.overall - a.overall)[0];

    return el('div', { className: 'widget-card' }, [
      el('div', { className: 'widget-head' }, [el('span', { className: 'ic' }, ['👥']), 'Mon équipe']),
      el('div', { className: 'stat-highlight-card', style: { marginBottom: '14px' } }, [
        el('div', { className: 'ic' }, ['⭐']),
        el('div', {}, [
          el('div', { className: 'val' }, [String(overall)]),
          el('div', { className: 'lbl' }, ['Note d\'équipe (XV titulaire)']),
        ]),
      ]),
      el('div', { className: 'recap-row' }, [el('span', { className: 'muted' }, ['Capitaine']), el('span', { style: { fontWeight: '750' } }, [captain ? captain.name : 'Aucun']) ]),
      el('div', { className: 'recap-row' }, [el('span', { className: 'muted' }, ['Meilleur joueur']), el('span', { style: { fontWeight: '750' } }, [best ? `${best.name} (${best.overall})` : '—'])]),
      el('button', { className: 'btn btn-block', style: { marginTop: '14px' }, onClick: () => { window.location.hash = '#team'; } }, ['Gérer mon équipe →']),
    ]);
  }

  // ── Widget : résumé de la dernière journée jouée ─────────────────────────
  function buildLastMatchWidget(manager) {
    const finished = window.LH3.services.seasonService.listMatches().filter((m) => m.status === 'termine');
    const last = finished[finished.length - 1];

    if (!last) {
      return el('div', { className: 'widget-card' }, [
        el('div', { className: 'widget-head' }, [el('span', { className: 'ic' }, ['📋']), 'Résumé de la dernière journée']),
        el('div', { className: 'muted small' }, ['Aucune journée jouée pour l\'instant.']),
      ]);
    }

    const breakdown = manager.predictionResults && manager.predictionResults[last.id];
    // Liste explicite plutôt qu'un filtre sur le nom des clés : "exactScore"
    // ne finit pas par "Correct" (contrairement aux 6 autres), un filtre par
    // motif le loupait silencieusement et sous-comptait de 1.
    const CRITERIA_KEYS = ['resultCorrect', 'exactScore', 'differenceCorrect', 'totalTriesCorrect', 'totalPointsCorrect', 'motmCorrect', 'blunderCorrect'];
    const correctCount = breakdown ? CRITERIA_KEYS.filter((k) => breakdown[k] === true).length : 0;

    return el('div', { className: 'widget-card' }, [
      el('div', { className: 'widget-head' }, [
        el('span', { className: 'ic' }, ['📋']), 'Résumé de la dernière journée',
        el('span', { className: 'see-all', onClick: () => { window.location.hash = '#calendar'; } }, ['Calendrier →']),
      ]),
      el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' } }, [
        el('div', {}, [
          el('div', { className: 'muted small' }, ['La Hulpe 3 vs ' + last.opponent]),
          el('div', { className: 'recap-score' }, [last.result.scoreFor + ' – ' + last.result.scoreAgainst]),
        ]),
        breakdown
          ? el('span', { className: 'badge ' + window.LH3.utils.format.peBadgeClass(breakdown.peEarned) }, [window.LH3.utils.format.formatSigned(breakdown.peEarned) + ' PE'])
          : el('span', { className: 'badge' }, ['Pas de pronostic']),
      ]),
      breakdown ? el('div', { className: 'muted small' }, [`Tu as vu juste sur ${correctCount} critère${correctCount > 1 ? 's' : ''} sur ${CRITERIA_KEYS.length}.`]) : null,
    ]);
  }

  // ── Widget : dernière actualité ──────────────────────────────────────────
  function buildJournalWidget() {
    const entries = window.LH3.services.journalService.listEntries().slice(0, 3);
    const wrap = el('div', { className: 'widget-card' }, [
      el('div', { className: 'widget-head' }, [
        el('span', { className: 'ic' }, ['📰']), 'Dernières actualités',
        el('span', { className: 'see-all', onClick: () => { window.location.hash = '#journal'; } }, ['Tout voir →']),
      ]),
    ]);
    if (!entries.length) {
      wrap.appendChild(el('div', { className: 'muted small' }, ['Le journal se remplira après la première journée jouée.']));
      return wrap;
    }
    const list = el('div', { className: 'journal-list' });
    entries.forEach((e) => {
      list.appendChild(el('div', { className: 'journal-entry kind-' + (e.kind || 'stat') }, [
        el('div', { className: 'journal-icon' }, [e.icon]),
        el('div', {}, [
          el('div', { className: 'journal-title' }, [e.title]),
          el('div', { className: 'journal-text' }, [e.text]),
        ]),
      ]));
    });
    wrap.appendChild(list);
    return wrap;
  }

  // ── Widget : mini classement ─────────────────────────────────────────────
  function buildLeaderboardWidget(manager) {
    const managers = window.LH3.services.managerService.listManagers()
      .slice()
      .sort((a, b) => (b.pe || 0) - (a.pe || 0))
      .slice(0, 5);

    return el('div', { className: 'widget-card' }, [
      el('div', { className: 'widget-head' }, [
        el('span', { className: 'ic' }, ['🏆']), 'Classement',
        el('span', { className: 'see-all', onClick: () => { window.location.hash = '#standings'; } }, ['Voir tout →']),
      ]),
      el('div', { className: 'mini-leaderboard' }, managers.map((m, i) => el('div', { className: 'mini-leaderboard-row' + (m.id === manager.id ? ' me' : '') }, [
        el('span', { className: 'rank-badge' + (i === 0 ? ' r1' : i === 1 ? ' r2' : i === 2 ? ' r3' : '') }, [String(i + 1)]),
        el('span', { className: 'name' }, [window.LH3.services.managerService.displayName(m)]),
        el('span', { className: 'pe' }, [(m.pe || 0) + ' PE']),
      ]))),
    ]);
  }

  function render(root) {
    const manager = window.LH3.services.managerService.getActiveManager();

    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['Salut, ' + window.LH3.services.managerService.displayName(manager) + ' 👋']),
      el('p', {}, ['Voici où en est ton aventure avec le club cette saison.']),
    ]));

    root.appendChild(buildHero(manager));
    root.appendChild(el('div', { style: { marginTop: '18px' } }, [buildStatTiles(manager)]));

    const grid = el('div', { className: 'dash-grid' }, [
      el('div', { className: 'span-2' }, [buildTeamWidget(manager)]),
      el('div', { className: 'span-2' }, [buildLastMatchWidget(manager)]),
      el('div', { className: 'span-2' }, [buildJournalWidget()]),
      el('div', { className: 'span-2' }, [buildLeaderboardWidget(manager)]),
    ]);
    root.appendChild(grid);

    (() => {
      const coachWrap = el('div');
      coachWrap.innerHTML = window.LH3.components.coachCard.render(manager.coach);
      root.appendChild(el('div', { className: 'section-title' }, ['🧢 Mon coach']));
      root.appendChild(coachWrap.firstElementChild);
    })();
  }

  window.LH3.pages.home = { render };
})();
