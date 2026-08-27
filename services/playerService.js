/**
 * La Hulpe 3 Fantasy Manager — Joueurs & attributs
 *
 * Gère la fusion "base + boosts d'un manager", le calcul de la note
 * générale, la rareté, et les règles d'incrément/décrément des attributs
 * sous contrainte du pool de points disponible.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.services = window.LH3.services || {};

  const CONFIG = () => window.LH3.data.CONFIG;

  function getPlayerBase(playerId) {
    const state = window.LH3.services.stateService.getState();
    return state.players.find((p) => p.id === playerId) || null;
  }

  /** Toujours trié par ordre alphabétique — pratique partout où il faut retrouver un joueur dans une liste (pronostics, roster...). */
  function listPlayers() {
    return window.LH3.services.stateService.getState().players.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  function computeOverall(attributes) {
    const keys = CONFIG().attributes.map((a) => a.key);
    const sum = keys.reduce((acc, k) => acc + (attributes[k] || 0), 0);
    return Math.round(sum / keys.length);
  }

  /** Fusionne les attributs de base d'un joueur avec les boosts d'un manager. */
  function getMergedAttributes(manager, playerId) {
    const base = getPlayerBase(playerId);
    if (!base) return null;
    const boosts = (manager.playerBoosts && manager.playerBoosts[playerId]) || {};
    const merged = {};
    CONFIG().attributes.forEach((a) => {
      merged[a.key] = window.LH3.utils.format.clamp(
        base.baseAttributes[a.key] + (boosts[a.key] || 0),
        0,
        CONFIG().season.maxAttribute
      );
    });
    return merged;
  }

  function getCard(manager, playerId) {
    const base = getPlayerBase(playerId);
    if (!base) return null;
    const attributes = getMergedAttributes(manager, playerId);
    const overall = computeOverall(attributes);
    return {
      id: base.id,
      name: base.name,
      avatarUrl: base.avatarUrl,
      attributes,
      overall,
      rarity: window.LH3.utils.format.rarityFromOverall(overall),
    };
  }

  function getAllCards(manager) {
    return listPlayers().map((p) => getCard(manager, p.id));
  }

  /** Note générale moyenne du XV de départ d'un manager (0 si effectif vide). */
  function teamOverall(manager) {
    const cards = manager.squad.starters.map((id) => getCard(manager, id)).filter(Boolean);
    if (!cards.length) return 0;
    return Math.round(cards.reduce((sum, c) => sum + c.overall, 0) / cards.length);
  }

  function pointsSpent(manager) {
    const boosts = manager.playerBoosts || {};
    let total = 0;
    Object.values(boosts).forEach((attrs) => {
      Object.values(attrs).forEach((v) => { total += v; });
    });
    return total;
  }

  /**
   * Remet tous les attributs d'un manager à leur base (50 partout) — les
   * points dépensés redeviennent disponibles. Limité à 1 fois par saison
   * (remis à disposition par un futur reset de saison, voir Administration) :
   * une fois utilisé, `manager.resetBoostsUsed` reste vrai et le bouton
   * correspondant se grise côté UI (voir pages/myTeam.js).
   */
  function resetBoosts(manager) {
    if (manager.resetBoostsUsed) return { ok: false, reason: 'Tu as déjà utilisé ta réinitialisation cette saison.' };
    manager.playerBoosts = {};
    manager.savedBoosts = {};
    manager.resetBoostsUsed = true;
    return { ok: true };
  }

  /** Plancher sauvegardé d'un attribut (0 si jamais sauvegardé pour ce joueur). */
  function savedFloor(manager, playerId, attrKey) {
    const saved = manager.savedBoosts && manager.savedBoosts[playerId];
    return (saved && saved[attrKey]) || 0;
  }

  /**
   * Fige la répartition ACTUELLE d'un joueur comme plancher : impossible de
   * redescendre en dessous ensuite (voir adjustAttribute), sauf en
   * réinitialisant toute l'équipe (resetBoosts, 1x/saison). On peut toujours
   * remonter au-dessus, et re-sauvegarder plus tard pour relever le plancher.
   */
  function saveBoosts(manager, playerId) {
    const current = (manager.playerBoosts && manager.playerBoosts[playerId]) || {};
    manager.savedBoosts = manager.savedBoosts || {};
    const floor = {};
    CONFIG().attributes.forEach((a) => {
      floor[a.key] = Math.max(current[a.key] || 0, savedFloor(manager, playerId, a.key));
    });
    manager.savedBoosts[playerId] = floor;
    return { ok: true };
  }

  function tierIndexForOverall(overall) {
    const order = CONFIG().rarity.order;
    for (let i = order.length - 1; i >= 0; i--) {
      if (overall >= CONFIG().rarity.tiers[order[i]].min) return i;
    }
    return 0;
  }

  /** Combien de joueurs (hors `excludePlayerId`) sont déjà au palier `tierIdx` ou au-dessus, pour ce manager. */
  function countPeersAtTierOrAbove(manager, tierIdx, excludePlayerId) {
    const minOverall = CONFIG().rarity.tiers[CONFIG().rarity.order[tierIdx]].min;
    return listPlayers().filter((p) => p.id !== excludePlayerId && getCard(manager, p.id).overall >= minOverall).length;
  }

  /**
   * Le PE EST le budget de points d'attributs — pas de conversion séparée.
   * Une série de pronostics ratés peut faire descendre le PE sous 0, mais
   * ça n'entame jamais le socle garanti de départ (plafonné à 0 minimum).
   */
  function pointsAvailable(manager) {
    return CONFIG().season.startingPoints + Math.max(0, manager.pe || 0);
  }

  function pointsRemaining(manager) {
    return pointsAvailable(manager) - pointsSpent(manager);
  }

  /**
   * Modifie l'attribut `attrKey` du joueur `playerId` de `delta` (positif ou
   * négatif) dans la limite du pool de points et du plafond par attribut.
   * Renvoie { ok: boolean, reason?: string }.
   */
  function adjustAttribute(manager, playerId, attrKey, delta) {
    const base = getPlayerBase(playerId);
    if (!base) return { ok: false, reason: 'Joueur introuvable.' };

    manager.playerBoosts = manager.playerBoosts || {};
    manager.playerBoosts[playerId] = manager.playerBoosts[playerId] || {};
    const current = manager.playerBoosts[playerId][attrKey] || 0;
    const newDelta = current + delta;

    if (newDelta < 0) return { ok: false, reason: 'Ce boost est déjà à zéro.' };
    if (delta < 0 && newDelta < savedFloor(manager, playerId, attrKey)) {
      return { ok: false, reason: 'Cette répartition a été sauvegardée — impossible de redescendre en dessous (sauf réinitialiser toute l\'équipe).' };
    }

    const newValue = base.baseAttributes[attrKey] + newDelta;
    if (newValue > CONFIG().season.maxAttribute) {
      return { ok: false, reason: `Plafond de ${CONFIG().season.maxAttribute} atteint.` };
    }

    if (delta > 0 && pointsRemaining(manager) < delta) {
      return { ok: false, reason: 'Plus assez de points disponibles.' };
    }

    if (delta > 0) {
      const currentOverall = getCard(manager, playerId).overall;
      const currentAttrs = getMergedAttributes(manager, playerId);
      const projectedOverall = computeOverall(Object.assign({}, currentAttrs, {
        [attrKey]: window.LH3.utils.format.clamp(newValue, 0, CONFIG().season.maxAttribute),
      }));
      const currentTier = tierIndexForOverall(currentOverall);
      const projectedTier = tierIndexForOverall(projectedOverall);
      if (projectedTier > currentTier) {
        const required = CONFIG().rarity.minPeersForNextTier;
        const peers = countPeersAtTierOrAbove(manager, currentTier, playerId);
        if (peers < required) {
          const tierLabel = window.LH3.utils.format.rarityLabel(CONFIG().rarity.order[currentTier]);
          return { ok: false, reason: `Il faut d'abord au moins ${required} autres joueurs ${tierLabel} ou plus avant de faire monter celui-ci au palier suivant.` };
        }
      }
    }

    manager.playerBoosts[playerId][attrKey] = newDelta;
    return { ok: true };
  }

  window.LH3.services.playerService = {
    getPlayerBase, listPlayers, computeOverall, getMergedAttributes,
    getCard, getAllCards, teamOverall, pointsSpent, pointsAvailable, pointsRemaining, adjustAttribute, resetBoosts,
    saveBoosts, savedFloor,
  };
})();
