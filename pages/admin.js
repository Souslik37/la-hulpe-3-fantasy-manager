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

  function confirmUnfinalizeMatch(match, rerender) {
    window.LH3.components.modal.open({
      title: 'Annuler le résultat de J' + match.matchday + ' ?',
      body: el('div', {}, [
        el('p', { className: 'small' }, ['Les PE distribués pour cette journée sont repris à tout le monde, le résultat est effacé, et la journée redevient verrouillée. Les pronostics déjà soumis restent intacts. Utile si c\'était un essai.']),
      ]),
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Annuler le résultat',
          className: 'btn-primary',
          closeOnClick: false,
          onClick: async (btn) => {
            if (btn) { btn.disabled = true; btn.textContent = 'Annulation...'; }
            const res = await window.LH3.services.seasonService.unfinalizeMatch(match.id);
            if (!res.ok) {
              window.LH3.components.toast.show(res.reason, 'error');
              if (btn) { btn.disabled = false; btn.textContent = 'Annuler le résultat'; }
              return;
            }
            window.LH3.components.toast.show('Résultat annulé, PE repris ✅', 'success');
            window.LH3.components.modal.close();
            rerender();
          },
        },
      ],
    });
  }

  function confirmRemoveMatch(match, rerender) {
    const wasPlayed = match.status === 'termine';
    window.LH3.components.modal.open({
      title: 'Supprimer J' + match.matchday + ' — ' + match.opponent + ' ?',
      body: el('div', {}, [
        el('p', { className: 'small' }, [
          wasPlayed
            ? 'Cette journée était déjà notée : les PE distribués sont repris avant suppression, et les pronostics associés disparaissent définitivement.'
            : 'Les pronostics associés disparaissent définitivement.',
        ]),
      ]),
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Supprimer définitivement',
          className: 'btn-primary',
          closeOnClick: false,
          onClick: async (btn) => {
            if (btn) { btn.disabled = true; btn.textContent = 'Suppression...'; }
            const res = await window.LH3.services.seasonService.removeMatch(match.id);
            if (!res.ok) {
              window.LH3.components.toast.show(res.reason, 'error');
              if (btn) { btn.disabled = false; btn.textContent = 'Supprimer définitivement'; }
              return;
            }
            window.LH3.components.toast.show('Match supprimé', 'success');
            window.LH3.components.modal.close();
            rerender();
          },
        },
      ],
    });
  }

  function openAddMatchModal(rerender) {
    const matchdayInput = el('input', { type: 'number', min: '1', placeholder: 'Ex : 15' });
    const opponentInput = el('input', { type: 'text', placeholder: 'Ex : Adversaire (demi-finale)' });
    const dateInput = el('input', { type: 'date' });

    const modal = window.LH3.components.modal.open({
      title: 'Ajouter un match',
      body: el('div', {}, [
        el('div', { className: 'field' }, [el('label', {}, ['Numéro de journée']), matchdayInput]),
        el('div', { className: 'field' }, [el('label', {}, ['Adversaire']), opponentInput]),
        el('div', { className: 'field' }, [el('label', {}, ['Date']), dateInput]),
      ]),
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Ajouter',
          className: 'btn-primary',
          closeOnClick: false,
          onClick: async (btn) => {
            if (btn) { btn.disabled = true; btn.textContent = 'Ajout en cours...'; }
            const res = await window.LH3.services.seasonService.addMatch({
              matchday: matchdayInput.value, opponent: opponentInput.value, date: dateInput.value,
            });
            if (!res.ok) {
              window.LH3.components.toast.show(res.reason, 'error');
              if (btn) { btn.disabled = false; btn.textContent = 'Ajouter'; }
              return;
            }
            window.LH3.components.toast.show('Match ajouté ✅', 'success');
            window.LH3.components.modal.close();
            rerender();
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

    const actions = [el('button', { className: 'btn btn-sm', onClick: () => openResultModal(match, rerender) }, [match.result ? 'Modifier résultat' : 'Encoder résultat'])];
    if (match.status === 'termine') {
      actions.push(el('button', { className: 'btn btn-sm btn-ghost', onClick: () => confirmUnfinalizeMatch(match, rerender) }, ['Annuler résultat']));
    }
    actions.push(el('button', { className: 'btn btn-sm btn-ghost', onClick: () => confirmRemoveMatch(match, rerender) }, ['Supprimer']));

    return el('div', { className: 'card', style: { display: 'grid', gridTemplateColumns: '50px 1.4fr 1fr 1fr auto', gap: '10px', alignItems: 'center', padding: '12px 16px', marginBottom: '8px' } }, [
      el('div', { className: 'muted', style: { fontWeight: '800' } }, ['J' + match.matchday]),
      opponentInput,
      dateInput,
      statusSelect,
      el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, actions),
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

  function confirmRemovePeriod(period, rerenderPresence) {
    const evaluated = Object.keys(period.ratings || {}).length > 0;
    window.LH3.components.modal.open({
      title: 'Supprimer "' + period.label + '" ?',
      body: el('div', {}, [
        el('p', { className: 'small' }, [
          evaluated
            ? 'Cette période était déjà distribuée : les PE sont repris à tout le monde avant suppression.'
            : 'Cette période d\'assiduité disparaît définitivement du calendrier.',
        ]),
      ]),
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Supprimer définitivement',
          className: 'btn-primary',
          closeOnClick: false,
          onClick: async (btn) => {
            if (btn) { btn.disabled = true; btn.textContent = 'Suppression...'; }
            const res = await window.LH3.services.presenceService.removePeriod(period.id);
            if (!res.ok) {
              window.LH3.components.toast.show(res.reason, 'error');
              if (btn) { btn.disabled = false; btn.textContent = 'Supprimer définitivement'; }
              return;
            }
            window.LH3.components.toast.show('Période supprimée', 'success');
            window.LH3.components.modal.close();
            rerenderPresence();
          },
        },
      ],
    });
  }

  function openAddPeriodModal(rerenderPresence) {
    const labelInput = el('input', { type: 'text', placeholder: 'Ex : Fin novembre' });
    const dateInput = el('input', { type: 'date' });

    const modal = window.LH3.components.modal.open({
      title: 'Ajouter une période d\'assiduité',
      body: el('div', {}, [
        el('div', { className: 'field' }, [el('label', {}, ['Nom de la période']), labelInput]),
        el('div', { className: 'field' }, [el('label', {}, ['Date']), dateInput]),
      ]),
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Ajouter',
          className: 'btn-primary',
          closeOnClick: false,
          onClick: async (btn) => {
            if (btn) { btn.disabled = true; btn.textContent = 'Ajout en cours...'; }
            const res = await window.LH3.services.presenceService.addPeriod({ label: labelInput.value, date: dateInput.value });
            if (!res.ok) {
              window.LH3.components.toast.show(res.reason, 'error');
              if (btn) { btn.disabled = false; btn.textContent = 'Ajouter'; }
              return;
            }
            window.LH3.components.toast.show('Période ajoutée ✅', 'success');
            window.LH3.components.modal.close();
            rerenderPresence();
          },
        },
      ],
    });
    return modal;
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

    const actions = [el('button', { className: 'btn btn-sm', onClick: () => openEvaluatePeriodModal(period, rerenderPresence) }, [evaluated ? 'Ré-évaluer' : 'Évaluer'])];
    if (evaluated) {
      actions.push(el('button', { className: 'btn btn-sm btn-ghost', onClick: () => confirmResetPeriod(period, rerenderPresence) }, ['Réinitialiser']));
    }
    actions.push(el('button', { className: 'btn btn-sm btn-ghost', onClick: () => confirmRemovePeriod(period, rerenderPresence) }, ['Supprimer']));

    return el('div', { className: 'card', style: { display: 'grid', gridTemplateColumns: '1.4fr 1fr auto auto', gap: '10px', alignItems: 'center', padding: '12px 16px', marginBottom: '8px' } }, [
      labelInput,
      dateInput,
      el('span', { className: 'badge' + (evaluated ? ' badge-green' : '') }, [evaluated ? '✅ Distribué' : '🔜 À venir']),
      el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, actions),
    ]);
  }

  // ── Événements du club (bonus fun ponctuels, séparés des PE) ────────────
  function openCreateEventModal(rerenderEvents) {
    const titleInput = el('input', { type: 'text', placeholder: 'Ex : Braderie de La Hulpe' });
    const iconInput = el('input', { type: 'text', placeholder: '🎉 (optionnel)' });
    const amountInput = el('input', { type: 'number', min: '1', placeholder: 'Ex : 100' });
    const dateInput = el('input', { type: 'date' });
    dateInput.valueAsDate = new Date();

    const attrSelect = el('select', {}, [
      el('option', { value: '' }, ['Aucune suggestion particulière']),
      ...window.LH3.data.CONFIG.attributes.map((a) => el('option', { value: a.key }, [a.icon + ' ' + a.label])),
    ]);

    const modal = window.LH3.components.modal.open({
      title: 'Créer un événement',
      body: el('div', {}, [
        el('div', { className: 'field' }, [el('label', {}, ['Nom de l\'événement']), titleInput]),
        el('div', { className: 'field' }, [el('label', {}, ['Icône']), iconInput]),
        el('div', { className: 'field' }, [el('label', {}, ['PE offerts à chaque manager']), amountInput]),
        el('div', { className: 'field' }, [el('label', {}, ['Date']), dateInput]),
        el('div', { className: 'field' }, [el('label', {}, ['Suggestion d\'attribut (optionnel)']), attrSelect]),
        el('div', { className: 'field-hint' }, [
          'Donne du vrai PE à tout le monde — même monnaie unique que les matchs, entièrement libre. La suggestion d\'attribut n\'est qu\'une indication affichée dans le journal ("à mettre sur Troisième mi-temps par exemple") : personne n\'est obligé de la suivre.',
        ]),
      ]),
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Créer et distribuer',
          className: 'btn-primary',
          closeOnClick: false,
          onClick: async (btn) => {
            if (btn) { btn.disabled = true; btn.textContent = 'Distribution en cours...'; }
            const res = await window.LH3.services.eventService.createEvent({
              title: titleInput.value, icon: iconInput.value, amount: amountInput.value, date: dateInput.value,
              attributeKey: attrSelect.value || null,
            });
            if (!res.ok) {
              window.LH3.components.toast.show(res.reason, 'error');
              if (btn) { btn.disabled = false; btn.textContent = 'Créer et distribuer'; }
              return;
            }
            window.LH3.components.toast.show('Événement créé, bonus distribué ✅', 'success');
            window.LH3.components.modal.close();
            rerenderEvents();
          },
        },
      ],
    });
    return modal;
  }

  function confirmRemoveEvent(event, rerenderEvents) {
    window.LH3.components.modal.open({
      title: 'Annuler "' + event.title + '" ?',
      body: el('div', {}, [
        el('p', { className: 'small' }, [
          'Les ' + event.amount + ' PE distribués sont repris à tout le monde, et l\'événement disparaît du journal.',
        ]),
      ]),
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Confirmer l\'annulation',
          className: 'btn-primary',
          closeOnClick: false,
          onClick: async (btn) => {
            if (btn) { btn.disabled = true; btn.textContent = 'Annulation...'; }
            const res = await window.LH3.services.eventService.removeEvent(event.id);
            if (!res.ok) {
              window.LH3.components.toast.show(res.reason, 'error');
              if (btn) { btn.disabled = false; btn.textContent = 'Confirmer l\'annulation'; }
              return;
            }
            window.LH3.components.toast.show('Événement annulé', 'success');
            window.LH3.components.modal.close();
            rerenderEvents();
          },
        },
      ],
    });
  }

  function buildEventRow(event, rerenderEvents) {
    return el('div', { className: 'card', style: { display: 'grid', gridTemplateColumns: '40px 1.4fr 1fr auto auto', gap: '10px', alignItems: 'center', padding: '12px 16px', marginBottom: '8px' } }, [
      el('div', { style: { fontSize: '22px', textAlign: 'center' } }, [event.icon]),
      el('div', {}, [
        el('div', { style: { fontWeight: '750' } }, [event.title]),
        event.attributeKey ? el('div', { className: 'muted small' }, ['Suggéré : ' + window.LH3.services.eventService.attributeLabel(event.attributeKey)]) : null,
      ]),
      el('div', { className: 'muted small' }, [window.LH3.utils.format.formatDateFr(event.date)]),
      el('span', { className: 'badge badge-green' }, ['+' + event.amount + ' PE']),
      el('button', { className: 'btn btn-sm btn-ghost', onClick: () => confirmRemoveEvent(event, rerenderEvents) }, ['Annuler']),
    ]);
  }

  function buildEventsSection(root) {
    root.appendChild(el('div', { className: 'section-title' }, [
      '🎉 Événements du club',
      el('span', { className: 'see-all', onClick: () => openCreateEventModal(rerenderEvents) }, ['+ Créer un événement']),
    ]));
    root.appendChild(el('p', { className: 'muted small', style: { marginBottom: '10px' } }, [
      'Bonus ponctuels et purement fun, quand tu veux — complètement séparés des PE, aucun impact sur le classement ni les attributs.',
    ]));
    const list = el('div', {});
    root.appendChild(list);

    function rerenderEvents() {
      list.innerHTML = '';
      const events = window.LH3.services.eventService.listEvents();
      if (!events.length) {
        list.appendChild(el('div', { className: 'muted small' }, ['Aucun événement pour le moment.']));
        return;
      }
      events.forEach((e) => list.appendChild(buildEventRow(e, rerenderEvents)));
    }
    rerenderEvents();
  }

  function buildPresenceSection(root) {
    root.appendChild(el('div', { className: 'section-title' }, [
      '🙌 Assiduité',
      el('span', { className: 'see-all', onClick: () => openAddPeriodModal(rerenderPresence) }, ['+ Ajouter une période']),
    ]));
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
    const avatarFileInput = el('input', {
      type: 'file', accept: 'image/*', className: 'avatar-file-input',
      onChange: async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        let dataUri;
        try {
          dataUri = await window.LH3.utils.imageResize.toDataUri(file);
        } catch (err) {
          console.error('[admin] échec traitement photo joueur', err);
          window.LH3.components.toast.show('Impossible de traiter cette photo — réessaie avec une autre.', 'error');
          return;
        }
        const res = await window.LH3.services.rosterService.setPlayerAvatar(player.id, dataUri);
        if (!res.ok) { window.LH3.components.toast.show(res.reason, 'error'); return; }
        window.LH3.components.toast.show('Avatar de ' + player.name + ' mis à jour ✅', 'success');
        rerenderRoster();
      },
    });
    const avatarCell = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, [
      avatarInput,
      avatarFileInput,
    ]);

    return el('div', {
      className: 'card', style: { display: 'grid', gridTemplateColumns: '40px 1fr 1.6fr auto', gap: '10px', alignItems: 'center', padding: '10px 16px', marginBottom: '6px' },
    }, [
      avatarBox,
      nameInput,
      avatarCell,
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

    root.appendChild(el('div', { className: 'section-title' }, [
      '📅 Calendrier de la saison',
      el('span', { className: 'see-all', onClick: () => openAddMatchModal(rerender) }, ['+ Ajouter un match']),
    ]));
    const list = el('div', {});
    root.appendChild(list);

    function rerender() {
      list.innerHTML = '';
      window.LH3.services.seasonService.listMatches().forEach((m) => list.appendChild(buildMatchRow(m, rerender)));
    }
    rerender();

    buildEventsSection(root);
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
