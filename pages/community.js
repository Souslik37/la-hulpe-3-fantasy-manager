/**
 * La Hulpe 3 Fantasy Manager — Page Communauté
 *
 * Deux onglets :
 *  - Managers : parcourir tout le monde, voir la composition de chacun
 *    (lecture seule — voir components/squadPitch.js)
 *  - Stats par poste : où le club place le plus souvent chaque joueur,
 *    tous managers confondus (voir services/communityService.js)
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.pages = window.LH3.pages || {};

  const { el, escapeHtml } = window.LH3.utils.dom;

  let activeTab = 'managers';

  // ── Onglet Managers ──────────────────────────────────────────────────────
  function openManagerModal(manager) {
    const prestige = window.LH3.services.peService.prestigeInfo(manager);
    const overall = window.LH3.services.playerService.teamOverall(manager);

    const body = el('div', {}, [
      el('div', { style: { textAlign: 'center', marginBottom: '16px' } }, [
        (() => {
          const w = el('div');
          w.innerHTML = window.LH3.utils.avatar.renderAvatar(manager.name, manager.coach && manager.coach.avatarUrl, 64);
          return w.firstElementChild;
        })(),
        el('div', { style: { fontWeight: '800', fontSize: '16px', marginTop: '8px' } }, [manager.name]),
        el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '8px', flexWrap: 'wrap' } }, [
          el('span', { className: 'badge badge-green' }, [String(overall) + ' overall d\'équipe']),
          el('span', { className: 'badge' }, ['🎖️ ' + prestige.name]),
          manager.role === 'admin' ? el('span', { className: 'badge badge-yellow' }, ['⚙️ Admin']) : null,
        ]),
      ]),
      manager.coach && manager.coach.name
        ? el('div', { style: { marginBottom: '18px' } }, [(() => {
            const w = el('div');
            w.innerHTML = window.LH3.components.coachCard.render(manager.coach);
            return w.firstElementChild;
          })()])
        : null,
      el('div', { className: 'section-title' }, ['🏟️ XV de départ']),
      window.LH3.components.squadPitch.renderPitch(manager, { readOnly: true }),
      el('div', { className: 'section-title' }, ['🪑 Banc']),
      window.LH3.components.squadPitch.renderBench(manager, { readOnly: true }),
    ]);

    window.LH3.components.modal.open({ title: manager.name, body, actions: [{ label: 'Fermer', className: 'btn-primary' }] });
  }

  function buildManagerCard(manager) {
    const overall = window.LH3.services.playerService.teamOverall(manager);
    const prestige = window.LH3.services.peService.prestigeInfo(manager);

    const card = el('div', { className: 'card manager-tile', onClick: () => openManagerModal(manager) }, [
      (() => {
        const w = el('div');
        w.innerHTML = window.LH3.utils.avatar.renderAvatar(manager.name, manager.coach && manager.coach.avatarUrl, 48);
        return w.firstElementChild;
      })(),
      el('div', { style: { marginTop: '10px', fontWeight: '750', fontSize: '14px' } }, [manager.name]),
      el('div', { className: 'muted small' }, [manager.coach && manager.coach.name ? 'Coach ' + manager.coach.name : 'Pas encore de coach']),
      el('div', { style: { display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' } }, [
        el('span', { className: 'badge badge-green' }, [String(overall)]),
        el('span', { className: 'badge' }, ['🎖️ ' + prestige.name]),
      ]),
    ]);
    return card;
  }

  function buildManagersTab() {
    const managers = window.LH3.services.managerService.listManagers();
    if (!managers.length) {
      return el('div', { className: 'card empty-state' }, [
        el('div', { className: 'ic' }, ['👥']),
        el('div', {}, ['Aucun manager pour l\'instant.']),
      ]);
    }
    const grid = el('div', { className: 'players-grid' });
    managers.forEach((m) => grid.appendChild(buildManagerCard(m)));
    return el('div', {}, [
      el('p', { className: 'muted small', style: { marginBottom: '14px' } }, [
        managers.length + ' manager' + (managers.length > 1 ? 's' : '') + ' inscrit' + (managers.length > 1 ? 's' : '') + ' — clique une carte pour voir sa composition.',
      ]),
      grid,
    ]);
  }

  // ── Onglet Stats par poste ───────────────────────────────────────────────
  function buildStatsTab() {
    const rows = window.LH3.services.communityService.allPositionBreakdowns();
    if (!rows.length) {
      return el('div', { className: 'card empty-state' }, [
        el('div', { className: 'ic' }, ['📊']),
        el('div', {}, ['Pas encore assez de données.']),
      ]);
    }
    // Tri alphabétique : une liste de roster à consulter, pas un classement.
    rows.sort((a, b) => a.player.name.localeCompare(b.player.name, 'fr'));

    const totalManagers = rows[0].breakdown.totalManagers;
    const list = el('div', {}, rows.map(({ player, breakdown }) => {
      const tags = breakdown.entries.slice(0, 4).map((e) =>
        el('span', { className: 'badge' + (e === breakdown.top ? ' badge-green' : '') }, [e.label + ' ' + e.pct + '%'])
      );
      return el('div', { className: 'boost-row' }, [
        el('div', { className: 'boost-label' }, [
          (() => {
            const w = el('span');
            w.innerHTML = window.LH3.utils.avatar.renderAvatar(player.name, player.avatarUrl, 26);
            return w.firstElementChild;
          })(),
          el('span', {}, [player.name]),
        ]),
        el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, tags),
      ]);
    }));

    return el('div', {}, [
      el('p', { className: 'muted small', style: { marginBottom: '14px' } }, [
        'Basé sur ' + totalManagers + ' manager' + (totalManagers > 1 ? 's' : '') + ' — plus le club est nombreux, plus ces stats deviennent fun.',
      ]),
      el('div', { className: 'card' }, [list]),
    ]);
  }

  function render(root) {
    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['🏟️ Communauté']),
      el('p', {}, ['Découvre les équipes de tout le club et qui joue où, selon tout le monde.']),
    ]));

    const tabs = el('div', { className: 'tabs' }, [
      el('div', { className: 'tab-btn' + (activeTab === 'managers' ? ' active' : ''), onClick: () => { activeTab = 'managers'; render(root); } }, ['Managers']),
      el('div', { className: 'tab-btn' + (activeTab === 'stats' ? ' active' : ''), onClick: () => { activeTab = 'stats'; render(root); } }, ['Stats par poste']),
    ]);
    root.appendChild(tabs);

    root.appendChild(activeTab === 'managers' ? buildManagersTab() : buildStatsTab());
  }

  window.LH3.pages.community = { render };
})();
