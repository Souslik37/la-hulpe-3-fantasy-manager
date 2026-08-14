/**
 * La Hulpe 3 Fantasy Manager — Rapport de match (affichage riche)
 *
 * Ouvre un modal détaillé pour une entrée de journal générée par
 * journalService.generatePreMatchReport / generatePostMatchComments — ces
 * deux-là seules portent un `payload` structuré (voir journalService.js) ;
 * les 7 brèves stats/récompenses auto restent de simples one-liners et
 * n'ouvrent rien. Si jamais une entrée sans payload arrive ici quand même
 * (cache client ancien), on retombe sur son `text` brut.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.components = window.LH3.components || {};

  const { el } = window.LH3.utils.dom;

  function stat(value, label) {
    if (value === null || value === undefined) return null;
    return el('div', { className: 'report-stat' }, [
      el('div', { className: 'val' }, [String(value)]),
      el('div', { className: 'lbl' }, [label]),
    ]);
  }

  function consensusBar(split) {
    const seg = (key, cls, label) => {
      const pct = split[key] || 0;
      if (!pct) return null;
      return el('div', { className: 'consensus-seg ' + cls, style: { width: pct + '%' } }, [pct >= 12 ? pct + '%' : '']);
    };
    return el('div', {}, [
      el('div', { className: 'consensus-bar' }, [seg('V', 'v'), seg('N', 'n'), seg('D', 'd')]),
      el('div', { className: 'consensus-legend' }, [
        el('span', {}, [el('span', { className: 'dot', style: { background: 'var(--green)' } }), 'Victoire ' + (split.V || 0) + '%']),
        el('span', {}, [el('span', { className: 'dot', style: { background: 'var(--text-3)' } }), 'Nul ' + (split.N || 0) + '%']),
        el('span', {}, [el('span', { className: 'dot', style: { background: 'var(--red)' } }), 'Défaite ' + (split.D || 0) + '%']),
      ]),
    ]);
  }

  function quoteCard(c) {
    return el('div', { className: 'report-quote' }, [
      el('div', { className: 'report-quote-text' }, ['"' + c.text + '"']),
      el('div', { className: 'report-quote-author' }, ['— ' + c.author]),
    ]);
  }

  function commentsBlock(comments, title) {
    if (!comments || !comments.length) return null;
    return el('div', {}, [
      el('div', { className: 'report-section-title' }, [title]),
      ...comments.map(quoteCard),
    ]);
  }

  function renderPreMatch(p) {
    const hasStats = p.predictionsCount > 0;
    return el('div', {}, [
      el('div', { className: 'report-hero tone-preview' }, [
        el('div', { className: 'report-hero-label' }, ['Avant-match']),
        el('div', { className: 'report-hero-opponent' }, ['La Hulpe 3 vs ' + p.opponent]),
        el('div', { className: 'report-hero-sub' }, [
          hasStats ? p.predictionsCount + ' pronostic' + (p.predictionsCount > 1 ? 's' : '') + ' déjà en jeu' : 'Les pronostics arrivent...',
        ]),
      ]),
      hasStats ? el('div', {}, [
        el('div', { className: 'report-stats-grid' }, [
          stat(p.avgTotalTries !== null && p.avgTotalTries !== undefined ? p.avgTotalTries : '—', 'Essais prédits (moy.)'),
          stat(p.avgTotalPoints, 'Points prédits (moy.)'),
          stat(p.maxTotalPoints, 'Score total le + fou'),
        ].filter(Boolean)),
        el('div', { className: 'report-section-title' }, ['🗳️ Qui mise quoi']),
        consensusBar(p.resultSplit || {}),
        p.topScorers && p.topScorers.length ? el('div', {}, [
          el('div', { className: 'report-section-title' }, ['🎯 Marqueurs les plus attendus']),
          el('div', { className: 'report-badge-row' }, p.topScorers.map((s) => el('span', { className: 'badge badge-green' }, [s.name + ' · ' + s.count]))),
        ]) : null,
        p.boldestPredictor ? el('div', { className: 'report-callout' }, [
          '🔮 Le plus optimiste (ou téméraire) : ', el('b', {}, [p.boldestPredictor]), ' voit ça finir ' + p.boldestScore + '.',
        ]) : null,
      ]) : null,
      commentsBlock(p.comments, '💬 Dans les couloirs du club'),
    ].filter(Boolean));
  }

  function renderPostMatch(p) {
    const diff = Math.abs(p.scoreFor - p.scoreAgainst);
    const tone = p.scoreFor > p.scoreAgainst ? 'victoire' : p.scoreFor < p.scoreAgainst ? 'defaite' : 'nul';
    const resultLabel = tone === 'victoire' ? '🎉 Victoire' : tone === 'defaite' ? 'Défaite' : 'Match nul';

    return el('div', {}, [
      el('div', { className: 'report-hero tone-' + tone }, [
        el('div', { className: 'report-hero-label' }, ['Après-match · ' + resultLabel]),
        el('div', { className: 'report-hero-opponent' }, ['La Hulpe 3 vs ' + p.opponent]),
        el('div', { className: 'report-hero-score' }, [p.scoreFor + ' – ' + p.scoreAgainst]),
        p.gradedCount ? el('div', { className: 'report-hero-sub' }, [p.resultCorrectCount + '/' + p.gradedCount + ' managers avaient deviné le bon résultat (' + p.resultCorrectPct + '%)']) : null,
      ]),
      el('div', { className: 'report-stats-grid' }, [
        stat(p.totalTries !== null && p.totalTries !== undefined ? p.totalTries : '—', 'Essais marqués'),
        stat(p.totalPoints, 'Points au total'),
        stat(diff, 'Écart final'),
      ]),
      (p.manOfMatch || p.blunder) ? el('div', { className: 'report-badge-row' }, [
        p.manOfMatch ? el('span', { className: 'badge badge-yellow' }, ['⭐ Homme du match : ' + p.manOfMatch]) : null,
        p.blunder ? el('span', { className: 'badge badge-red' }, ['🫠 Boulette : ' + p.blunder]) : null,
      ].filter(Boolean)) : null,
      p.exactScoreWinners && p.exactScoreWinners.length ? el('div', { className: 'report-callout' }, [
        '🎯 Score exact trouvé par ', el('b', {}, [p.exactScoreWinners.join(', ')]), ' — respect.',
      ]) : null,
      commentsBlock(p.comments, '🗣️ Les réactions du club'),
    ].filter(Boolean));
  }

  function open(entry) {
    if (!entry.payload) {
      window.LH3.components.modal.open({
        title: (entry.icon || '📰') + ' ' + entry.title,
        body: el('div', { className: 'small' }, [entry.text]),
        actions: [{ label: 'Fermer', className: 'btn-primary' }],
      });
      return;
    }
    const body = entry.payload.type === 'post-match' ? renderPostMatch(entry.payload) : renderPreMatch(entry.payload);
    window.LH3.components.modal.open({
      title: 'Journée ' + (entry.matchday || ''),
      body,
      actions: [{ label: 'Fermer', className: 'btn-primary' }],
    });
  }

  window.LH3.components.matchReport = { open };
})();
