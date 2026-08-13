/**
 * La Hulpe 3 Fantasy Manager — Carte coach
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.components = window.LH3.components || {};

  function render(coach, opts) {
    opts = opts || {};
    const { escapeHtml } = window.LH3.utils.dom;
    const avatar = window.LH3.utils.avatar.renderAvatar(coach.name || '?', coach.avatarUrl, 78);
    const hasContent = coach.name;

    if (!hasContent) {
      return `
        <div class="card coach-card">
          <div class="pc-body">
            <div class="coach-name muted">Pas encore de coach</div>
            <div class="coach-meta">Crée ton coach pour donner une identité à ton équipe.</div>
          </div>
        </div>`;
    }

    const tags = [
      coach.previousJob ? `<span class="badge">💼 ${escapeHtml(coach.previousJob)}</span>` : '',
      coach.accent ? `<span class="badge badge-blue">🗣️ ${escapeHtml(coach.accent)}</span>` : '',
      coach.managementStyle ? `<span class="badge badge-yellow">🎯 ${escapeHtml(coach.managementStyle)}</span>` : '',
    ].filter(Boolean).join('');

    return `
      <div class="card coach-card">
        ${avatar}
        <div class="pc-body">
          <div class="coach-name">${escapeHtml(coach.name)}</div>
          <div class="coach-tags">${tags}</div>
          ${coach.quote ? `<div class="coach-quote">“${escapeHtml(coach.quote)}”</div>` : ''}
          ${coach.story && !opts.hideStory ? `<div class="coach-story">${escapeHtml(coach.story)}</div>` : ''}
        </div>
      </div>`;
  }

  window.LH3.components.coachCard = { render };
})();
