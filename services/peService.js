/**
 * La Hulpe 3 Fantasy Manager — Points d'Expérience & Prestige
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.services = window.LH3.services || {};

  const CONFIG = () => window.LH3.data.CONFIG;

  function addPe(manager, amount) {
    manager.pe = (manager.pe || 0) + amount;
    return manager.pe;
  }

  function prestigeInfo(manager) {
    const levels = CONFIG().prestige.levels;
    const pe = manager.pe || 0;
    const flooredPe = Math.max(0, pe); // paliers/barre de progression jamais négatifs
    let current = levels[0];
    for (const lvl of levels) {
      if (flooredPe >= lvl.peRequired) current = lvl;
    }
    const next = levels.find((l) => l.peRequired > flooredPe) || null;
    return {
      level: current.level,
      name: current.name,
      pe, // valeur brute (honnête, peut être négative) — pour l'affichage du compteur
      next,
      peToNext: next ? next.peRequired - flooredPe : 0,
      progressPct: next
        ? Math.round(((flooredPe - current.peRequired) / (next.peRequired - current.peRequired)) * 100)
        : 100,
    };
  }

  window.LH3.services.peService = { addPe, prestigeInfo };
})();
