/**
 * La Hulpe 3 Fantasy Manager — Page Mon équipe
 *
 * Deux onglets :
 *  - Composition : terrain visuel (interaction "sélectionner puis placer",
 *    fonctionne au clic comme au tactile, pas de drag-and-drop fragile)
 *  - Attributs : répartition des points sur les 10 attributs de chaque joueur
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.pages = window.LH3.pages || {};

  const { el, escapeHtml } = window.LH3.utils.dom;

  let activeTab = 'composition';
  let selectedForSwap = null;

  function findLocation(squad, playerId) {
    let idx = squad.starters.indexOf(playerId);
    if (idx > -1) return { list: 'starters', idx };
    idx = squad.bench.indexOf(playerId);
    if (idx > -1) return { list: 'bench', idx };
    return null;
  }

  function swapPlayers(squad, idA, idB) {
    const locA = findLocation(squad, idA);
    const locB = findLocation(squad, idB);
    if (!locA || !locB) return;
    squad[locA.list][locA.idx] = idB;
    squad[locB.list][locB.idx] = idA;
  }

  function handleSlotClick(manager, playerId, rerender) {
    if (!playerId) { selectedForSwap = null; rerender(); return; }
    if (selectedForSwap === playerId) {
      selectedForSwap = null;
    } else if (selectedForSwap) {
      swapPlayers(manager.squad, selectedForSwap, playerId);
      selectedForSwap = null;
      window.LH3.services.stateService.persist();
    } else {
      selectedForSwap = playerId;
    }
    rerender();
  }

  // Trois rôles honorifiques indépendants (voir managerService.rolesFor) —
  // un joueur sélectionné peut recevoir n'importe quelle combinaison.
  const ROLES = [
    { key: 'captainId', icon: '⭐', label: 'Capitaine', removeLabel: 'Retirer le brassard' },
    { key: 'buteurId', icon: '🎯', label: 'Buteur', removeLabel: 'Retirer le rôle de buteur' },
    { key: 'lanceurId', icon: '🤾', label: 'Lanceur', removeLabel: 'Retirer le rôle de lanceur' },
  ];

  function pitchOpts(manager, rerender) {
    return {
      readOnly: false,
      selectedId: selectedForSwap,
      onSlotClick: (playerId) => handleSlotClick(manager, playerId, rerender),
    };
  }

  function buildRoleButtons(manager, rerender) {
    const buttons = [];
    ROLES.forEach((r) => {
      buttons.push(el('button', {
        className: 'btn btn-sm',
        onClick: () => {
          if (!selectedForSwap) { window.LH3.components.toast.show('Sélectionne un joueur sur le terrain ou le banc d\'abord.'); return; }
          window.LH3.services.managerService.toggleRole(manager, r.key, selectedForSwap, rerender);
        },
      }, [r.icon + ' ' + r.label + ' = joueur sélectionné']));
      if (manager.squad[r.key]) {
        buttons.push(el('button', {
          className: 'btn btn-ghost btn-sm',
          onClick: () => window.LH3.services.managerService.toggleRole(manager, r.key, manager.squad[r.key], rerender),
        }, [r.removeLabel]));
      }
    });
    return buttons;
  }

  function buildCompositionTab(manager, rerender) {
    return el('div', {}, [
      el('p', { className: 'muted small', style: { marginBottom: '14px' } }, [
        'Clique un joueur pour le sélectionner, puis clique un autre emplacement pour les échanger. Les postes sont purement visuels. Sélectionne un joueur puis un bouton ci-dessous pour lui attribuer capitaine, buteur ou lanceur (honorifiques, cumulables).',
      ]),
      el('div', { className: 'section-title' }, ['🏟️ Le XV de départ', selectedForSwap ? el('span', { className: 'badge badge-green' }, ['Sélection en cours — clique une autre case']) : null]),
      window.LH3.components.squadPitch.renderPitch(manager, pitchOpts(manager, rerender)),
      el('div', { className: 'section-title' }, ['🪑 Le banc (illimité)']),
      window.LH3.components.squadPitch.renderBench(manager, pitchOpts(manager, rerender)),
      el('div', { style: { marginTop: '18px', display: 'flex', gap: '10px', flexWrap: 'wrap' } }, buildRoleButtons(manager, rerender)),
    ]);
  }

  // ── Onglet Attributs ─────────────────────────────────────────────────────
  function openBoostModal(manager, playerId, rerenderParent) {
    const playerService = window.LH3.services.playerService;
    const CONFIG = window.LH3.data.CONFIG;

    let modalHandle = null;
    function buildBody() {
      const card = playerService.getCard(manager, playerId);
      const remaining = playerService.pointsRemaining(manager);

      const header = el('div', { style: { textAlign: 'center', marginBottom: '16px' } }, [
        (() => { const w = el('div'); w.innerHTML = window.LH3.utils.avatar.renderAvatar(card.name, card.avatarUrl, 64); return w.firstElementChild; })(),
        el('div', { style: { fontWeight: '800', fontSize: '15px', marginTop: '8px' } }, [card.name]),
        el('div', { className: 'badge badge-green', style: { marginTop: '6px' } }, [card.overall + ' overall · ' + window.LH3.utils.format.rarityLabel(card.rarity)]),
      ]);

      const pointsBanner = el('div', { className: 'boost-points-card', style: { marginBottom: '16px' } }, [
        el('div', { className: 'boost-points-n' }, [String(remaining)]),
        el('div', { className: 'boost-points-l' }, ['Points restants à répartir']),
      ]);

      const rows = el('div', {});
      CONFIG.attributes.forEach((attr) => {
        const value = card.attributes[attr.key];
        const row = el('div', { className: 'boost-row' }, [
          el('div', { className: 'boost-label' }, [attr.icon + ' ' + attr.label]),
          el('div', { className: 'boost-controls' }, [
            el('button', {
              className: 'stepper-btn',
              onClick: () => {
                const res = playerService.adjustAttribute(manager, playerId, attr.key, -1);
                if (res.ok) { window.LH3.services.stateService.persist(); refresh(); rerenderParent(); }
                else window.LH3.components.toast.show(res.reason, 'error');
              },
            }, ['–']),
            el('div', { className: 'boost-value' }, [String(value)]),
            el('button', {
              className: 'stepper-btn',
              onClick: () => {
                const res = playerService.adjustAttribute(manager, playerId, attr.key, 1);
                if (res.ok) { window.LH3.services.stateService.persist(); refresh(); rerenderParent(); }
                else window.LH3.components.toast.show(res.reason, 'error');
              },
            }, ['+']),
          ]),
        ]);
        rows.appendChild(row);
      });

      return el('div', {}, [header, pointsBanner, rows]);
    }

    function refresh() {
      const body = buildBody();
      modalHandle.box.querySelector('.modal-body').innerHTML = '';
      modalHandle.box.querySelector('.modal-body').appendChild(body);
    }

    modalHandle = window.LH3.components.modal.open({
      title: 'Répartir les points',
      body: buildBody(),
      actions: [
        { label: 'Fermer', className: 'btn-ghost' },
        {
          label: '✅ Sauvegarder cette répartition',
          className: 'btn-primary',
          closeOnClick: false,
          onClick: () => {
            playerService.saveBoosts(manager, playerId);
            window.LH3.services.stateService.persist();
            window.LH3.components.toast.show('Répartition sauvegardée — plus moyen de redescendre en dessous (sauf réinitialiser toute l\'équipe) ✅', 'success');
          },
        },
      ],
    });
  }

  function confirmResetBoosts(manager, rerender) {
    window.LH3.components.modal.open({
      title: 'Réinitialiser ton équipe ?',
      body: el('div', {}, [
        el('p', { className: 'small' }, ['Tous tes joueurs reviennent à 50 partout, et tu récupères tous les points dépensés pour les redistribuer autrement. Utilisable une seule fois par saison — cette action ne se défait pas.']),
      ]),
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Tout réinitialiser',
          className: 'btn-primary',
          onClick: () => {
            const res = window.LH3.services.playerService.resetBoosts(manager);
            if (!res.ok) { window.LH3.components.toast.show(res.reason, 'error'); return; }
            window.LH3.services.stateService.persist();
            window.LH3.components.toast.show('Équipe réinitialisée — tous les joueurs sont revenus à 50 ✅', 'success');
            rerender();
          },
        },
      ],
    });
  }

  /** Détail des sources des points d'un manager — pourquoi le total est ce qu'il est. */
  function openPointsBreakdownModal(manager) {
    const { formatSigned, peBadgeClass } = window.LH3.utils.format;
    const CONFIG = window.LH3.data.CONFIG;
    const playerService = window.LH3.services.playerService;
    const spent = playerService.pointsSpent(manager);

    const rows = [];
    window.LH3.services.seasonService.listMatches().forEach((match) => {
      const breakdown = manager.predictionResults && manager.predictionResults[match.id];
      if (!breakdown || !breakdown.peEarned) return;
      rows.push({ label: 'Match contre ' + match.opponent + ' (J' + match.matchday + ')', pe: breakdown.peEarned });
    });
    window.LH3.services.presenceService.listPeriods().forEach((period) => {
      const rating = window.LH3.services.presenceService.ratingForManager(period, manager.id);
      if (!rating) return;
      rows.push({ label: 'Assiduité — ' + period.label, pe: rating.pe });
    });

    const body = el('div', {}, [
      el('div', { className: 'boost-row' }, [
        el('div', { className: 'boost-label' }, ['Points de départ']),
        el('div', { className: 'badge' }, ['+' + CONFIG.season.startingPoints]),
      ]),
      ...rows.map((r) => el('div', { className: 'boost-row' }, [
        el('div', { className: 'boost-label' }, [r.label]),
        el('div', { className: 'badge ' + peBadgeClass(r.pe) }, [formatSigned(r.pe) + ' PE']),
      ])),
      spent > 0 ? el('div', { className: 'boost-row' }, [
        el('div', { className: 'boost-label' }, ['Déjà investi dans tes joueurs']),
        el('div', { className: 'badge ' + peBadgeClass(-spent) }, [formatSigned(-spent)]),
      ]) : null,
      el('div', { className: 'badge', style: { marginTop: '14px', display: 'block', textAlign: 'center', padding: '10px' } }, [
        String(playerService.pointsRemaining(manager)) + ' points restants'
      ]),
      manager.pe < 0 ? el('p', { className: 'muted small', style: { marginTop: '10px' } }, [
        'Ton total de PE est actuellement négatif (visible seulement au classement) — ça n\'a pas entamé ton socle de points de départ, déjà acquis pour toujours.',
      ]) : null,
    ]);

    window.LH3.components.modal.open({ title: 'D\'où viennent tes points ?', body, actions: [{ label: 'Fermer', className: 'btn-primary' }] });
  }

  function buildAttributesTab(manager, rerender) {
    const playerService = window.LH3.services.playerService;
    const remaining = playerService.pointsRemaining(manager);
    const available = playerService.pointsAvailable(manager);
    const spent = playerService.pointsSpent(manager);

    const summary = el('div', { className: 'card', style: { marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' } }, [
      el('div', { className: 'boost-points-card clickable', onClick: () => openPointsBreakdownModal(manager) }, [
        el('div', { className: 'boost-points-n' }, [String(remaining)]),
        el('div', { className: 'boost-points-l' }, ['Points restants']),
        el('div', { className: 'boost-points-hint' }, ['Détail →']),
      ]),
      el('div', { style: { flex: '1', minWidth: '200px' } }, [
        el('div', { className: 'boost-bar-track' }, [
          el('div', { className: 'boost-bar-fill', style: { width: Math.min(100, (spent / available) * 100) + '%' } }),
        ]),
        el('div', { className: 'muted small', style: { marginTop: '8px' } }, [
          spent + ' points dépensés sur ' + available + ' disponibles (' + window.LH3.data.CONFIG.season.startingPoints + ' de départ + bonus PE).',
        ]),
      ]),
      (spent > 0 || manager.resetBoostsUsed) ? el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' } }, [
        el('button', {
          className: 'btn btn-ghost btn-sm',
          disabled: !!manager.resetBoostsUsed,
          title: manager.resetBoostsUsed ? 'Déjà utilisé cette saison' : '',
          onClick: () => confirmResetBoosts(manager, rerender),
        }, [manager.resetBoostsUsed ? '🔄 Déjà réinitialisé cette saison' : '🔄 Réinitialiser mon équipe']),
        el('div', { className: 'muted', style: { fontSize: '11px', fontStyle: 'italic' } }, ['(max 1 fois par saison)']),
      ]) : null,
    ]);

    const grid = el('div', { className: 'players-grid' });
    // Triée par note décroissante (les meilleurs en premier), puis par nom à
    // note égale — plus pratique pour repérer vite qui vaut le coup de booster.
    const cards = playerService.listPlayers()
      .map((p) => ({ player: p, card: playerService.getCard(manager, p.id) }))
      .sort((a, b) => b.card.overall - a.card.overall || a.player.name.localeCompare(b.player.name));
    cards.forEach(({ player: p, card }) => {
      const wrap = el('div', { onClick: () => openBoostModal(manager, p.id, rerender) });
      wrap.innerHTML = window.LH3.components.playerCard.render(card, { roles: window.LH3.services.managerService.rolesFor(manager, p.id) });
      grid.appendChild(wrap);
    });

    return el('div', {}, [summary, grid]);
  }

  function render(root) {
    const manager = window.LH3.services.managerService.getActiveManager();
    root.innerHTML = '';

    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['Mon équipe']),
      el('p', {}, ['La composition et le brassard sont purement visuels. Les points changent la note de tes cartes, pour le plaisir de les faire progresser.']),
    ]));

    const tabs = el('div', { className: 'tabs' }, [
      el('div', { className: 'tab-btn' + (activeTab === 'composition' ? ' active' : ''), onClick: () => { activeTab = 'composition'; render(root); } }, ['Composition']),
      el('div', { className: 'tab-btn' + (activeTab === 'attributs' ? ' active' : ''), onClick: () => { activeTab = 'attributs'; render(root); } }, ['Attributs']),
    ]);
    root.appendChild(tabs);

    const rerender = () => render(root);
    root.appendChild(activeTab === 'composition' ? buildCompositionTab(manager, rerender) : buildAttributesTab(manager, rerender));
  }

  // Enregistré sous la clé de route "team" (voir NAV_ITEMS dans components/navbar.js).
  window.LH3.pages.team = { render };
})();
