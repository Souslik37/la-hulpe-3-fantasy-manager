/**
 * La Hulpe 3 Fantasy Manager — Page Journal du Club
 *
 * Organisé par journée (le match + ses commentaires et brèves), du plus
 * récent au plus ancien — rien n'est jamais supprimé d'une journée passée
 * quand une nouvelle arrive, tout reste consultable en scrollant.
 *
 * Deux sections par journée, volontairement séparées :
 *  - 💬 Commentaires : le fil brut, spontané, ce que chacun poste (pré et
 *    post-match mélangés, l'ordre chronologique suffit à les distinguer).
 *  - 📰 Dépêche du jour : tout ce qui est généré (les 7 brèves stats/
 *    récompenses auto après un résultat encodé, + les rapports "avant" et
 *    "après" déclenchés par l'admin) — le contenu "officiel" du club.
 *
 * Les brèves sans journée précise (assiduité, événements du club) vivent
 * dans une section à part en bas.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.pages = window.LH3.pages || {};

  const { el } = window.LH3.utils.dom;

  function buildEntry(e, isAdmin, rerender) {
    const hasReport = !!e.payload;
    return el('div', {
      className: 'journal-entry kind-' + (e.kind || 'stat') + (hasReport ? ' clickable' : ''),
      onClick: hasReport ? () => window.LH3.components.matchReport.open(e) : null,
    }, [
      el('div', { className: 'journal-icon' }, [e.icon]),
      el('div', { style: { flex: '1' } }, [
        el('div', { className: 'journal-title' }, [e.title]),
        el('div', { className: 'journal-text' }, [e.text]),
        hasReport ? el('div', { className: 'journal-more' }, ['Voir le rapport complet →']) : null,
      ]),
      isAdmin ? el('button', {
        className: 'btn btn-sm btn-ghost', title: 'Supprimer cette brève',
        onClick: async (ev) => {
          ev.stopPropagation();
          const res = await window.LH3.services.journalService.removeEntry(e.id);
          if (!res.ok) window.LH3.components.toast.show(res.reason, 'error');
          else rerender();
        },
      }, ['✕']) : null,
    ]);
  }

  function buildCommentRow(c) {
    const managers = window.LH3.services.stateService.getState().managers;
    const author = managers[c.managerId];
    return el('div', { className: 'journal-entry kind-fun' }, [
      el('div', { className: 'journal-icon' }, [c.phase === 'post' ? '🗣️' : '📋']),
      el('div', {}, [
        el('div', { className: 'journal-title' }, [author ? window.LH3.services.managerService.displayName(author) : 'Un manager']),
        el('div', { className: 'journal-text' }, [c.text]),
      ]),
    ]);
  }

  function buildSection(title, emptyHint, nodes) {
    return el('div', { style: { marginTop: '10px' } }, [
      el('div', { className: 'muted small', style: { fontWeight: '750', textTransform: 'uppercase', fontSize: '11px', marginBottom: '6px' } }, [title]),
      nodes.length
        ? el('div', { className: 'journal-list' }, nodes)
        : el('div', { className: 'muted small' }, [emptyHint]),
    ]);
  }

  function render(root) {
    const manager = window.LH3.services.managerService.getActiveManager();
    const isAdmin = manager.role === 'admin';
    const rerender = () => render(document.getElementById('page-root'));

    const allEntries = window.LH3.services.journalService.listEntries();
    const matches = window.LH3.services.seasonService.listMatches();

    const infoPopover = el('div', { className: 'info-popover hidden' }, [
      'Chaque journée a deux sections : ',
      el('b', {}, ['📰 Dépêche du jour']), ' — ce que le club génère automatiquement (stats, récompenses, rapports avant/après déclenchés par l\'admin), cliquable pour un rapport complet — et ',
      el('b', {}, ['💬 Commentaires']), ' — le fil libre de tout le monde, avant et après le match. Rien n\'est jamais supprimé d\'une journée passée.',
    ]);
    const infoIcon = el('span', { className: 'info-hint', onClick: (e) => { e.stopPropagation(); infoPopover.classList.toggle('hidden'); } }, ['ⓘ']);

    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['📰 Journal du Club ', el('span', { className: 'info-hint-wrap' }, [infoIcon, infoPopover])]),
      el('p', {}, ['Le récap de chaque journée — les commentaires de tout le monde d\'un côté, la dépêche officielle de l\'autre. Rien n\'est jamais effacé.']),
    ]));

    const byMatchday = {};
    const generalEntries = [];
    allEntries.forEach((e) => {
      if (e.matchday === null || e.matchday === undefined) { generalEntries.push(e); return; }
      byMatchday[e.matchday] = byMatchday[e.matchday] || [];
      byMatchday[e.matchday].push(e);
    });

    const matchdaysWithContent = matches
      .filter((m) => (byMatchday[m.matchday] && byMatchday[m.matchday].length) || window.LH3.services.commentService.listComments(m.id).length)
      .sort((a, b) => b.matchday - a.matchday);

    if (!matchdaysWithContent.length && !generalEntries.length) {
      root.appendChild(el('div', { className: 'empty-state' }, [
        el('div', { className: 'ic' }, ['📰']),
        el('div', {}, ['Rien à raconter pour l\'instant — reviens après la première journée jouée.']),
      ]));
      return;
    }

    matchdaysWithContent.forEach((match) => {
      const entries = (byMatchday[match.matchday] || []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const comments = window.LH3.services.commentService.listComments(match.id);

      const card = el('div', { className: 'card', style: { marginBottom: '18px' } }, [
        el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' } }, [
          el('div', { style: { fontWeight: '800' } }, ['Journée ' + match.matchday + ' · La Hulpe 3 vs ' + match.opponent]),
          match.result
            ? el('span', { className: 'badge badge-green' }, [match.result.scoreFor + ' – ' + match.result.scoreAgainst])
            : el('span', { className: 'muted small' }, [window.LH3.utils.format.formatDateFr(match.date)]),
        ]),
        buildSection('📰 Dépêche du jour', 'Rien publié pour l\'instant.', entries.map((e) => buildEntry(e, isAdmin, rerender))),
        buildSection('💬 Commentaires', 'Aucun commentaire pour l\'instant.', comments.map(buildCommentRow)),
      ]);
      root.appendChild(card);
    });

    if (generalEntries.length) {
      root.appendChild(el('div', { className: 'section-title' }, ['🙌 Autres brèves du club']));
      const list = el('div', { className: 'journal-list' });
      generalEntries.forEach((e) => list.appendChild(buildEntry(e, isAdmin, rerender)));
      root.appendChild(list);
    }
  }

  window.LH3.pages.journal = { render };
})();
