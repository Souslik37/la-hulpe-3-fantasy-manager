/**
 * La Hulpe 3 Fantasy Manager — Page Calendrier
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.pages = window.LH3.pages || {};

  const { el, escapeHtml } = window.LH3.utils.dom;

  function showRecap(match, manager) {
    const { formatSigned, peBadgeClass } = window.LH3.utils.format;
    const CONFIG = window.LH3.data.CONFIG;
    const breakdown = manager.predictionResults && manager.predictionResults[match.id];
    const prediction = window.LH3.services.predictionService.getPrediction(manager, match.id);
    const getPlayerName = (id) => { const p = window.LH3.services.playerService.getPlayerBase(id); return p ? p.name : '—'; };

    const hasPrediction = prediction.scoreFor !== null;
    // Chaque ligne montre son propre gain (pas seulement le total en bas) —
    // un petit texte grisé à côté de "Deviné", jamais affiché pour un raté
    // puisque ces critères-là n'ont pas de pénalité individuelle.
    function criterionValue(correct, peValue) {
      if (!correct) return '❌ Raté';
      return el('span', {}, ['✅ Deviné ', el('span', { className: 'muted small' }, ['+' + peValue + ' PE'])]);
    }
    const rows = hasPrediction ? [
      ['Ton pronostic', `${prediction.scoreFor} – ${prediction.scoreAgainst}`],
      ['Résultat', criterionValue(breakdown && breakdown.resultCorrect, CONFIG.pe.correctResult)],
      ['Score exact', criterionValue(breakdown && breakdown.exactScore, CONFIG.pe.exactScore)],
      ['Écart de points', criterionValue(breakdown && breakdown.differenceCorrect, CONFIG.pe.correctDifference)],
      ['Total essais', criterionValue(breakdown && breakdown.totalTriesCorrect, CONFIG.pe.correctTotalTries)],
      ['Total points', criterionValue(breakdown && breakdown.totalPointsCorrect, CONFIG.pe.correctTotalPoints)],
      ['Homme du match', criterionValue(breakdown && breakdown.motmCorrect, CONFIG.pe.correctManOfMatch)],
      ['Boulette du match', criterionValue(breakdown && breakdown.blunderCorrect, CONFIG.pe.correctBlunderOfMatch)],
    ] : [];

    // Détail marqueur par marqueur (plutôt qu'un simple "X / Y") : chaque nom
    // coché rapporte ou coûte des PE indépendamment, on montre lequel fait quoi.
    const scorerRows = hasPrediction && breakdown ? prediction.tryScorers.map((id) => {
      const correct = breakdown.correctScorers.includes(id);
      return [getPlayerName(id), correct ? '✅ +' + CONFIG.pe.perCorrectTryScorer + ' PE' : '❌ ' + CONFIG.pe.perWrongTryScorer + ' PE'];
    }) : [];

    const body = el('div', {}, [
      el('div', { style: { textAlign: 'center', marginBottom: '14px' } }, [
        el('div', { style: { fontSize: '13px', color: 'var(--text-2)' } }, ['La Hulpe 3 vs ' + match.opponent]),
        el('div', { style: { fontSize: '30px', fontWeight: '900' } }, [match.result.scoreFor + ' – ' + match.result.scoreAgainst]),
        match.result.manOfMatchId ? el('div', { className: 'badge badge-yellow', style: { marginTop: '8px' } }, ['⭐ Homme du match : ' + escapeHtml(getPlayerName(match.result.manOfMatchId))]) : null,
      ]),
      !hasPrediction
        ? el('div', { className: 'muted small center' }, ['Tu n\'avais pas soumis de pronostic pour cette journée.'])
        : el('div', {}, rows.map(([label, value]) => el('div', { className: 'boost-row' }, [
            el('div', { className: 'boost-label' }, [label]),
            el('div', {}, [value]),
          ]))),
      scorerRows.length ? el('div', { style: { marginTop: '10px' } }, [
        el('div', { className: 'muted small', style: { marginBottom: '4px' } }, ['Marqueurs pronostiqués']),
        ...scorerRows.map(([name, tag]) => el('div', { className: 'boost-row' }, [
          el('div', { className: 'boost-label' }, [name]),
          el('div', {}, [tag]),
        ])),
      ]) : null,
      breakdown ? el('div', { className: 'badge ' + peBadgeClass(breakdown.peEarned), style: { marginTop: '14px', display: 'block', textAlign: 'center', padding: '10px' } }, [formatSigned(breakdown.peEarned) + ' PE sur cette journée']) : null,
    ]);

    window.LH3.components.modal.open({ title: 'Récap · Journée ' + match.matchday, body, actions: [{ label: 'Fermer', className: 'btn-primary' }] });
  }

  // ── Bonus d'assiduité (carte + récap en lecture seule, pour tout le monde
  // y compris l'admin — l'évaluation elle-même se fait depuis Administration,
  // même séparation que pour les résultats de match) ─────────────────────
  function renderPresenceCard(period) {
    const evaluated = Object.keys(period.ratings || {}).length > 0;
    const cls = evaluated ? 'termine' : 'verrouille';
    const label = evaluated ? '✅ Distribué' : '🔜 À venir';
    return `
      <div class="matchday-card">
        <div class="md-num">🙌 Assiduité</div>
        <div class="md-opp">${escapeHtml(period.label)}</div>
        <div class="md-date">${window.LH3.utils.format.formatDateFr(period.date)}</div>
        <div class="badge" style="margin-top:10px">
          <span class="status-dot ${cls}"></span>${label}
        </div>
      </div>`;
  }

  function showPresenceRecap(period, manager) {
    const { formatSigned, peBadgeClass } = window.LH3.utils.format;
    const rating = window.LH3.services.presenceService.ratingForManager(period, manager.id);
    const tier = rating ? window.LH3.services.presenceService.tierInfo(rating.tier) : null;

    const body = el('div', {}, [
      el('div', { style: { textAlign: 'center', marginBottom: '14px' } }, [
        el('div', { style: { fontSize: '13px', color: 'var(--text-2)' } }, ['Bonus d\'assiduité']),
        el('div', { style: { fontSize: '20px', fontWeight: '800', marginTop: '4px' } }, [period.label]),
        el('div', { className: 'muted small', style: { marginTop: '4px' } }, [window.LH3.utils.format.formatDateFr(period.date)]),
      ]),
      !rating
        ? el('div', { className: 'muted small center' }, ['Pas encore distribué pour cette période — repasse plus tard.'])
        : el('div', {}, [
            el('div', { className: 'boost-row' }, [
              el('div', { className: 'boost-label' }, ['Ton niveau d\'assiduité']),
              el('div', {}, [tier ? tier.label : '—']),
            ]),
            el('div', { className: 'badge ' + peBadgeClass(rating.pe), style: { marginTop: '14px', display: 'block', textAlign: 'center', padding: '10px' } }, [formatSigned(rating.pe) + ' PE']),
          ]),
    ]);

    window.LH3.components.modal.open({ title: 'Récap · ' + period.label, body, actions: [{ label: 'Fermer', className: 'btn-primary' }] });
  }

  function render(root) {
    const manager = window.LH3.services.managerService.getActiveManager();
    const matches = window.LH3.services.seasonService.listMatches();
    const periods = window.LH3.services.presenceService.listPeriods();

    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['Calendrier']),
      el('p', {}, ['18 journées de saison + les bonus d\'assiduité. Clique une journée ouverte pour pronostiquer, une journée terminée ou un bonus pour voir le récap.']),
    ]));

    const items = [
      ...matches.map((m) => ({ type: 'match', date: m.date, data: m })),
      ...periods.map((p) => ({ type: 'presence', date: p.date, data: p })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    const grid = el('div', { className: 'matchday-grid' });
    items.forEach((item) => {
      let wrap;
      if (item.type === 'match') {
        const match = item.data;
        wrap = el('div', {
          onClick: () => {
            if (match.status === 'ouvert') window.location.hash = '#predictions';
            else if (match.status === 'termine') showRecap(match, manager);
            else window.LH3.components.toast.show('Cette journée n\'est pas encore ouverte aux pronostics.');
          },
        });
        wrap.innerHTML = window.LH3.components.matchdayCard.render(match);
      } else {
        const period = item.data;
        wrap = el('div', { onClick: () => showPresenceRecap(period, manager) });
        wrap.innerHTML = renderPresenceCard(period);
      }
      grid.appendChild(wrap);
    });
    root.appendChild(grid);
  }

  window.LH3.pages.calendar = { render };
})();
