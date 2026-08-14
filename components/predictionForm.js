/**
 * La Hulpe 3 Fantasy Manager — Formulaire pronostic / résultat
 *
 * Composant réutilisé à la fois pour :
 *  - qu'un manager encode son pronostic (page Pronostics)
 *  - que l'admin encode le résultat officiel (page Administration)
 * Les deux partagent exactement la même forme de données.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.components = window.LH3.components || {};

  const { el, escapeHtml } = window.LH3.utils.dom;

  function build(opts) {
    const players = window.LH3.services.playerService.listPlayers();
    const initial = opts.initialData || {};
    const state = {
      scoreFor: initial.scoreFor !== undefined ? initial.scoreFor : null,
      scoreAgainst: initial.scoreAgainst !== undefined ? initial.scoreAgainst : null,
      totalTries: initial.totalTries !== undefined ? initial.totalTries : null,
      tryScorers: new Set(initial.tryScorers || []),
      manOfMatchId: initial.manOfMatchId || null,
      blunderId: initial.blunderId || null,
    };

    const derivedRow = el('div', { className: 'derived-row' });
    function refreshDerived() {
      derivedRow.innerHTML = '';
      const d = window.LH3.services.predictionService.derive(state.scoreFor, state.scoreAgainst);
      if (d.result === null) {
        derivedRow.appendChild(el('span', { className: 'muted small' }, ['Renseigne le score pour voir le résultat déduit.']));
        return;
      }
      const label = { V: 'Victoire', N: 'Nul', D: 'Défaite' }[d.result];
      const cls = { V: 'badge-green', N: 'badge-blue', D: 'badge-red' }[d.result];
      derivedRow.appendChild(el('span', { className: 'badge ' + cls }, [label]));
      derivedRow.appendChild(el('span', { className: 'badge' }, ['Écart : ' + d.difference + ' pts']));
      derivedRow.appendChild(el('span', { className: 'badge' }, ['Total : ' + d.totalPoints + ' pts']));
    }

    const scoreForInput = el('input', {
      type: 'number', className: 'score-input', min: '0', value: state.scoreFor,
      placeholder: '–',
      onInput: (e) => { state.scoreFor = e.target.value === '' ? null : parseInt(e.target.value, 10); refreshDerived(); },
    });
    const scoreAgainstInput = el('input', {
      type: 'number', className: 'score-input', min: '0', value: state.scoreAgainst,
      placeholder: '–',
      onInput: (e) => { state.scoreAgainst = e.target.value === '' ? null : parseInt(e.target.value, 10); refreshDerived(); },
    });

    const scoreBoard = el('div', { className: 'score-board' }, [
      el('div', { className: 'score-team' }, [
        el('div', { className: 'lbl' }, [opts.homeLabel || 'La Hulpe 3']),
        scoreForInput,
      ]),
      el('div', { className: 'score-sep' }, ['–']),
      el('div', { className: 'score-team' }, [
        el('div', { className: 'lbl' }, [opts.awayLabel || 'Adversaire']),
        scoreAgainstInput,
      ]),
    ]);

    const triesInput = el('input', {
      type: 'number', min: '0', value: state.totalTries, placeholder: 'Ex: 4',
      onInput: (e) => { state.totalTries = e.target.value === '' ? null : parseInt(e.target.value, 10); },
    });

    // ── Marqueurs d'essai (multi-select) ──
    // Le plafond ne s'applique qu'aux vrais pronostics : quand l'admin encode
    // le résultat officiel (scoringHint: false), un match peut très bien
    // avoir eu plus de `maxScorers` marqueurs différents dans la réalité.
    const isPrediction = opts.scoringHint !== false;
    const pe = window.LH3.data.CONFIG.pe;
    const maxScorers = window.LH3.data.CONFIG.maxTryScorerPicks;
    const scorerHintText = `+${pe.perCorrectTryScorer} PE si le joueur marque vraiment, ${pe.perWrongTryScorer} PE si tu coches un joueur qui ne marque pas — maximum ${maxScorers} marqueurs par pronostic, vise juste plutôt que de cocher large.`;
    // Popover au clic plutôt qu'un simple `title` (jamais déclenché par un tap
    // sur mobile, et rien ne se passe pour qui clique au lieu de survoler) —
    // se rouvre/referme au clic sur l'icône elle-même, pas de fermeture au
    // clic extérieur pour éviter d'accumuler des listeners sur `document` à
    // chaque re-rendu du formulaire.
    const scorerInfoPopover = el('div', { className: 'info-popover hidden' }, [scorerHintText]);
    const scorerInfoIcon = el('span', {
      className: 'info-hint',
      onClick: (e) => { e.stopPropagation(); scorerInfoPopover.classList.toggle('hidden'); },
    }, ['ⓘ']);
    const scorerInfoIconWrap = el('span', { className: 'info-hint-wrap' }, [scorerInfoIcon, scorerInfoPopover]);
    const scorerPicker = el('div', { className: 'scorer-picker' });
    const scorerCount = isPrediction ? el('div', { className: 'muted small' }) : null;
    function refreshScorerCount() {
      if (scorerCount) scorerCount.textContent = `${state.tryScorers.size} / ${maxScorers} sélectionnés`;
    }
    players.forEach((p) => {
      const chip = el('div', {
        className: 'scorer-chip' + (state.tryScorers.has(p.id) ? ' active' : ''),
        onClick: () => {
          if (state.tryScorers.has(p.id)) {
            state.tryScorers.delete(p.id);
          } else {
            if (isPrediction && state.tryScorers.size >= maxScorers) {
              window.LH3.components.toast.show(`Maximum ${maxScorers} marqueurs par pronostic.`, 'error');
              return;
            }
            state.tryScorers.add(p.id);
          }
          chip.classList.toggle('active');
          refreshScorerCount();
        },
      });
      chip.innerHTML = window.LH3.utils.avatar.renderAvatar(p.name, p.avatarUrl, 22) + `<span>${escapeHtml(p.name)}</span>`;
      scorerPicker.appendChild(chip);
    });
    refreshScorerCount();

    function buildSinglePicker(stateKey) {
      const wrap = el('div', { className: 'single-picker' });
      players.forEach((p) => {
        const item = el('div', {
          className: 'pick-item' + (state[stateKey] === p.id ? ' active' : ''),
          onClick: () => {
            state[stateKey] = state[stateKey] === p.id ? null : p.id;
            window.LH3.utils.dom.qsa('.pick-item', wrap).forEach((n) => n.classList.remove('active'));
            if (state[stateKey] === p.id) item.classList.add('active');
          },
        });
        item.innerHTML = window.LH3.utils.avatar.renderAvatar(p.name, p.avatarUrl, 24) + `<span>${escapeHtml(p.name)}</span>`;
        wrap.appendChild(item);
      });
      return wrap;
    }

    refreshDerived();

    const form = el('div', { className: 'prediction-form' }, [
      scoreBoard,
      derivedRow,
      el('div', { className: 'field', style: { marginTop: '20px' } }, [
        el('label', {}, ['Nombre total d\'essais (les deux équipes)']),
        triesInput,
      ]),
      el('div', { className: 'field' }, [
        el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' } }, [
          el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
            el('label', {}, ['Joueurs qui marqueront un essai']),
            isPrediction ? scorerInfoIconWrap : null,
          ]),
          scorerCount,
        ]),
        scorerPicker,
      ]),
      el('div', { className: 'field' }, [
        el('label', {}, ['Homme du match']),
        buildSinglePicker('manOfMatchId'),
      ]),
      el('div', { className: 'field' }, [
        el('label', {}, ['Boulette du match 🙈']),
        buildSinglePicker('blunderId'),
      ]),
    ]);

    return {
      node: form,
      getData() {
        return {
          scoreFor: state.scoreFor,
          scoreAgainst: state.scoreAgainst,
          totalTries: state.totalTries,
          tryScorers: Array.from(state.tryScorers),
          manOfMatchId: state.manOfMatchId,
          blunderId: state.blunderId,
        };
      },
    };
  }

  window.LH3.components.predictionForm = { build };
})();
