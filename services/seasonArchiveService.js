/**
 * La Hulpe 3 Fantasy Manager — Archivage et reset de saison (Administration)
 *
 * Admin uniquement. Fige un instantané complet et autonome de chaque manager
 * (classement final, équipe + attributs, pronostics de la saison, assiduité)
 * dans `season_archives` — AVANT de remettre PE/attributs/compo à zéro pour
 * tout le monde et de vider calendrier/journal/assiduité/événements.
 *
 * L'archive ne dépend d'aucune table vidée juste après (voir
 * supabase/schema.sql) : elle reste lisible même une fois la saison suivante
 * bien avancée. Rien n'est écrit tant que l'archivage n'a pas réussi pour
 * tout le monde — en cas d'échec à cette étape, aucune donnée n'est modifiée.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.services = window.LH3.services || {};

  function buildManagerArchiveRow(seasonLabel, manager, predictionsByManager, matchesById) {
    const playerService = window.LH3.services.playerService;
    const peService = window.LH3.services.peService;
    const presenceService = window.LH3.services.presenceService;

    const prestige = peService.prestigeInfo(manager);

    const myPredictions = (predictionsByManager[manager.id] || [])
      .map((row) => {
        const match = matchesById[row.match_id];
        if (!match) return null;
        return {
          matchday: match.matchday,
          opponent: match.opponent,
          result: match.result || null,
          scoreFor: row.score_for,
          scoreAgainst: row.score_against,
          totalTries: row.total_tries,
          tryScorers: row.try_scorers || [],
          manOfMatchId: row.man_of_match_id,
          blunderId: row.blunder_id,
          peEarned: row.pe_earned || 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.matchday - b.matchday);

    const presence = presenceService.listPeriods()
      .map((period) => {
        const rating = presenceService.ratingForManager(period, manager.id);
        if (!rating) return null;
        const tier = presenceService.tierInfo(rating.tier);
        return { label: period.label, date: period.date, tierLabel: tier ? tier.label : rating.tier, pe: rating.pe };
      })
      .filter(Boolean);

    return {
      id: window.LH3.utils.id.uuid(),
      seasonLabel,
      managerId: manager.id,
      managerName: window.LH3.services.managerService.displayName(manager),
      coachName: manager.coach && manager.coach.name,
      finalPe: manager.pe || 0,
      finalPrestige: prestige.name,
      finalTeamOverall: playerService.teamOverall(manager),
      squad: manager.squad,
      playerCards: playerService.getAllCards(manager),
      predictions: myPredictions,
      presence,
    };
  }

  /** Construit toutes les lignes d'archive (une par manager) sans rien écrire. */
  async function buildAllArchiveRows(seasonLabel) {
    const state = window.LH3.services.stateService.getState();
    const managers = window.LH3.services.managerService.listManagers();

    const allPredictions = await window.LH3.services.storageService.loadAllPredictions();
    const predictionsByManager = {};
    allPredictions.forEach((row) => {
      predictionsByManager[row.manager_id] = predictionsByManager[row.manager_id] || [];
      predictionsByManager[row.manager_id].push(row);
    });

    const matchesById = {};
    state.matches.forEach((m) => { matchesById[m.id] = m; });

    return managers.map((m) => buildManagerArchiveRow(seasonLabel, m, predictionsByManager, matchesById));
  }

  /**
   * Archive puis remet à zéro TOUTE la saison pour TOUS les managers : PE,
   * attributs + planchers sauvegardés, compo (nouveau tirage pondéré vers les
   * joueurs peu titularisés, même mécanisme qu'une inscription), historique
   * de progression — puis vide calendrier, journal, assiduité et événements
   * du club. Best-effort au-delà de l'étape d'archivage : si l'écriture
   * échoue pour UN manager pendant le reset, les autres continuent quand
   * même (les erreurs sont listées dans le retour) plutôt que de laisser la
   * saison à moitié remise à zéro sans aucune visibilité.
   */
  async function archiveAndResetSeason(seasonLabel) {
    seasonLabel = (seasonLabel || '').trim();
    if (!seasonLabel) return { ok: false, reason: 'Donne un nom à cette saison avant de continuer.' };

    let rows;
    try {
      rows = await buildAllArchiveRows(seasonLabel);
    } catch (e) {
      console.error('[seasonArchiveService] échec construction des archives', e);
      return { ok: false, reason: 'Impossible de préparer l\'archive — rien n\'a été modifié. Réessaie.' };
    }

    const archived = await window.LH3.services.storageService.insertSeasonArchives(rows);
    if (!archived) {
      return { ok: false, reason: 'Impossible d\'enregistrer l\'archive — rien n\'a été modifié. Vérifie ta connexion et réessaie.' };
    }

    const state = window.LH3.services.stateService.getState();
    const managers = window.LH3.services.managerService.listManagers();
    const allIds = state.players.map((p) => p.id);
    // Un seul instantané des compteurs de titularisation, calculé une fois
    // AVANT de commencer à réinitialiser qui que ce soit — sinon les
    // premiers managers traités biaiseraient la pondération des suivants.
    const startedCounts = window.LH3.services.managerService.computeStartedCounts(managers);

    const failedManagers = [];
    for (const manager of managers) {
      manager.pe = 0;
      manager.playerBoosts = {};
      manager.savedBoosts = {};
      manager.resetBoostsUsed = false;
      manager.history = [];
      manager.squad = window.LH3.services.managerService.defaultSquad(allIds, startedCounts);
      const ok = await window.LH3.services.storageService.saveManager(manager);
      if (!ok) failedManagers.push(manager.name);
    }

    await window.LH3.services.storageService.clearAllMatches();
    await window.LH3.services.storageService.clearAllJournal();
    await window.LH3.services.storageService.clearAllPresencePeriods();
    await window.LH3.services.storageService.clearAllClubEvents();

    state.matches = [];
    state.journal = [];
    state.presencePeriods = [];
    state.clubEvents = [];
    window.LH3.services.stateService.notify();

    if (failedManagers.length) {
      return {
        ok: true,
        managersArchived: rows.length,
        reason: 'Archivé, mais la réinitialisation a échoué pour : ' + failedManagers.join(', ') + ' — réessaie pour eux (leur archive existe déjà, pas de doublon à craindre en relançant juste leur cas).',
      };
    }
    return { ok: true, managersArchived: rows.length };
  }

  /** Lecture publique : liste des libellés de saisons archivées, la plus récente d'abord. */
  async function listSeasonLabels() {
    const archives = await window.LH3.services.storageService.loadSeasonArchives();
    const labels = [];
    archives.forEach((a) => { if (!labels.includes(a.seasonLabel)) labels.push(a.seasonLabel); });
    return labels;
  }

  window.LH3.services.seasonArchiveService = { buildAllArchiveRows, archiveAndResetSeason, listSeasonLabels };
})();
