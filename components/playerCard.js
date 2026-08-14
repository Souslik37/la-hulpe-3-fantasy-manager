/**
 * La Hulpe 3 Fantasy Manager — Carte joueur (sensation "collection")
 *
 * `card` = objet renvoyé par playerService.getCard(manager, playerId).
 * Renvoie une chaîne HTML (pas d'event listeners attachés ici — les pages
 * délèguent les clics via [data-player-id] sur le conteneur parent).
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.components = window.LH3.components || {};

  function render(card, opts) {
    opts = opts || {};
    const { escapeHtml } = window.LH3.utils.dom;
    const { rarityLabel } = window.LH3.utils.format;
    const CONFIG = window.LH3.data.CONFIG;

    const classes = ['player-card', 'rarity-' + card.rarity];
    if (opts.compact) classes.push('compact');
    if (opts.selected) classes.push('selected');
    if (opts.lifted) classes.push('lifted');

    const avatar = window.LH3.utils.avatar.renderAvatar(card.name, card.avatarUrl, opts.compact ? 36 : 58);
    const attrList = opts.compact ? [] : CONFIG.attributes.slice(0, opts.attrCount || 8);

    const attrsHtml = opts.hideAttrs || opts.compact ? '' : `
      <div class="pc-divider"></div>
      <div class="pc-attrs">
        ${attrList.map((a, i) => `
          <div class="pc-attr">
            <span>${a.short}</span>
            <span class="pc-attr-track"><span class="pc-attr-fill" style="width:${card.attributes[a.key]}%;animation-delay:${i * 35}ms"></span></span>
            <b>${card.attributes[a.key]}</b>
          </div>
        `).join('')}
      </div>`;

    const style = opts.delay ? ` style="animation-delay:${opts.delay}ms"` : '';

    return `
      <div class="${classes.join(' ')}" data-player-id="${escapeHtml(card.id)}"${style}>
        ${opts.roles && opts.roles.length ? `<div class="pc-role-badge">${opts.roles.join(' · ')}</div>` : ''}
        ${opts.compact ? '' : `<div class="pc-rarity-label">${rarityLabel(card.rarity)}</div>`}
        ${opts.compact ? '' : `<div class="pc-overall">${card.overall}</div>`}
        <div class="pc-avatar-wrap">${avatar}</div>
        <div class="pc-body">
          ${opts.compact ? `<div class="pc-overall">${card.overall}</div>` : ''}
          <div class="pc-name">${escapeHtml(card.name)}</div>
          ${opts.compact ? `<div class="pc-rarity-label">${rarityLabel(card.rarity)}</div>` : ''}
        </div>
        ${attrsHtml}
      </div>
    `;
  }

  window.LH3.components.playerCard = { render };
})();
