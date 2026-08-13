/**
 * La Hulpe 3 Fantasy Manager — Stats communautaires
 *
 * Purement des lectures agrégées sur les managers déjà chargés en mémoire
 * (state.managers contient TOUT le monde depuis le boot, pas que le manager
 * actif — voir storageService.loadInitialState). Aucune écriture ici.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.services = window.LH3.services || {};

  /** Poste occupé par playerId chez CE manager, ou 'Banc', ou null si absent de son effectif. */
  function positionForManager(manager, playerId) {
    const idx = manager.squad.starters.indexOf(playerId);
    if (idx > -1) {
      const pos = window.LH3.data.positionAtIndex(idx);
      return pos ? pos.label : null;
    }
    if (manager.squad.bench.indexOf(playerId) > -1) return 'Banc';
    return null; // effectif de ce manager antérieur à l'ajout de ce joueur
  }

  /**
   * Répartition des postes occupés par un joueur donné, tous managers
   * confondus. Les pourcentages sont calculés sur le nombre TOTAL de
   * managers (pas seulement ceux qui l'ont dans leur effectif) : un joueur
   * absent de l'effectif compte comme "pas placé", ce qui reflète bien la
   * question "quelle part des managers l'ont mis à tel poste".
   */
  function positionBreakdown(playerId) {
    const managers = window.LH3.services.managerService.listManagers();
    const counts = {};
    managers.forEach((m) => {
      const label = positionForManager(m, playerId);
      if (!label) return;
      counts[label] = (counts[label] || 0) + 1;
    });
    const entries = Object.entries(counts)
      .map(([label, count]) => ({ label, count, pct: managers.length ? Math.round((count / managers.length) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
    return {
      totalManagers: managers.length,
      entries,
      top: entries[0] || null,
    };
  }

  /** Un objet { player, breakdown } par joueur du roster, pour la page Communauté. */
  function allPositionBreakdowns() {
    return window.LH3.services.playerService.listPlayers()
      .map((p) => ({ player: p, breakdown: positionBreakdown(p.id) }))
      .filter((x) => x.breakdown.top);
  }

  window.LH3.services.communityService = { positionBreakdown, allPositionBreakdowns };
})();
