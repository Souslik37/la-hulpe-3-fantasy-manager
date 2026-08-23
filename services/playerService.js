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

  /** Remet tous les attributs d'un manager à leur base (50 partout) — les points dépensés redeviennent disponibles. */
  function resetBoosts(manager) {
    manager.playerBoosts = {};
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

    const newValue = base.baseAttributes[attrKey] + newDelta;
    if (newValue > CONFIG().season.maxAttribute) {
      return { ok: false, reason: `Plafond de ${CONFIG().season.maxAttribute} atteint.` };
    }

    if (delta > 0 && pointsRemaining(manager) < delta) {
      return { ok: false, reason: 'Plus assez de points disponibles.' };
    }

    manager.playerBoosts[playerId][attrKey] = newDelta;
    return { ok: true };
  }

  window.LH3.services.playerService = {
    getPlayerBase, listPlayers, computeOverall, getMergedAttributes,
    getCard, getAllCards, teamOverall, pointsSpent, pointsAvailable, pointsRemaining, adjustAttribute, resetBoosts,
  };
})();
