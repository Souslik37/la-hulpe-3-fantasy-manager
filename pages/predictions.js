/**
 * La Hulpe 3 Fantasy Manager — Page Pronostics
 *
 * Navigation entre journées (◀ ▶) : ne présuppose plus qu'une seule journée
 * peut être ouverte à la fois. Par défaut on affiche la journée actuellement
 * ouverte (ou la première si aucune ne l'est), mais on peut naviguer vers
 * n'importe quelle journée pour la consulter (verrouillée/terminée) ou la
 * pronostiquer (ouverte).
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.pages = window.LH3.pages || {};

  const { el } = window.LH3.utils.dom;

  let currentMatchday = null; // numéro de journée affiché ; null = pas encore initialisé

  function buildNav(matches) {
    return el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' } }, [
      el('button', {
        className: 'btn btn-sm',
        disabled: currentMatchday <= 1,
        onClick: () => { currentMatchday -= 1; render(document.getElementById('page-root')); },
      }, ['← Journée précédente']),
      el('div', { className: 'muted small' }, [`Journée ${currentMatchday} / ${matches.length}`]),
      el('button', {
        className: 'btn btn-sm',
        disabled: currentMatchday >= matches.length,
        onClick: () => { currentMatchday += 1; render(document.getElementById('page-root')); },
      }, ['Journée suivante →']),
    ]);
  }

  function buildOpenForm(manager, match) {
    const existing = window.LH3.services.predictionService.getPrediction(manager, match.id);
    const alreadySubmitted = existing.submittedAt !== null;

    const card = el('div', { className: 'card' });
    card.appendChild(el('div', { style: { marginBottom: '18px' } }, [
      el('div', { className: 'badge badge-green' }, ['Journée ' + match.matchday + ' · ' + window.LH3.utils.format.formatDateFr(match.date)]),
      el('h2', { style: { fontSize: '19px', fontWeight: '800', marginTop: '8px' } }, ['La Hulpe 3 vs ' + match.opponent]),
      alreadySubmitted ? el('div', { className: 'muted small', style: { marginTop: '4px' } }, ['Pronostic déjà envoyé — tu peux encore le modifier tant que la journée est ouverte.']) : null,
    ]));

    const form = window.LH3.components.predictionForm.build({
      initialData: existing,
      awayLabel: match.opponent,
    });
    card.appendChild(form.node);

    card.appendChild(el('button', {
      className: 'btn btn-primary btn-block', style: { marginTop: '20px' },
      onClick: () => {
        const data = form.getData();
        if (data.scoreFor === null || data.scoreAgainst === null) {
          window.LH3.components.toast.show('Renseigne au moins le score pour valider ton pronostic.', 'error');
          return;
        }
        const res = window.LH3.services.predictionService.savePrediction(manager, match.id, data);
        if (res.ok) {
          window.LH3.components.toast.show('Pronostic enregistré ✅', 'success');
          render(document.getElementById('page-root'));
        } else {
          window.LH3.components.toast.show(res.reason, 'error');
        }
      },
    }, [alreadySubmitted ? 'Mettre à jour mon pronostic' : 'Valider mon pronostic']));

    return card;
  }

  function buildLockedView(match) {
    return el('div', { className: 'card empty-state' }, [
      el('div', { className: 'ic' }, ['🔒']),
      el('h2', { style: { fontSize: '17px', fontWeight: '800', marginBottom: '6px' } }, ['La Hulpe 3 vs ' + match.opponent]),
      el('div', {}, [window.LH3.utils.format.formatDateFr(match.date)]),
      el('div', { className: 'muted small', style: { marginTop: '10px' } }, ['Cette journée n\'est pas encore ouverte aux pronostics — reviens un peu plus tard.']),
    ]);
  }

  function buildFinishedView(manager, match) {
    const { formatSigned, peBadgeClass } = window.LH3.utils.format;
    const breakdown = manager.predictionResults && manager.predictionResults[match.id];
    return el('div', { className: 'card' }, [
      el('div', { style: { textAlign: 'center', marginBottom: '14px' } }, [
        el('div', { className: 'badge' }, ['Journée ' + match.matchday + ' · ' + window.LH3.utils.format.formatDateFr(match.date)]),
        el('h2', { style: { fontSize: '19px', fontWeight: '800', marginTop: '8px' } }, ['La Hulpe 3 vs ' + match.opponent]),
        el('div', { className: 'recap-score', style: { marginTop: '8px' } }, [match.result.scoreFor + ' – ' + match.result.scoreAgainst]),
        breakdown
          ? el('div', { className: 'badge ' + peBadgeClass(breakdown.peEarned), style: { marginTop: '10px' } }, [formatSigned(breakdown.peEarned) + ' PE sur cette journée'])
          : el('div', { className: 'muted small', style: { marginTop: '10px' } }, ['Tu n\'avais pas soumis de pronostic pour cette journée.']),
      ]),
      el('button', { className: 'btn btn-block', onClick: () => { window.location.hash = '#calendar'; } }, ['Voir le récap complet dans le Calendrier →']),
    ]);
  }

  function render(root) {
    const manager = window.LH3.services.managerService.getActiveManager();
    const matches = window.LH3.services.seasonService.listMatches();

    if (currentMatchday === null) {
      const openMatch = window.LH3.services.seasonService.getCurrentOpenMatch();
      currentMatchday = openMatch ? openMatch.matchday : 1;
    }
    currentMatchday = window.LH3.utils.format.clamp(currentMatchday, 1, matches.length);
    const match = matches.find((m) => m.matchday === currentMatchday);

    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['Pronostics']),
      el('p', {}, ['Un pronostic complet peut rapporter jusqu\'à plusieurs dizaines de PE — chaque critère compte indépendamment.']),
    ]));

    root.appendChild(buildNav(matches));

    if (!match) return;

    if (match.status === 'ouvert') root.appendChild(buildOpenForm(manager, match));
    else if (match.status === 'termine') root.appendChild(buildFinishedView(manager, match));
    else root.appendChild(buildLockedView(match));
  }

  window.LH3.pages.predictions = { render };
})();
