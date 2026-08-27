/**
 * La Hulpe 3 Fantasy Manager — Terrain de composition (partagé)
 *
 * Rendu du XV de départ + banc pour UN manager donné. Utilisé en mode
 * interactif par pages/myTeam.js (sélection/échange, capitaine) et en mode
 * lecture seule par pages/community.js (voir la composition d'un autre
 * manager). Les postes viennent de data/positions.js — jamais dupliqués.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.components = window.LH3.components || {};

  const { el } = window.LH3.utils.dom;

  /** Détail complet d'un joueur (rareté, overall, les 10 attributs) — même carte que "Tous les joueurs"/"Attributs". */
  function openPlayerDetail(card) {
    const wrap = el('div', { style: { display: 'flex', justifyContent: 'center' } });
    wrap.innerHTML = window.LH3.components.playerCard.render(card, { attrCount: 10 });
    window.LH3.components.modal.open({
      title: card.name,
      body: wrap,
      actions: [{ label: 'Fermer', className: 'btn-primary' }],
    });
  }

  /**
   * opts:
   *  - readOnly (bool, défaut false)
   *  - selectedId (id du joueur actuellement sélectionné pour échange, mode interactif seulement)
   *  - onSlotClick(playerId) (mode interactif seulement)
   */
  function buildSlot(manager, playerId, posLabel, opts) {
    opts = opts || {};
    const isSelected = !opts.readOnly && opts.selectedId === playerId;
    const roles = playerId ? window.LH3.services.managerService.rolesFor(manager, playerId) : [];
    const card = playerId ? window.LH3.services.playerService.getCard(manager, playerId) : null;

    const badge = el('div', {
      className: 'pitch-slot-badge',
      style: card ? { background: window.LH3.utils.avatar.colorFromString(card.name), borderStyle: 'solid' } : {},
    }, [card ? '' : '+']);

    if (card) {
      badge.innerHTML = window.LH3.utils.avatar.renderAvatar(card.name, card.avatarUrl, 52);
    }

    const slot = el('div', {
      className: 'pitch-slot' + (playerId ? ' filled' : '') + (isSelected ? ' target' : '') + (opts.readOnly ? ' readonly' : ''),
      onClick: opts.readOnly ? null : () => opts.onSlotClick && opts.onSlotClick(playerId),
    }, [
      badge,
      el('div', { className: 'pitch-slot-pos' }, [posLabel]),
      el('div', { className: 'pitch-slot-name' }, [card ? card.name : '—']),
    ]);

    if (roles.length) {
      badge.appendChild(el('span', { className: 'mini-captain' }, [roles.join('·')]));
    }

    if (card) {
      badge.appendChild(el('span', {
        className: 'pitch-slot-overall rarity-' + card.rarity,
        title: 'Voir le détail de ' + card.name,
        onClick: (e) => { e.stopPropagation(); openPlayerDetail(card); },
      }, [String(card.overall)]));
    }

    return slot;
  }

  function renderPitch(manager, opts) {
    const pitch = el('div', { className: 'pitch' });
    let cursor = 0;
    const order = manager.squad.starters;
    window.LH3.data.PITCH_ROWS.forEach((row) => {
      const rowEl = el('div', { className: 'pitch-row' });
      row.forEach((pos) => {
        const playerId = order[cursor];
        cursor++;
        rowEl.appendChild(buildSlot(manager, playerId, '#' + pos.n + ' ' + pos.label, opts));
      });
      pitch.appendChild(rowEl);
    });
    return pitch;
  }

  /**
   * Ordre d'affichage uniquement (alphabétique) — jamais l'ordre stocké dans
   * manager.squad.bench, sur lequel s'appuient les échanges par index. Un
   * joueur qui redescend sur le banc se retrouve donc toujours à sa place
   * alphabétique, sans logique de tri à gérer côté échange.
   */
  function renderBench(manager, opts) {
    const strip = el('div', { className: 'bench-strip' });
    const sorted = manager.squad.bench.slice().sort((a, b) => {
      const baseA = window.LH3.services.playerService.getPlayerBase(a);
      const baseB = window.LH3.services.playerService.getPlayerBase(b);
      return (baseA ? baseA.name : '').localeCompare(baseB ? baseB.name : '');
    });
    sorted.forEach((playerId) => {
      const wrap = el('div', { className: 'bench-slot' });
      wrap.appendChild(buildSlot(manager, playerId, 'Banc', opts));
      strip.appendChild(wrap);
    });
    return strip;
  }

  window.LH3.components.squadPitch = { renderPitch, renderBench };
})();
