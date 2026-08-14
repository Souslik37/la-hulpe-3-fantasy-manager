/**
 * La Hulpe 3 Fantasy Manager — Page Statistiques
 *
 * Statistiques concernant uniquement l'équipe du manager actif (pas de
 * communauté). Formes et couleurs suivent le skill dataviz : barres à
 * teinte unique pour les magnitudes, aucune mécanique de jeu modifiée ici —
 * uniquement de la lecture des données existantes.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.pages = window.LH3.pages || {};

  const { el, escapeHtml } = window.LH3.utils.dom;

  function buildBestPlayerCards(manager) {
    const playerService = window.LH3.services.playerService;
    const cards = playerService.getAllCards(manager);
    const best = cards.slice().sort((a, b) => b.overall - a.overall)[0];
    const mostImproved = cards.slice().sort((a, b) => (b.overall - 50) - (a.overall - 50))[0];

    return el('div', { className: 'dash-grid' }, [
      el('div', { className: 'span-2 widget-card' }, [
        el('div', { className: 'widget-head' }, [el('span', { className: 'ic' }, ['⭐']), 'Meilleur joueur de mon équipe']),
        el('div', { className: 'stat-highlight-card' }, [
          el('div', { className: 'ic' }, ['🏉']),
          el('div', {}, [
            el('div', { className: 'val' }, [best ? `${best.name} — ${best.overall}` : '—']),
            el('div', { className: 'lbl' }, [best ? window.LH3.utils.format.rarityLabel(best.rarity) : 'Aucun joueur']),
          ]),
        ]),
      ]),
      el('div', { className: 'span-2 widget-card' }, [
        el('div', { className: 'widget-head' }, [el('span', { className: 'ic' }, ['📈']), 'Meilleure progression']),
        el('div', { className: 'stat-highlight-card' }, [
          el('div', { className: 'ic' }, ['🚀']),
          el('div', {}, [
            el('div', { className: 'val' }, [mostImproved ? `${mostImproved.name} — +${mostImproved.overall - 50}` : '—']),
            el('div', { className: 'lbl' }, ['Points de note gagnés depuis le départ (base 50)']),
          ]),
        ]),
      ]),
    ]);
  }

  function buildAttributeDistribution(manager) {
    const playerService = window.LH3.services.playerService;
    const CONFIG = window.LH3.data.CONFIG;
    const cards = playerService.getAllCards(manager);

    const chart = el('div', { className: 'bar-chart' });
    CONFIG.attributes.forEach((a, i) => {
      const avg = cards.length ? Math.round(cards.reduce((sum, c) => sum + c.attributes[a.key], 0) / cards.length) : 0;
      chart.appendChild(el('div', { className: 'bar-chart-row', title: `${a.label} : ${avg}/100 en moyenne sur les ${cards.length} joueurs` }, [
        el('div', { className: 'bar-chart-label' }, [a.icon + ' ' + a.label]),
        el('div', { className: 'bar-chart-track' }, [
          el('div', { className: 'bar-chart-fill', style: { width: avg + '%', animationDelay: (i * 45) + 'ms' } }),
        ]),
        el('div', { className: 'bar-chart-value' }, [String(avg)]),
      ]));
    });

    return el('div', { className: 'card' }, [
      el('div', { className: 'widget-head' }, [el('span', { className: 'ic' }, ['🧬']), 'Répartition moyenne des attributs (' + cards.length + ' joueurs)']),
      chart,
    ]);
  }

  function buildHistoryChart(title, icon, history, key, formatValue) {
    if (!history.length) {
      return el('div', { className: 'card' }, [
        el('div', { className: 'widget-head' }, [el('span', { className: 'ic' }, [icon]), title]),
        el('div', { className: 'muted small' }, ['Pas encore de journée jouée — reviens après la première journée.']),
      ]);
    }
    const max = Math.max(...history.map((h) => h[key]), 1);
    const chart = el('div', { className: 'line-chart' });
    history.forEach((h, i) => {
      const pct = Math.max(4, Math.round((h[key] / max) * 100));
      chart.appendChild(el('div', { className: 'line-chart-col' }, [
        el('div', {
          className: 'line-chart-bar',
          title: `Journée ${h.matchday} : ${formatValue(h[key])}`,
          style: { height: pct + '%', animationDelay: (i * 50) + 'ms' },
        }),
        el('div', { className: 'line-chart-label' }, ['J' + h.matchday]),
      ]));
    });
    return el('div', { className: 'card' }, [
      el('div', { className: 'widget-head' }, [el('span', { className: 'ic' }, [icon]), title]),
      chart,
    ]);
  }

  function render(root) {
    const manager = window.LH3.services.managerService.getActiveManager();
    const history = manager.history || [];

    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['📊 Statistiques']),
      el('p', {}, ['Un coup d\'œil sur la construction de ton équipe et ta progression cette saison. Uniquement tes données à toi — pas encore de comparatif communautaire.']),
    ]));

    root.appendChild(buildBestPlayerCards(manager));
    root.appendChild(el('div', { className: 'section-title' }, ['🧬 Construction d\'équipe']));
    root.appendChild(buildAttributeDistribution(manager));

    root.appendChild(el('div', { className: 'section-title' }, ['📉 Évolution dans la saison']));
    const historyGrid = el('div', { className: 'dash-grid' }, [
      el('div', { className: 'span-2' }, [buildHistoryChart('Historique des PE', '✨', history, 'pe', (v) => v + ' PE')]),
      el('div', { className: 'span-2' }, [buildHistoryChart('Évolution de la note d\'équipe', '⭐', history, 'teamOverall', (v) => v + ' overall')]),
    ]);
    root.appendChild(historyGrid);
  }

  window.LH3.pages.statistics = { render };
})();
