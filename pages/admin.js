/**
 * La Hulpe 3 Fantasy Manager — Page Administration
 *
 * Édition du calendrier + encodage des résultats officiels. Réservée aux
 * comptes avec role === 'admin' (voir components/navbar.js pour le masquage
 * du menu, et supabase/schema.sql pour l'application réelle de la règle
 * côté serveur — un joueur normal ne peut pas écrire ces tables même en
 * naviguant directement vers #admin).
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.pages = window.LH3.pages || {};

  const { el } = window.LH3.utils.dom;

  function openResultModal(match, rerender) {
    const existing = match.result || {};
    const form = window.LH3.components.predictionForm.build({
      initialData: existing,
      awayLabel: match.opponent,
      scoringHint: false, // ici on encode le résultat réel, pas un pronostic — le rappel de pénalité n'a pas de sens
    });

    const modal = window.LH3.components.modal.open({
      title: 'Encoder le résultat · Journée ' + match.matchday,
      body: form.node,
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Valider le résultat officiel',
          className: 'btn-primary',
          closeOnClick: false,
          onClick: async (btn) => {
            const data = form.getData();
            if (data.scoreFor === null || data.scoreAgainst === null) {
              window.LH3.components.toast.show('Le score est obligatoire.', 'error');
              return;
            }
            if (btn) { btn.disabled = true; btn.textContent = 'Notation en cours...'; }
            try {
              await window.LH3.services.seasonService.finalizeMatch(match.id, data);
              window.LH3.components.toast.show('Résultat encodé, PE distribués et journal mis à jour ✅', 'success');
              window.LH3.components.modal.close();
              rerender();
            } catch (e) {
              window.LH3.components.toast.show('Échec de la notation : ' + e.message, 'error');
              if (btn) { btn.disabled = false; btn.textContent = 'Valider le résultat officiel'; }
            }
          },
        },
      ],
    });
    return modal;
  }

  function buildMatchRow(match, rerender) {
    const opponentInput = el('input', {
      type: 'text', value: match.opponent,
      onChange: (e) => window.LH3.services.seasonService.updateMatchInfo(match.id, { opponent: e.target.value }),
    });
    const dateInput = el('input', {
      type: 'date', value: match.date,
      onChange: (e) => window.LH3.services.seasonService.updateMatchInfo(match.id, { date: e.target.value }),
    });
    const statusSelect = el('select', {
      onChange: (e) => { window.LH3.services.seasonService.setMatchStatus(match.id, e.target.value); rerender(); },
    }, [
      el('option', { value: 'verrouille' }, ['🔒 Verrouillé']),
      el('option', { value: 'ouvert' }, ['🟢 Ouvert']),
      el('option', { value: 'termine' }, ['✅ Terminé']),
    ]);
    statusSelect.value = match.status;

    return el('div', { className: 'card', style: { display: 'grid', gridTemplateColumns: '50px 1.4fr 1fr 1fr auto', gap: '10px', alignItems: 'center', padding: '12px 16px', marginBottom: '8px' } }, [
      el('div', { className: 'muted', style: { fontWeight: '800' } }, ['J' + match.matchday]),
      opponentInput,
      dateInput,
      statusSelect,
      el('button', { className: 'btn btn-sm', onClick: () => openResultModal(match, rerender) }, [match.result ? 'Modifier résultat' : 'Encoder résultat']),
    ]);
  }

  // ── Assiduité (bonus de présence, ~4 fois par saison) ───────────────────
  function openEvaluatePeriodModal(period, rerenderPresence) {
    const managers = window.LH3.services.managerService.listManagers();
    const tiers = window.LH3.data.CONFIG.presence.tiers;
    const selects = {};

    const rows = managers.map((m) => {
      const existing = window.LH3.services.presenceService.ratingForManager(period, m.id);
      const select = el('select', {}, tiers.map((t) => el('option', { value: t.key }, [t.label + ' (+' + t.pe + ' PE)'])));
      select.value = existing ? existing.tier : 'moyen';
      selects[m.id] = select;
      return el('div', { className: 'boost-row' }, [
        el('div', { className: 'boost-label' }, [m.name]),
        select,
      ]);
    });

    const modal = window.LH3.components.modal.open({
      title: 'Évaluer · ' + period.label,
      body: el('div', {}, [
        el('p', { className: 'small', style: { marginBottom: '12px' } }, ['Une appréciation globale suffit, pas besoin de compter précisément. "Moyen" est présélectionné pour aller vite.']),
        ...rows,
      ]),
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Valider et distribuer les PE',
          className: 'btn-primary',
          closeOnClick: false,
          onClick: async (btn) => {
            if (btn) { btn.disabled = true; btn.textContent = 'Distribution en cours...'; }
            const ratings = {};
            Object.keys(selects).forEach((managerId) => { ratings[managerId] = selects[managerId].value; });
            const res = await window.LH3.services.presenceService.evaluatePeriod(period.id, ratings);
            if (!res.ok) {
              window.LH3.components.toast.show(res.reason, 'error');
              if (btn) { btn.disabled = false; btn.textContent = 'Valider et distribuer les PE'; }
              return;
            }
            window.LH3.components.toast.show('Bonus d\'assiduité distribué ✅', 'success');
            window.LH3.components.modal.close();
            rerenderPresence();
          },
        },
      ],
    });
    return modal;
  }

  function confirmResetPeriod(period, rerenderPresence) {
    window.LH3.components.modal.open({
      title: 'Réinitialiser "' + period.label + '" ?',
      body: el('div', {}, [
        el('p', { className: 'small' }, ['Les PE distribués pour cette période sont repris à tout le monde, et la période redevient "À venir". La brève du journal correspondante est aussi retirée. Utile si c\'était un essai.']),
      ]),
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Réinitialiser',
          className: 'btn-primary',
          closeOnClick: false,
          onClick: async (btn) => {
            if (btn) { btn.disabled = true; btn.textContent = 'Réinitialisation...'; }
            const res = await window.LH3.services.presenceService.resetPeriod(period.id);
            if (!res.ok) {
              window.LH3.components.toast.show(res.reason, 'error');
              if (btn) { btn.disabled = false; btn.textContent = 'Réinitialiser'; }
              return;
            }
            window.LH3.components.toast.show('Période réinitialisée ✅', 'success');
            window.LH3.components.modal.close();
            rerenderPresence();
          },
        },
      ],
    });
  }

  function buildPresenceRow(period, rerenderPresence) {
    const labelInput = el('input', {
      type: 'text', value: period.label,
      onChange: (e) => window.LH3.services.presenceService.updatePeriodInfo(period.id, { label: e.target.value }),
    });
    const dateInput = el('input', {
      type: 'date', value: period.date,
      onChange: (e) => window.LH3.services.presenceService.updatePeriodInfo(period.id, { date: e.target.value }),
    });
    const evaluated = Object.keys(period.ratings || {}).length > 0;

    return el('div', { className: 'card', style: { display: 'grid', gridTemplateColumns: '1.4fr 1fr auto auto auto', gap: '10px', alignItems: 'center', padding: '12px 16px', marginBottom: '8px' } }, [
      labelInput,
      dateInput,
      el('span', { className: 'badge' + (evaluated ? ' badge-green' : '') }, [evaluated ? '✅ Distribué' : '🔜 À venir']),
      el('button', { className: 'btn btn-sm', onClick: () => openEvaluatePeriodModal(period, rerenderPresence) }, [evaluated ? 'Ré-évaluer' : 'Évaluer']),
      evaluated ? el('button', { className: 'btn btn-sm btn-ghost', onClick: () => confirmResetPeriod(period, rerenderPresence) }, ['Réinitialiser']) : null,
    ]);
  }

  function buildPresenceSection(root) {
    root.appendChild(el('div', { className: 'section-title' }, ['🙌 Assiduité']));
    root.appendChild(el('p', { className: 'muted small', style: { marginBottom: '10px' } }, [
      'Bonus de présence aux entraînements, distribué par période — jamais de pénalité, juste un petit plus pour ceux qui viennent.',
    ]));
    const list = el('div', {});
    root.appendChild(list);

    function rerenderPresence() {
      list.innerHTML = '';
      window.LH3.services.presenceService.listPeriods().forEach((p) => list.appendChild(buildPresenceRow(p, rerenderPresence)));
    }
    rerenderPresence();
  }

  // ── Roster (ajout / renommage / avatar / suppression) ──────────────────
  function openAddPlayerModal(rerenderRoster) {
    const nameInput = el('input', { type: 'text', placeholder: 'Ex : Kevin' });
    const avatarInput = el('input', { type: 'text', placeholder: 'https://... (optionnel, laisse vide pour un avatar par défaut)' });

    const modal = window.LH3.components.modal.open({
      title: 'Ajouter un joueur',
      body: el('div', {}, [
        el('div', { className: 'field' }, [el('label', {}, ['Nom du joueur']), nameInput]),
        el('div', { className: 'field' }, [el('label', {}, ['URL avatar (facultatif)']), avatarInput]),
        el('div', { className: 'field-hint' }, ['Il démarre avec tous ses attributs à 50, comme les autres — les managers pourront ensuite y mettre des points.']),
      ]),
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Ajouter',
          className: 'btn-primary',
          closeOnClick: false,
          onClick: async (btn) => {
            if (btn) { btn.disabled = true; btn.textContent = 'Ajout en cours...'; }
            const res = await window.LH3.services.rosterService.addPlayer(nameInput.value, avatarInput.value);
            if (!res.ok) {
              window.LH3.components.toast.show(res.reason, 'error');
              if (btn) { btn.disabled = false; btn.textContent = 'Ajouter'; }
              return;
            }
            window.LH3.components.toast.show(res.player.name + ' ajouté au roster ✅', 'success');
            window.LH3.components.modal.close();
            rerenderRoster();
          },
        },
      ],
    });
    return modal;
  }

  function confirmRemovePlayer(player, rerenderRoster) {
    window.LH3.components.modal.open({
      title: 'Retirer ' + player.name + ' ?',
      body: el('div', {}, [
        el('p', { className: 'small' }, ['Il disparaîtra du roster partagé. S\'il était dans la compo de certains managers, leur emplacement redeviendra vide à leur prochaine visite.']),
      ]),
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Retirer définitivement',
          className: 'btn-primary',
          closeOnClick: false,
          onClick: async (btn) => {
            if (btn) { btn.disabled = true; btn.textContent = 'Suppression...'; }
            const res = await window.LH3.services.rosterService.removePlayer(player.id);
            if (!res.ok) {
              window.LH3.components.toast.show(res.reason, 'error');
              if (btn) { btn.disabled = false; btn.textContent = 'Retirer définitivement'; }
              return;
            }
            window.LH3.components.toast.show(player.name + ' retiré du roster', 'success');
            window.LH3.components.modal.close();
            rerenderRoster();
          },
        },
      ],
    });
  }

  function buildPlayerRow(player, rerenderRoster) {
    const avatarBox = el('span');
    avatarBox.innerHTML = window.LH3.utils.avatar.renderAvatar(player.name, player.avatarUrl, 34);

    const nameInput = el('input', {
      type: 'text', value: player.name,
      onChange: async (e) => {
        const res = await window.LH3.services.rosterService.renamePlayer(player.id, e.target.value);
        if (!res.ok) { window.LH3.components.toast.show(res.reason, 'error'); e.target.value = player.name; }
      },
    });
    const avatarInput = el('input', {
      type: 'text', value: player.avatarUrl || '', placeholder: 'URL avatar...',
      onChange: async (e) => {
        const res = await window.LH3.services.rosterService.setPlayerAvatar(player.id, e.target.value);
        if (!res.ok) { window.LH3.components.toast.show(res.reason, 'error'); }
        else rerenderRoster();
      },
    });

    return el('div', {
      className: 'card', style: { display: 'grid', gridTemplateColumns: '40px 1fr 1.6fr auto', gap: '10px', alignItems: 'center', padding: '10px 16px', marginBottom: '6px' },
    }, [
      avatarBox,
      nameInput,
      avatarInput,
      el('button', { className: 'btn btn-sm btn-ghost', onClick: () => confirmRemovePlayer(player, rerenderRoster) }, ['Retirer']),
    ]);
  }

  function buildRosterSection(root) {
    root.appendChild(el('div', { className: 'section-title' }, [
      '🏉 Roster du club',
      el('span', {
        className: 'see-all',
        onClick: () => openAddPlayerModal(() => rerenderRoster()),
      }, ['+ Ajouter un joueur']),
    ]));
    root.appendChild(el('p', { className: 'muted small', style: { marginBottom: '10px' } }, [
      'Le nom et l\'avatar s\'enregistrent automatiquement quand tu cliques ailleurs. Les attributs démarrent toujours à 50.',
    ]));
    const list = el('div', {});
    root.appendChild(list);

    function rerenderRoster() {
      list.innerHTML = '';
      window.LH3.services.playerService.listPlayers()
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((p) => list.appendChild(buildPlayerRow(p, rerenderRoster)));
    }
    rerenderRoster();
  }

  function render(root) {
    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['Administration']),
      el('p', {}, ['Gère le calendrier et encode les résultats officiels — tout le reste (PE, journal) se calcule automatiquement.']),
    ]));

    root.appendChild(el('div', { className: 'section-title' }, ['📅 Calendrier de la saison']));
    const list = el('div', {});
    root.appendChild(list);

    function rerender() {
      list.innerHTML = '';
      window.LH3.services.seasonService.listMatches().forEach((m) => list.appendChild(buildMatchRow(m, rerender)));
    }
    rerender();

    buildPresenceSection(root);
    buildRosterSection(root);
    buildManagersSection(root);
  }

  function confirmRemoveManager(manager, rerenderManagers) {
    window.LH3.components.modal.open({
      title: 'Supprimer ' + manager.name + ' ?',
      body: el('div', {}, [
        el('p', { className: 'small' }, ['Son profil, son équipe et ses pronostics disparaissent définitivement. Il ne pourra plus se reconnecter avec ce nom.']),
      ]),
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Supprimer définitivement',
          className: 'btn-primary',
          closeOnClick: false,
          onClick: async (btn) => {
            if (btn) { btn.disabled = true; btn.textContent = 'Suppression...'; }
            const res = await window.LH3.services.managerService.removeManager(manager.id);
            if (!res.ok) {
              window.LH3.components.toast.show(res.reason, 'error');
              if (btn) { btn.disabled = false; btn.textContent = 'Supprimer définitivement'; }
              return;
            }
            window.LH3.components.toast.show(manager.name + ' supprimé', 'success');
            window.LH3.components.modal.close();
            rerenderManagers();
          },
        },
      ],
    });
  }

  function buildManagerRow(manager, rerenderManagers) {
    return el('div', { className: 'boost-row' }, [
      el('div', { className: 'boost-label' }, [manager.name + (manager.coach && manager.coach.name ? ' (Coach ' + manager.coach.name + ')' : '')]),
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
        el('span', { className: 'muted small' }, [(manager.pe || 0) + ' PE']),
        el('button', { className: 'btn btn-sm btn-ghost', onClick: () => confirmRemoveManager(manager, rerenderManagers) }, ['Supprimer']),
      ]),
    ]);
  }

  function buildManagersSection(root) {
    root.appendChild(el('div', { className: 'section-title' }, ['👥 Managers de la ligue']));
    const managersCard = el('div', { className: 'card' });
    root.appendChild(managersCard);

    function rerenderManagers() {
      managersCard.innerHTML = '';
      const managers = window.LH3.services.managerService.listManagers();
      if (!managers.length) {
        managersCard.appendChild(el('div', { className: 'muted small' }, ['Aucun manager pour le moment.']));
        return;
      }
      managers.forEach((m) => managersCard.appendChild(buildManagerRow(m, rerenderManagers)));
    }
    rerenderManagers();
  }

  window.LH3.pages.admin = { render };
})();
