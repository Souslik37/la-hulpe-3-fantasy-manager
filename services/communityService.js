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

  /** Poste occupé par playerId chez CE manager (titulaire uniquement), ou null s'il est sur le banc ou absent de l'effectif — le banc n'est pas un "poste de prédilection". */
  function positionForManager(manager, playerId) {
    const idx = manager.squad.starters.indexOf(playerId);
    if (idx === -1) return null;
    const pos = window.LH3.data.positionAtIndex(idx);
    return pos ? pos.label : null;
  }

  /**
   * Répartition des postes occupés par un joueur donné, parmi les managers
   * qui l'ont titularisé quelque part. Les pourcentages sont calculés sur ce
   * sous-groupe (pas sur le total de la ligue) : un joueur titularisé par un
   * seul manager, à un seul poste, affiche 100% sur ce poste — pas dilué par
   * les managers qui ne l'ont pas du tout titularisé.
   */
  function positionBreakdown(playerId) {
    const managers = window.LH3.services.managerService.listManagers();
    const counts = {};
    let startedCount = 0;
    managers.forEach((m) => {
      const label = positionForManager(m, playerId);
      if (!label) return;
      counts[label] = (counts[label] || 0) + 1;
      startedCount++;
    });
    const entries = Object.entries(counts)
      .map(([label, count]) => ({ label, count, pct: startedCount ? Math.round((count / startedCount) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
    return {
      totalManagers: managers.length,
      startedCount,
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
