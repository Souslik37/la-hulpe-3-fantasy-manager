/**
 * La Hulpe 3 Fantasy Manager — Page Journal du Club
 *
 * Organisé par journée (le match + ses commentaires/rapports avant et
 * après), du plus récent au plus ancien — rien n'est jamais supprimé d'une
 * journée passée quand une nouvelle arrive, tout reste consultable en
 * scrollant. Les brèves sans journée précise (assiduité, événements du
 * club) vivent dans une section à part en bas.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.pages = window.LH3.pages || {};

  const { el } = window.LH3.utils.dom;

  function buildEntry(e) {
    return el('div', { className: 'journal-entry kind-' + (e.kind || 'stat') }, [
      el('div', { className: 'journal-icon' }, [e.icon]),
      el('div', {}, [
        el('div', { className: 'journal-title' }, [e.title]),
        el('div', { className: 'journal-text' }, [e.text]),
      ]),
    ]);
  }

  function buildCommentRow(c, managers) {
    const author = managers[c.managerId];
    return el('div', { className: 'journal-entry kind-fun' }, [
      el('div', { className: 'journal-icon' }, ['💬']),
      el('div', {}, [
        el('div', { className: 'journal-title' }, [author ? author.name : 'Un manager']),
        el('div', { className: 'journal-text' }, [c.text]),
      ]),
    ]);
  }

  function buildSubsection(title, entries, comments, managers) {
    if (!entries.length && !comments.length) return null;
    return el('div', { style: { marginTop: '10px' } }, [
      el('div', { className: 'muted small', style: { fontWeight: '750', textTransform: 'uppercase', fontSize: '11px', marginBottom: '6px' } }, [title]),
      el('div', { className: 'journal-list' }, [
        ...entries.map(buildEntry),
        ...comments.map((c) => buildCommentRow(c, managers)),
      ]),
    ]);
  }

  function render(root) {
    const allEntries = window.LH3.services.journalService.listEntries();
    const matches = window.LH3.services.seasonService.listMatches();
    const managers = window.LH3.services.stateService.getState().managers;

    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['📰 Journal du Club']),
      el('p', {}, ['Le récap de chaque journée, avant et après le match — pronostics, réactions, résultats. Rien n\'est jamais effacé.']),
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
      const preEntries = entries.filter((e) => e.generatorId === 'pre-match-report');
      const postEntries = entries.filter((e) => e.generatorId !== 'pre-match-report');
      const preComments = window.LH3.services.commentService.listComments(match.id, 'pre');
      const postComments = window.LH3.services.commentService.listComments(match.id, 'post');

      const card = el('div', { className: 'card', style: { marginBottom: '18px' } }, [
        el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' } }, [
          el('div', { style: { fontWeight: '800' } }, ['Journée ' + match.matchday + ' · La Hulpe 3 vs ' + match.opponent]),
          match.result
            ? el('span', { className: 'badge badge-green' }, [match.result.scoreFor + ' – ' + match.result.scoreAgainst])
            : el('span', { className: 'muted small' }, [window.LH3.utils.format.formatDateFr(match.date)]),
        ]),
        buildSubsection('📋 Avant-match', preEntries, preComments, managers),
        buildSubsection('🗣️ Après-match', postEntries, postComments, managers),
      ]);
      root.appendChild(card);
    });

    if (generalEntries.length) {
      root.appendChild(el('div', { className: 'section-title' }, ['🙌 Autres brèves du club']));
      const list = el('div', { className: 'journal-list' });
      generalEntries.forEach((e) => list.appendChild(buildEntry(e)));
      root.appendChild(list);
    }
  }

  window.LH3.pages.journal = { render };
})();
