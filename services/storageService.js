/**
 * La Hulpe 3 Fantasy Manager — Persistance Supabase
 *
 * Seul module autorisé à parler au réseau/à Supabase. Tout le reste de
 * l'app passe par stateService, qui garde une copie en mémoire à jour de
 * façon synchrone (voir stateService.js pour la stratégie complète).
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.services = window.LH3.services || {};

  function client() {
    return window.LH3.services.authService.getClient();
  }

  function managerRowToApp(row) {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      coach: row.coach || {},
      playerBoosts: row.player_boosts || {},
      squad: row.squad || {},
      pe: row.pe || 0,
      history: row.history || [],
      predictions: {}, // rempli séparément depuis la table predictions
      predictionResults: {}, // idem (breakdown/pe_earned)
      createdAt: row.created_at,
    };
  }

  function matchRowToApp(row) {
    return {
      id: row.id,
      matchday: row.matchday,
      opponent: row.opponent,
      date: row.date,
      status: row.status,
      result: row.result || null,
    };
  }

  function playerRowToApp(row) {
    return { id: row.id, name: row.name, avatarUrl: row.avatar_url, baseAttributes: row.base_attributes };
  }

  function journalRowToApp(row) {
    return {
      id: row.id, generatorId: row.generator_id, matchId: row.match_id, matchday: row.matchday,
      date: row.date, icon: row.icon, title: row.title, text: row.text, kind: row.kind,
      createdAt: row.created_at,
    };
  }

  function presencePeriodRowToApp(row) {
    return { id: row.id, label: row.label, date: row.date, ratings: row.ratings || {} };
  }

  /**
   * Charge tout ce dont l'app a besoin pour démarrer : roster, calendrier,
   * journal, tous les managers (classement/journal), et les pronostics du
   * manager actif uniquement (RLS empêche de toute façon de lire ceux des
   * autres, sauf pour un compte admin qui les lira à la volée au moment de
   * noter une journée — voir scoringService.gradeAllPredictionsForMatch).
   */
  async function loadInitialState(activeManagerId) {
    const [playersRes, matchesRes, journalRes, managersRes, predictionsRes, presenceRes] = await Promise.all([
      client().from('players').select('*'),
      client().from('matches').select('*').order('matchday'),
      client().from('journal').select('*').order('created_at', { ascending: false }),
      client().from('managers').select('*'),
      client().from('predictions').select('*').eq('manager_id', activeManagerId),
      client().from('presence_periods').select('*').order('date'),
    ]);

    for (const res of [playersRes, matchesRes, journalRes, managersRes, predictionsRes, presenceRes]) {
      if (res.error) throw res.error;
    }

    const managers = {};
    managersRes.data.forEach((row) => { managers[row.id] = managerRowToApp(row); });

    predictionsRes.data.forEach((row) => {
      const manager = managers[row.manager_id];
      if (!manager) return;
      manager.predictions[row.match_id] = {
        scoreFor: row.score_for, scoreAgainst: row.score_against, totalTries: row.total_tries,
        tryScorers: row.try_scorers || [], manOfMatchId: row.man_of_match_id, blunderId: row.blunder_id,
        submittedAt: row.submitted_at,
      };
      if (row.breakdown) {
        manager.predictionResults[row.match_id] = Object.assign({}, row.breakdown, { peEarned: row.pe_earned });
      }
    });

    return {
      version: 1,
      players: playersRes.data.map(playerRowToApp),
      matches: matchesRes.data.map(matchRowToApp),
      managers,
      activeManagerId,
      journal: journalRes.data.map(journalRowToApp),
      presencePeriods: presenceRes.data.map(presencePeriodRowToApp),
      meta: { createdAt: new Date().toISOString() },
    };
  }

  /**
   * Mise à jour ciblée PE + historique uniquement — utilisée quand l'admin
   * note les pronostics de TOUT LE MONDE après un résultat. Ne touche
   * jamais coach/player_boosts/squad des autres managers : la copie locale
   * de l'admin pour ces champs peut être périmée (l'intéressé a pu la
   * modifier depuis), on ne veut surtout pas l'écraser par erreur.
   */
  async function saveManagerProgress(managerId, pe, history) {
    const { error } = await client().from('managers').update({ pe, history }).eq('id', managerId);
    if (error) console.error('[storageService] échec sauvegarde progression', error);
    return !error;
  }

  /** Pousse les champs mutables d'UN manager (le sien) vers Supabase. */
  async function saveManager(manager) {
    const { error } = await client().from('managers').update({
      coach: manager.coach,
      player_boosts: manager.playerBoosts,
      squad: manager.squad,
      pe: manager.pe,
      history: manager.history,
    }).eq('id', manager.id);
    if (error) console.error('[storageService] échec sauvegarde manager', error);
    return !error;
  }

  /** Upsert d'un pronostic (le sien). */
  async function savePredictionRow(managerId, matchId, prediction) {
    const { error } = await client().from('predictions').upsert({
      manager_id: managerId,
      match_id: matchId,
      score_for: prediction.scoreFor,
      score_against: prediction.scoreAgainst,
      total_tries: prediction.totalTries,
      try_scorers: prediction.tryScorers,
      man_of_match_id: prediction.manOfMatchId,
      blunder_id: prediction.blunderId,
      submitted_at: prediction.submittedAt,
    });
    if (error) console.error('[storageService] échec sauvegarde pronostic', error);
    return !error;
  }

  /** Admin uniquement : met à jour infos/statut d'un match. */
  async function saveMatch(match) {
    const { error } = await client().from('matches').update({
      opponent: match.opponent,
      date: match.date,
      status: match.status,
      result: match.result,
    }).eq('id', match.id);
    if (error) console.error('[storageService] échec sauvegarde match', error);
    return !error;
  }

  /** Admin uniquement : ajoute un match au calendrier. */
  async function insertMatch(match) {
    const { error } = await client().from('matches').insert({
      id: match.id, matchday: match.matchday, opponent: match.opponent, date: match.date, status: match.status,
    });
    if (error) console.error('[storageService] échec ajout match', error);
    return !error;
  }

  /** Admin uniquement : retire un match du calendrier (cascade sur ses pronostics). */
  async function deleteMatch(id) {
    const { error } = await client().from('matches').delete().eq('id', id);
    if (error) console.error('[storageService] échec suppression match', error);
    return !error;
  }

  /** Admin uniquement : renomme/redate une période d'assiduité. */
  async function updatePresencePeriod(id, fields) {
    const { error } = await client().from('presence_periods').update(fields).eq('id', id);
    if (error) console.error('[storageService] échec mise à jour période d\'assiduité', error);
    return !error;
  }

  /** Admin uniquement : écrit les notations (tous managers) d'une période d'assiduité. */
  async function savePresenceRatings(periodId, ratings) {
    const { error } = await client().from('presence_periods').update({ ratings }).eq('id', periodId);
    if (error) console.error('[storageService] échec sauvegarde notations assiduité', error);
    return !error;
  }

  /** Admin uniquement : récupère TOUS les pronostics d'une journée (pour noter). */
  async function loadPredictionsForMatch(matchId) {
    const { data, error } = await client().from('predictions').select('*').eq('match_id', matchId);
    if (error) throw error;
    return data;
  }

  /** Admin uniquement : écrit le résultat de correction (breakdown + PE) d'un manager. */
  async function savePredictionGrading(managerId, matchId, breakdown) {
    const { error } = await client().from('predictions').update({
      breakdown, pe_earned: breakdown.peEarned,
    }).eq('manager_id', managerId).eq('match_id', matchId);
    if (error) console.error('[storageService] échec sauvegarde notation', error);
    return !error;
  }

  /** Admin uniquement : insère les nouvelles brèves du journal. */
  async function saveJournalEntries(entries) {
    if (!entries.length) return true;
    const { error } = await client().from('journal').insert(entries.map((e) => ({
      id: e.id, generator_id: e.generatorId, match_id: e.matchId, matchday: e.matchday,
      date: e.date, icon: e.icon, title: e.title, text: e.text, kind: e.kind, created_at: e.createdAt,
    })));
    if (error) console.error('[storageService] échec sauvegarde journal', error);
    return !error;
  }

  /** Admin uniquement : supprime les brèves existantes d'une journée (avant régénération). */
  async function deleteJournalForMatch(matchId) {
    const { error } = await client().from('journal').delete().eq('match_id', matchId);
    if (error) console.error('[storageService] échec suppression journal', error);
    return !error;
  }

  /** Admin uniquement : supprime des brèves précises par id (ex: annulation d'un bonus d'assiduité). */
  async function deleteJournalEntriesByIds(ids) {
    if (!ids.length) return true;
    const { error } = await client().from('journal').delete().in('id', ids);
    if (error) console.error('[storageService] échec suppression brèves', error);
    return !error;
  }

  /** Admin uniquement : ajoute un joueur au roster partagé. */
  async function insertPlayer(player) {
    const { error } = await client().from('players').insert({
      id: player.id, name: player.name, avatar_url: player.avatarUrl, base_attributes: player.baseAttributes,
    });
    if (error) console.error('[storageService] échec ajout joueur', error);
    return !error;
  }

  /** Admin uniquement : met à jour un ou plusieurs champs d'un joueur (ex: { name } ou { avatar_url }). */
  async function updatePlayer(id, fields) {
    const { error } = await client().from('players').update(fields).eq('id', id);
    if (error) console.error('[storageService] échec mise à jour joueur', error);
    return !error;
  }

  /** Admin uniquement : retire un joueur du roster partagé. */
  async function deletePlayer(id) {
    const { error } = await client().from('players').delete().eq('id', id);
    if (error) console.error('[storageService] échec suppression joueur', error);
    return !error;
  }

  /**
   * Admin uniquement : supprime un profil manager. Les pronostics liés
   * partent automatiquement avec lui (foreign key `on delete cascade` dans
   * schema.sql) — pas besoin d'un appel séparé.
   */
  async function deleteManager(id) {
    const { error } = await client().from('managers').delete().eq('id', id);
    if (error) console.error('[storageService] échec suppression manager', error);
    return !error;
  }

  window.LH3.services.storageService = {
    loadInitialState, saveManager, saveManagerProgress, savePredictionRow, saveMatch,
    loadPredictionsForMatch, savePredictionGrading, saveJournalEntries, deleteJournalForMatch,
    deleteJournalEntriesByIds,
    insertPlayer, updatePlayer, deletePlayer,
    updatePresencePeriod, savePresenceRatings,
    deleteManager,
    insertMatch, deleteMatch,
  };
})();
