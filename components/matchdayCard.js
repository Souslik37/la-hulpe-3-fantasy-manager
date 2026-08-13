/**
 * La Hulpe 3 Fantasy Manager — Carte journée de calendrier
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.components = window.LH3.components || {};

  const STATUS_LABEL = { verrouille: 'Verrouillé', ouvert: 'Ouvert', termine: 'Terminé' };

  function render(match) {
    const { escapeHtml } = window.LH3.utils.dom;
    const { formatDateFr } = window.LH3.utils.format;

    const scoreHtml = match.status === 'termine' && match.result
      ? `<div class="md-score">${match.result.scoreFor} – ${match.result.scoreAgainst}</div>`
      : '';

    return `
      <div class="matchday-card" data-match-id="${escapeHtml(match.id)}">
        <div class="md-num">Journée ${match.matchday}</div>
        <div class="md-opp">${escapeHtml(match.opponent)}</div>
        <div class="md-date">${formatDateFr(match.date)}</div>
        <div class="badge" style="margin-top:10px">
          <span class="status-dot ${match.status}"></span>${STATUS_LABEL[match.status]}
        </div>
        ${scoreHtml}
      </div>`;
  }

  window.LH3.components.matchdayCard = { render, STATUS_LABEL };
})();
