/**
 * La Hulpe 3 Fantasy Manager — Formatage (dates, nombres, rareté)
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.utils = window.LH3.utils || {};

  const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function parseIsoDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDateFr(iso, opts) {
    opts = opts || {};
    const d = parseIsoDate(iso);
    const day = DAYS[d.getDay()];
    const month = MONTHS[d.getMonth()];
    if (opts.short) return `${d.getDate()} ${month.slice(0, 3)}`;
    return `${opts.capitalize === false ? day : day[0].toUpperCase() + day.slice(1)} ${d.getDate()} ${month} ${d.getFullYear()}`;
  }

  function daysUntil(iso) {
    const target = parseIsoDate(iso);
    target.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.round((target - now) / 86400000);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function formatSigned(n) {
    return (n > 0 ? '+' : '') + n;
  }

  // Classe de badge selon le signe d'un delta de PE (gagné en vert, perdu en
  // rouge, nul en neutre) — utilisé partout où un récap de journée affiche
  // un gain/perte net qui peut désormais être négatif (pénalité marqueurs).
  function peBadgeClass(n) {
    if (n > 0) return 'badge-green';
    if (n < 0) return 'badge-red';
    return 'badge';
  }

  function rarityFromOverall(overall) {
    const CONFIG = window.LH3.data.CONFIG;
    const order = CONFIG.rarity.order;
    for (let i = order.length - 1; i >= 0; i--) {
      const tier = CONFIG.rarity.tiers[order[i]];
      if (overall >= tier.min) return order[i];
    }
    return order[0];
  }

  function rarityLabel(key) {
    return window.LH3.data.CONFIG.rarity.tiers[key].label;
  }

  function starsHtml(overall, max) {
    max = max || 5;
    const filled = Math.round((overall / 100) * max);
    return '★'.repeat(filled) + '☆'.repeat(max - filled);
  }

  window.LH3.utils.format = {
    parseIsoDate, formatDateFr, daysUntil, clamp, formatSigned, peBadgeClass,
    rarityFromOverall, rarityLabel, starsHtml,
  };
})();
