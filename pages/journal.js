/**
 * La Hulpe 3 Fantasy Manager — Page Journal du Club
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.pages = window.LH3.pages || {};

  const { el } = window.LH3.utils.dom;

  const KIND_LABELS = {
    award: '🏆 Récompense',
    stat: '🔢 Statistique',
    fun: '🎉 Anecdote',
    progress: '📈 Progression',
  };

  let activeFilter = null;

  function render(root) {
    const allEntries = window.LH3.services.journalService.listEntries();

    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['📰 Journal du Club']),
      el('p', {}, ['Généré automatiquement après chaque journée : pronostiqueurs en forme, scores exacts, progressions, capitaines fétiches et quelques surprises.']),
    ]));

    if (!allEntries.length) {
      root.appendChild(el('div', { className: 'empty-state' }, [
        el('div', { className: 'ic' }, ['📰']),
        el('div', {}, ['Rien à raconter pour l\'instant — reviens après la première journée jouée.']),
      ]));
      return;
    }

    const kinds = Array.from(new Set(allEntries.map((e) => e.kind || 'stat')));
    const toolbar = el('div', { className: 'toolbar' }, kinds.map((k) => el('div', {
      className: 'chip' + (activeFilter === k ? ' active' : ''),
      onClick: () => { activeFilter = activeFilter === k ? null : k; render(root); },
    }, [KIND_LABELS[k] || k])));
    root.appendChild(toolbar);

    const entries = activeFilter ? allEntries.filter((e) => (e.kind || 'stat') === activeFilter) : allEntries;

    const byMatchday = {};
    entries.forEach((e) => {
      byMatchday[e.matchday] = byMatchday[e.matchday] || [];
      byMatchday[e.matchday].push(e);
    });
    const matchdays = Object.keys(byMatchday).map(Number).sort((a, b) => b - a);

    matchdays.forEach((md) => {
      root.appendChild(el('div', { className: 'section-title' }, ['Journée ' + md]));
      const list = el('div', { className: 'journal-list' });
      byMatchday[md].forEach((e, i) => {
        const entry = el('div', { className: 'journal-entry kind-' + (e.kind || 'stat'), style: { animationDelay: (i * 40) + 'ms' } }, [
          el('div', { className: 'journal-icon' }, [e.icon]),
          el('div', {}, [
            el('div', { className: 'journal-title' }, [e.title]),
            el('div', { className: 'journal-text' }, [e.text]),
            el('div', { className: 'journal-meta' }, [window.LH3.utils.format.formatDateFr(e.date)]),
          ]),
        ]);
        list.appendChild(entry);
      });
      root.appendChild(list);
    });
  }

  window.LH3.pages.journal = { render };
})();
