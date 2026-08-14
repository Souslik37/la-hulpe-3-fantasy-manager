/**
 * La Hulpe 3 Fantasy Manager — Commentaires avant/après-match (partagé)
 *
 * Utilisé en modal (page Calendrier) et inline (bas de la page Pronostics)
 * — même source de données des deux côtés (commentService), donc ce qui
 * est écrit d'un endroit apparaît immédiatement dans l'autre.
 *
 * Le commentaire "après-match" reste verrouillé tant que l'admin n'a pas
 * encodé le résultat officiel (match.status !== 'termine') — pas la peine
 * de réagir à un match qui, techniquement, n'est pas encore joué.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.components = window.LH3.components || {};

  const { el } = window.LH3.utils.dom;

  function buildSection(match, manager, opts) {
    const list = el('div', { style: { marginBottom: '10px' } });

    function refresh() {
      list.innerHTML = '';
      const comments = window.LH3.services.commentService.listComments(match.id, opts.phase);
      if (!comments.length) {
        list.appendChild(el('div', { className: 'muted small' }, ['Aucun commentaire pour l\'instant.']));
        return;
      }
      comments.forEach((c) => {
        const author = window.LH3.services.managerService.getManager(c.managerId);
        list.appendChild(el('div', { className: 'boost-row' }, [
          el('div', {}, [
            el('div', { style: { fontWeight: '700', fontSize: '12.5px' } }, [author ? author.name : 'Un manager']),
            el('div', { className: 'small' }, [c.text]),
          ]),
          c.managerId === manager.id ? el('button', {
            className: 'btn btn-sm btn-ghost', title: 'Retirer',
            onClick: async () => { await window.LH3.services.commentService.removeComment(c.id); refresh(); },
          }, ['✕']) : null,
        ]));
      });
    }
    refresh();

    const footer = opts.locked
      ? el('div', { className: 'muted small' }, ['🔒 ' + opts.lockedReason])
      : (() => {
          const input = el('textarea', { placeholder: opts.placeholder, rows: 2 });
          const sendBtn = el('button', {
            className: 'btn btn-sm',
            onClick: async () => {
              const res = await window.LH3.services.commentService.addComment(match.id, opts.phase, input.value);
              if (!res.ok) { window.LH3.components.toast.show(res.reason, 'error'); return; }
              input.value = '';
              refresh();
            },
          }, ['Envoyer']);
          return el('div', { style: { display: 'flex', gap: '8px', alignItems: 'flex-start' } }, [input, sendBtn]);
        })();

    return el('div', { style: { marginBottom: '18px' } }, [
      el('div', { className: 'muted small', style: { marginBottom: '6px', fontWeight: '750', textTransform: 'uppercase', fontSize: '11px' } }, [opts.title]),
      list,
      footer,
    ]);
  }

  function render(match, manager) {
    const postLocked = match.status !== 'termine';
    return el('div', {}, [
      buildSection(match, manager, { phase: 'pre', title: '📋 Avant-match', placeholder: 'Un petit mot avant le match... (facultatif)', locked: false }),
      buildSection(match, manager, {
        phase: 'post', title: '🗣️ Après-match', placeholder: 'Une réaction après le match... (facultatif)',
        locked: postLocked, lockedReason: 'Disponible une fois le résultat officiel encodé par l\'admin.',
      }),
    ]);
  }

  window.LH3.components.matchComments = { render };
})();
