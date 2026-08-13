/**
 * La Hulpe 3 Fantasy Manager — Page Tous les joueurs
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.pages = window.LH3.pages || {};

  const { el } = window.LH3.utils.dom;

  let rarityFilter = null;
  let sortBy = 'overall';
  let search = '';

  function showDetail(manager, playerId) {
    const card = window.LH3.services.playerService.getCard(manager, playerId);
    const CONFIG = window.LH3.data.CONFIG;
    const body = el('div', {}, [
      el('div', { style: { textAlign: 'center', marginBottom: '16px' } }, [
        (() => { const w = el('div'); w.innerHTML = window.LH3.utils.avatar.renderAvatar(card.name, card.avatarUrl, 72); return w.firstElementChild; })(),
        el('div', { style: { fontWeight: '800', fontSize: '16px', marginTop: '10px' } }, [card.name]),
        el('div', { className: 'badge badge-green', style: { marginTop: '6px' } }, [card.overall + ' overall · ' + window.LH3.utils.format.rarityLabel(card.rarity)]),
      ]),
      el('div', {}, CONFIG.attributes.map((a) => el('div', { className: 'boost-row' }, [
        el('div', { className: 'boost-label' }, [a.icon + ' ' + a.label]),
        el('div', { style: { fontWeight: '800' } }, [String(card.attributes[a.key])]),
      ]))),
    ]);
    window.LH3.components.modal.open({ title: 'Fiche joueur', body, actions: [{ label: 'Fermer', className: 'btn-primary' }] });
  }

  function render(root) {
    const manager = window.LH3.services.managerService.getActiveManager();
    const CONFIG = window.LH3.data.CONFIG;

    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['Tous les joueurs']),
      el('p', {}, ['Le roster complet du club, avec tes propres boosts appliqués.']),
    ]));

    const searchInput = el('input', {
      type: 'text', placeholder: '🔎 Rechercher un joueur…', value: search,
      style: { maxWidth: '260px' },
      onInput: (e) => { search = e.target.value; renderGrid(); },
    });

    const sortSelect = el('select', {
      onChange: (e) => { sortBy = e.target.value; renderGrid(); },
    }, [
      el('option', { value: 'overall' }, ['Trier par note']),
      el('option', { value: 'name' }, ['Trier par nom']),
    ]);
    sortSelect.value = sortBy;

    const toolbar = el('div', { className: 'toolbar' }, [
      searchInput, sortSelect,
      ...['bronze', 'argent', 'or', 'diamant', 'legende'].map((key) => el('div', {
        className: 'chip' + (rarityFilter === key ? ' active' : ''),
        onClick: () => { rarityFilter = rarityFilter === key ? null : key; renderGrid(); },
      }, [window.LH3.utils.format.rarityLabel(key)])),
    ]);
    root.appendChild(toolbar);

    const gridWrap = el('div', { className: 'players-grid' });
    root.appendChild(gridWrap);

    function renderGrid() {
      gridWrap.innerHTML = '';
      let cards = window.LH3.services.playerService.getAllCards(manager);
      if (rarityFilter) cards = cards.filter((c) => c.rarity === rarityFilter);
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        cards = cards.filter((c) => c.name.toLowerCase().includes(q));
      }
      cards.sort((a, b) => sortBy === 'name' ? a.name.localeCompare(b.name) : b.overall - a.overall);

      if (!cards.length) {
        gridWrap.appendChild(el('div', { className: 'empty-state' }, [
          el('div', { className: 'ic' }, ['🔍']),
          el('div', {}, ['Aucun joueur ne correspond à ces filtres.']),
        ]));
        return;
      }

      cards.forEach((card) => {
        const wrap = el('div', { onClick: () => showDetail(manager, card.id) });
        wrap.innerHTML = window.LH3.components.playerCard.render(card, { captain: manager.squad.captainId === card.id });
        gridWrap.appendChild(wrap);
      });
    }

    renderGrid();
  }

  // Enregistré sous la clé de route "players" (voir NAV_ITEMS dans components/navbar.js).
  window.LH3.pages.players = { render };
})();
