/**
 * La Hulpe 3 Fantasy Manager — Barre latérale + barre supérieure
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.components = window.LH3.components || {};

  // Liste complète (sert à script.js pour valider les routes). L'affichage
  // réel dans la sidebar retire "admin" si le manager actif n'a pas ce rôle
  // — voir visibleItems().
  const NAV_ITEMS = [
    { key: 'home', icon: '🏠', label: 'Accueil' },
    { key: 'team', icon: '👥', label: 'Mon équipe' },
    { key: 'players', icon: '🏉', label: 'Tous les joueurs' },
    { key: 'calendar', icon: '📅', label: 'Calendrier' },
    { key: 'predictions', icon: '🎯', label: 'Pronostics' },
    { key: 'standings', icon: '🏆', label: 'Classements' },
    { key: 'community', icon: '🏟️', label: 'Communauté' },
    { key: 'statistics', icon: '📊', label: 'Statistiques' },
    { key: 'journal', icon: '📰', label: 'Journal du Club' },
    { key: 'rules', icon: '📖', label: 'Règles' },
    { key: 'admin', icon: '⚙️', label: 'Administration' },
    { key: 'settings', icon: '🛠️', label: 'Paramètres' },
  ];

  const PAGE_TITLES = NAV_ITEMS.reduce((acc, i) => { acc[i.key] = i.label; return acc; }, {});

  function visibleItems(manager) {
    const isAdmin = manager && manager.role === 'admin';
    return NAV_ITEMS.filter((item) => item.key !== 'admin' || isAdmin);
  }

  function renderSidebar(currentKey, manager) {
    const { el } = window.LH3.utils.dom;
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = '';
    sidebar.appendChild(el('div', { className: 'brand' }, [
      el('div', { className: 'brand-badge' }, ['🏉']),
      el('div', { className: 'brand-text' }, [
        el('div', { className: 't1' }, ['La Hulpe 3']),
        el('div', { className: 't2' }, ['Fantasy Manager']),
      ]),
    ]));

    const list = el('div', { className: 'nav-list' },
      visibleItems(manager).map((item) => el('div', {
        className: 'nav-item' + (item.key === currentKey ? ' active' : ''),
        onClick: () => { window.location.hash = '#' + item.key; },
      }, [
        el('span', { className: 'ic' }, [item.icon]),
        el('span', {}, [item.label]),
      ]))
    );
    sidebar.appendChild(list);

    sidebar.appendChild(el('div', { className: 'sidebar-footer' }, ['Saison 1 · En ligne']));
  }

  function renderTopbar(currentKey) {
    const { el, escapeHtml } = window.LH3.utils.dom;
    const topbar = document.getElementById('topbar');
    topbar.innerHTML = '';

    const manager = window.LH3.services.managerService.getActiveManager();

    topbar.appendChild(el('div', { className: 'topbar-title' }, [PAGE_TITLES[currentKey] || '']));

    const right = el('div', { className: 'topbar-right' });

    if (manager) {
      const prestige = window.LH3.services.peService.prestigeInfo(manager);
      right.appendChild(el('div', { className: 'pe-chip' }, ['✨ ' + (manager.pe || 0) + ' PE']));
      right.appendChild(el('div', { className: 'prestige-chip' }, ['🎖️ ' + escapeHtml(prestige.name)]));
      right.appendChild(el('div', {
        className: 'manager-pill',
        onClick: () => { window.location.hash = '#settings'; },
      }, [
        (() => {
          const wrap = el('span', {});
          wrap.innerHTML = window.LH3.utils.avatar.renderAvatar(manager.name, manager.coach && manager.coach.avatarUrl, 26);
          return wrap;
        })(),
        el('span', { className: 'name' }, [manager.name]),
      ]));
    }

    topbar.appendChild(right);
  }

  function render(currentKey) {
    const manager = window.LH3.services.managerService.getActiveManager();
    renderSidebar(currentKey, manager);
    renderTopbar(currentKey);
  }

  window.LH3.components.navbar = { render, NAV_ITEMS, PAGE_TITLES, visibleItems };
})();
