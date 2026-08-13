/**
 * La Hulpe 3 Fantasy Manager — Recherche d'accent par nationalité
 *
 * Champ texte + suggestions cliquables, branché sur
 * managerService.searchAccents (voir data/accents.js pour le contenu).
 * Purement une aide au remplissage : le champ Accent reste un texte libre,
 * cliquer une suggestion ne fait que le pré-remplir.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.components = window.LH3.components || {};

  const { el } = window.LH3.utils.dom;

  /** opts: { onPick(line) } */
  function render(opts) {
    const results = el('div', { className: 'toolbar', style: { marginTop: '8px', marginBottom: '0' } });

    const input = el('input', {
      type: 'text',
      placeholder: 'Cherche une nationalité... (ex : libanais, brésilien, coréen)',
      onInput: (e) => {
        const query = e.target.value;
        results.innerHTML = '';
        if (!query.trim()) return;
        const matches = window.LH3.services.managerService.searchAccents(query);
        if (!matches.length) {
          results.appendChild(el('div', { className: 'muted small' }, ['Aucun résultat — essaie un autre mot, ou pioche au hasard ci-dessous.']));
          return;
        }
        matches.forEach((m) => {
          results.appendChild(el('div', {
            className: 'chip',
            onClick: () => opts.onPick(m.line),
          }, [m.line]));
        });
      },
    });

    return el('div', { className: 'field' }, [
      el('label', {}, ['Chercher une nationalité pour l\'accent']),
      input,
      results,
    ]);
  }

  window.LH3.components.accentSearch = { render };
})();
