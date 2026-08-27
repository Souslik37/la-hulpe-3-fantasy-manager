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
    const dn = window.LH3.services.managerService.displayName(manager);

    const body = el('div', {}, [
      el('div', { style: { textAlign: 'center', marginBottom: '16px' } }, [
        (() => {
          const w = el('div');
          w.innerHTML = window.LH3.utils.avatar.renderAvatar(dn, manager.coach && manager.coach.avatarUrl, 64);
          return w.firstElementChild;
        })(),
        el('div', { style: { fontWeight: '800', fontSize: '16px', marginTop: '8px' } }, [dn]),
        dn !== manager.name ? el('div', { className: 'muted small' }, [manager.name]) : null,
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

    window.LH3.components.modal.open({ title: dn, body, actions: [{ label: 'Fermer', className: 'btn-primary' }] });
  }

  function buildManagerCard(manager) {
    const overall = window.LH3.services.playerService.teamOverall(manager);
    const prestige = window.LH3.services.peService.prestigeInfo(manager);
    const dn = window.LH3.services.managerService.displayName(manager);

    const card = el('div', { className: 'card manager-tile', onClick: () => openManagerModal(manager) }, [
      (() => {
        const w = el('div');
        w.innerHTML = window.LH3.utils.avatar.renderAvatar(dn, manager.coach && manager.coach.avatarUrl, 48);
        return w.firstElementChild;
      })(),
      el('div', { style: { marginTop: '10px', fontWeight: '750', fontSize: '14px' } }, [dn]),
      el('div', { className: 'muted small' }, [dn !== manager.name ? manager.name : 'Pas encore de coach']),
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

  // ── Onglet Saisons passées ───────────────────────────────────────────────
  let seasonArchives = null; // null = pas encore chargé, [] = chargé mais vide
  let archivesLoading = false;
  let selectedSeason = null;

  function openArchivedManagerModal(archive) {
    const cardById = {};
    archive.playerCards.forEach((c) => { cardById[c.id] = c; });
    let subTab = 'squad';
    const body = el('div', {});

    function refresh() {
      body.innerHTML = '';
      body.appendChild(el('div', { className: 'tabs' }, [
        el('div', { className: 'tab-btn' + (subTab === 'squad' ? ' active' : ''), onClick: () => { subTab = 'squad'; refresh(); } }, ['Équipe']),
        el('div', { className: 'tab-btn' + (subTab === 'predictions' ? ' active' : ''), onClick: () => { subTab = 'predictions'; refresh(); } }, ['Pronostics']),
        el('div', { className: 'tab-btn' + (subTab === 'presence' ? ' active' : ''), onClick: () => { subTab = 'presence'; refresh(); } }, ['Présence']),
      ]));

      if (subTab === 'squad') {
        const grid = el('div', { className: 'players-grid' });
        (archive.squad.starters || []).forEach((id) => {
          const card = cardById[id];
          if (!card) return;
          const w = el('div'); w.innerHTML = window.LH3.components.playerCard.render(card, {});
          grid.appendChild(w.firstElementChild);
        });
        body.appendChild(el('div', { className: 'section-title' }, ['🏟️ Titulaires']));
        body.appendChild(grid);
        if ((archive.squad.bench || []).length) {
          const benchGrid = el('div', { className: 'players-grid' });
          archive.squad.bench.forEach((id) => {
            const card = cardById[id];
            if (!card) return;
            const w = el('div'); w.innerHTML = window.LH3.components.playerCard.render(card, { compact: true });
            benchGrid.appendChild(w.firstElementChild);
          });
          body.appendChild(el('div', { className: 'section-title' }, ['🪑 Banc']));
          body.appendChild(benchGrid);
        }
      } else if (subTab === 'predictions') {
        if (!archive.predictions.length) {
          body.appendChild(el('div', { className: 'muted small' }, ['Aucun pronostic soumis cette saison-là.']));
        } else {
          archive.predictions.forEach((p) => {
            const row = el('div', { className: 'boost-row' }, [
              el('div', { className: 'boost-label' }, ['J' + p.matchday + ' vs ' + p.opponent]),
              el('div', { className: 'muted small' }, [
                'Pronostic : ' + p.scoreFor + '–' + p.scoreAgainst
                + (p.result ? ' · Réel : ' + p.result.scoreFor + '–' + p.result.scoreAgainst : ''),
              ]),
              el('div', { className: 'badge ' + window.LH3.utils.format.peBadgeClass(p.peEarned) }, [window.LH3.utils.format.formatSigned(p.peEarned) + ' PE']),
            ]);
            body.appendChild(row);
          });
        }
      } else {
        if (!archive.presence.length) {
          body.appendChild(el('div', { className: 'muted small' }, ['Aucune évaluation d\'assiduité cette saison-là.']));
        } else {
          archive.presence.forEach((p) => {
            body.appendChild(el('div', { className: 'boost-row' }, [
              el('div', { className: 'boost-label' }, [p.label]),
              el('div', {}, [p.tierLabel]),
              el('div', { className: 'badge ' + window.LH3.utils.format.peBadgeClass(p.pe) }, [window.LH3.utils.format.formatSigned(p.pe) + ' PE']),
            ]));
          });
        }
      }
    }
    refresh();

    window.LH3.components.modal.open({ title: archive.managerName, body, actions: [{ label: 'Fermer', className: 'btn-primary' }] });
  }

  function buildArchivesTab(root) {
    if (seasonArchives === null) {
      if (!archivesLoading) {
        archivesLoading = true;
        window.LH3.services.storageService.loadSeasonArchives()
          .then((archives) => { seasonArchives = archives; archivesLoading = false; render(root); })
          .catch((e) => { console.error('[community] échec chargement archives', e); seasonArchives = []; archivesLoading = false; render(root); });
      }
      return el('div', { className: 'card empty-state' }, [el('div', { className: 'ic' }, ['⏳']), el('div', {}, ['Chargement des archives...'])]);
    }

    if (!seasonArchives.length) {
      return el('div', { className: 'card empty-state' }, [
        el('div', { className: 'ic' }, ['📚']),
        el('div', {}, ['Aucune saison archivée pour l\'instant — ça viendra au premier reset de saison (Administration).']),
      ]);
    }

    const labels = [];
    seasonArchives.forEach((a) => { if (!labels.includes(a.seasonLabel)) labels.push(a.seasonLabel); });
    if (!selectedSeason || !labels.includes(selectedSeason)) selectedSeason = labels[0];

    const rows = seasonArchives.filter((a) => a.seasonLabel === selectedSeason).sort((a, b) => b.finalPe - a.finalPe);

    return el('div', {}, [
      el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' } },
        labels.map((label) => el('button', {
          className: 'btn btn-sm' + (label === selectedSeason ? ' btn-primary' : ' btn-ghost'),
          onClick: () => { selectedSeason = label; render(root); },
        }, [label]))),
      el('div', { className: 'card' }, rows.map((r, i) => el('div', {
        className: 'boost-row', style: { cursor: 'pointer' },
        onClick: () => openArchivedManagerModal(r),
      }, [
        el('div', { className: 'boost-label' }, [(i + 1) + '. ' + r.managerName]),
        el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [
          el('span', { className: 'badge badge-green' }, [String(r.finalPe) + ' PE']),
          el('span', { className: 'badge' }, ['🎖️ ' + r.finalPrestige]),
          el('span', { className: 'badge' }, [String(r.finalTeamOverall) + ' overall']),
        ]),
      ]))),
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
      el('div', { className: 'tab-btn' + (activeTab === 'archives' ? ' active' : ''), onClick: () => { activeTab = 'archives'; render(root); } }, ['📚 Saisons passées']),
    ]);
    root.appendChild(tabs);

    if (activeTab === 'managers') root.appendChild(buildManagersTab());
    else if (activeTab === 'stats') root.appendChild(buildStatsTab());
    else root.appendChild(buildArchivesTab(root));
  }

  window.LH3.pages.community = { render };
})();
