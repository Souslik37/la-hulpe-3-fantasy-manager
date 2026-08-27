/**
 * La Hulpe 3 Fantasy Manager — Page Classements
 *
 * Deux vues sur la même performance :
 *  - PE & Prestige : le classement officiel (pronostics + assiduité)
 *  - Notes d'équipe : reflète comment chacun a dépensé son PE sur sa
 *    composition — corrélé au premier (plus de PE = plus de budget), mais
 *    pas identique (chacun distribue différemment ses points).
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.pages = window.LH3.pages || {};

  const { el, escapeHtml } = window.LH3.utils.dom;
  let activeTab = 'pe';

  function rankBadge(i) {
    const cls = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
    return el('span', { className: 'rank-badge ' + cls }, [String(i + 1)]);
  }

  /** Nom du coach en avant (le vrai nom de connexion en petit dessous, s'il diffère) — cliquable, ouvre sa fiche équipe (même modale que Communauté). */
  function managerCell(manager) {
    const dn = window.LH3.services.managerService.displayName(manager);
    return el('td', { style: { cursor: 'pointer' }, onClick: () => window.LH3.pages.community.openManagerModal(manager) }, [
      el('div', { style: { fontWeight: '700', color: 'var(--green-text)' } }, [dn]),
      dn !== manager.name ? el('div', { className: 'muted', style: { fontSize: '11px' } }, [manager.name]) : null,
    ]);
  }

  function buildPeTable() {
    const managers = window.LH3.services.managerService.listManagers();
    const active = window.LH3.services.managerService.getActiveManager();
    const rows = managers
      .map((m) => ({
        manager: m,
        pe: m.pe || 0,
        prestige: window.LH3.services.peService.prestigeInfo(m),
        predictionsMade: Object.keys(m.predictions || {}).length,
      }))
      .sort((a, b) => b.pe - a.pe);

    if (!rows.length) return el('div', { className: 'empty-state' }, [el('div', { className: 'ic' }, ['📊']), el('div', {}, ['Aucun manager pour le moment.'])]);

    const table = el('table', { className: 'standings-table' }, [
      el('thead', {}, [el('tr', {}, ['#', 'Manager', 'PE', 'Prestige', 'Pronostics faits'].map((h) => el('th', {}, [h])))]),
      el('tbody', {}, rows.map((r, i) => el('tr', { className: active && r.manager.id === active.id ? 'me' : '' }, [
        el('td', {}, [rankBadge(i)]),
        managerCell(r.manager),
        el('td', { style: { fontWeight: '800', color: 'var(--green-text)' } }, [String(r.pe)]),
        el('td', {}, [r.prestige.name]),
        el('td', {}, [String(r.predictionsMade)]),
      ]))),
    ]);
    return table;
  }

  function buildTeamTable() {
    const playerService = window.LH3.services.playerService;
    const managers = window.LH3.services.managerService.listManagers();
    const active = window.LH3.services.managerService.getActiveManager();

    const rows = managers.map((m) => {
      const cards = m.squad.starters.map((id) => playerService.getCard(m, id)).filter(Boolean);
      const overall = cards.length ? Math.round(cards.reduce((a, c) => a + c.overall, 0) / cards.length) : 0;
      const best = cards.slice().sort((a, b) => b.overall - a.overall)[0];
      return { manager: m, overall, best };
    }).sort((a, b) => b.overall - a.overall);

    if (!rows.length) return el('div', { className: 'empty-state' }, [el('div', { className: 'ic' }, ['🏉']), el('div', {}, ['Aucun manager pour le moment.'])]);

    const table = el('table', { className: 'standings-table' }, [
      el('thead', {}, [el('tr', {}, ['#', 'Manager', 'Note d\'équipe', 'Meilleur joueur'].map((h) => el('th', {}, [h])))]),
      el('tbody', {}, rows.map((r, i) => el('tr', { className: active && r.manager.id === active.id ? 'me' : '' }, [
        el('td', {}, [rankBadge(i)]),
        managerCell(r.manager),
        el('td', { style: { fontWeight: '800' } }, [String(r.overall)]),
        el('td', { className: 'muted' }, [r.best ? `${r.best.name} (${r.best.overall})` : '—']),
      ]))),
    ]);
    return table;
  }

  function render(root) {
    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['Classements']),
      el('p', {}, ['Le classement PE reflète qui pronostique le mieux et vient le plus aux entraînements. Le classement "note d\'équipe" montre qui a le mieux exploité son budget — corrélé au premier, mais chacun distribue ses points différemment.']),
    ]));

    const tabs = el('div', { className: 'tabs' }, [
      el('div', { className: 'tab-btn' + (activeTab === 'pe' ? ' active' : ''), onClick: () => { activeTab = 'pe'; render(root); } }, ['🏆 PE & Prestige']),
      el('div', { className: 'tab-btn' + (activeTab === 'team' ? ' active' : ''), onClick: () => { activeTab = 'team'; render(root); } }, ['🎨 Notes d\'équipe']),
    ]);
    root.appendChild(tabs);

    root.appendChild(el('div', { className: 'card' }, [activeTab === 'pe' ? buildPeTable() : buildTeamTable()]));
  }

  window.LH3.pages.standings = { render };
})();
