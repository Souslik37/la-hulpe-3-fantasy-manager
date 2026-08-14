/**
 * La Hulpe 3 Fantasy Manager — Bonus d'assiduité
 *
 * ~4 fois par saison, l'admin note chaque manager sur 5 paliers de présence
 * aux entraînements (voir data/config.js → CONFIG.presence.tiers) — un
 * jugement global, pas un pointage précis. Purement additif, jamais de
 * pénalité, montants volontairement modestes (voir le commentaire dans
 * CONFIG.presence) pour ne jamais devenir le vrai levier de classement.
 *
 * Idempotent comme scoringService : renoter une période déjà notée retire
 * d'abord les PE précédemment accordés avant d'appliquer les nouveaux.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.services = window.LH3.services || {};

  function listPeriods() {
    const state = window.LH3.services.stateService.getState();
    return (state.presencePeriods || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  }

  function getPeriod(id) {
    return listPeriods().find((p) => p.id === id) || null;
  }

  function tierInfo(key) {
    return window.LH3.data.CONFIG.presence.tiers.find((t) => t.key === key) || null;
  }

  function ratingForManager(period, managerId) {
    return (period.ratings && period.ratings[managerId]) || null;
  }

  /** Admin uniquement : renomme/redate une période (édition légère, comme le calendrier). */
  function updatePeriodInfo(id, { label, date }) {
    const period = getPeriod(id);
    if (!period) return;
    if (label !== undefined) period.label = label;
    if (date !== undefined) period.date = date;
    window.LH3.services.storageService.updatePresencePeriod(id, { label: period.label, date: period.date });
  }

  /**
   * Admin uniquement. `ratingsByManagerId` = { managerId: tierKey } pour TOUS
   * les managers de la ligue (l'écran d'évaluation les couvre tous d'un
   * coup) — remplace entièrement les notations précédentes de la période.
   */
  async function evaluatePeriod(periodId, ratingsByManagerId) {
    const period = getPeriod(periodId);
    if (!period) return { ok: false, reason: 'Période introuvable.' };

    const state = window.LH3.services.stateService.getState();
    const newRatings = {};
    const touchedManagers = [];

    Object.keys(ratingsByManagerId).forEach((managerId) => {
      const manager = state.managers[managerId];
      const tier = tierInfo(ratingsByManagerId[managerId]);
      if (!manager || !tier) return;

      const previous = ratingForManager(period, managerId);
      if (previous) window.LH3.services.peService.addPe(manager, -previous.pe);
      window.LH3.services.peService.addPe(manager, tier.pe);

      newRatings[managerId] = { tier: tier.key, pe: tier.pe };
      touchedManagers.push(manager);
    });

    period.ratings = newRatings;

    const ok = await window.LH3.services.storageService.savePresenceRatings(periodId, newRatings);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };

    for (const manager of touchedManagers) {
      await window.LH3.services.storageService.saveManagerProgress(manager.id, manager.pe, manager.history);
    }

    // Une seule brève générique, jamais de détail par manager (on ne pointe
    // personne du doigt — voir la page Communauté pour le même principe).
    const entry = {
      id: window.LH3.utils.id.uuid(),
      generatorId: 'presence-bonus',
      matchId: null,
      matchday: null,
      date: period.date,
      icon: '🙌',
      title: 'Bonus d\'assiduité distribué',
      text: `Le bonus d'assiduité "${period.label}" vient d'être réparti — merci à tous pour votre engagement aux entraînements !`,
      kind: 'story',
      createdAt: new Date().toISOString(),
    };
    state.journal.unshift(entry);
    await window.LH3.services.storageService.saveJournalEntries([entry]);

    window.LH3.services.stateService.notify();
    return { ok: true };
  }

  /**
   * Admin uniquement : annule complètement l'évaluation d'une période — les
   * PE distribués sont repris, les notations vidées, et la brève de journal
   * correspondante retirée. Utile pour un essai/une erreur de manipulation
   * plutôt que de devoir remettre chaque manager à "Très faible" à la main.
   */
  async function resetPeriod(periodId) {
    const period = getPeriod(periodId);
    if (!period) return { ok: false, reason: 'Période introuvable.' };

    const state = window.LH3.services.stateService.getState();
    const touchedManagers = [];

    Object.keys(period.ratings || {}).forEach((managerId) => {
      const manager = state.managers[managerId];
      const rating = period.ratings[managerId];
      if (!manager || !rating) return;
      window.LH3.services.peService.addPe(manager, -rating.pe);
      touchedManagers.push(manager);
    });

    period.ratings = {};
    const ok = await window.LH3.services.storageService.savePresenceRatings(periodId, {});
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };

    for (const manager of touchedManagers) {
      await window.LH3.services.storageService.saveManagerProgress(manager.id, manager.pe, manager.history);
    }

    const toRemove = state.journal.filter((e) => e.generatorId === 'presence-bonus' && e.date === period.date);
    if (toRemove.length) {
      state.journal = state.journal.filter((e) => !(e.generatorId === 'presence-bonus' && e.date === period.date));
      await window.LH3.services.storageService.deleteJournalEntriesByIds(toRemove.map((e) => e.id));
    }

    window.LH3.services.stateService.notify();
    return { ok: true };
  }

  /** Admin uniquement : ajoute une période d'assiduité au calendrier. */
  async function addPeriod({ label, date }) {
    label = (label || '').trim();
    if (!label) return { ok: false, reason: 'Choisis un nom pour cette période.' };
    if (!date) return { ok: false, reason: 'Renseigne une date.' };

    const period = { id: window.LH3.utils.id.uid('presence'), label, date, ratings: {} };
    const ok = await window.LH3.services.storageService.insertPresencePeriod(period);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };

    const state = window.LH3.services.stateService.getState();
    state.presencePeriods = state.presencePeriods || [];
    state.presencePeriods.push(period);
    window.LH3.services.stateService.notify();
    return { ok: true, period };
  }

  /**
   * Admin uniquement : retire une période d'assiduité. Si elle avait déjà
   * été évaluée, on reprend d'abord les PE distribués (voir resetPeriod)
   * pour qu'ils ne restent pas acquis alors que la période disparaît.
   */
  async function removePeriod(id) {
    const period = getPeriod(id);
    if (!period) return { ok: false, reason: 'Période introuvable.' };

    if (Object.keys(period.ratings || {}).length > 0) {
      const undoRes = await resetPeriod(id);
      if (!undoRes.ok) return undoRes;
    }

    const ok = await window.LH3.services.storageService.deletePresencePeriod(id);
    if (!ok) return { ok: false, reason: 'Suppression impossible — vérifie ta connexion et réessaie.' };

    const state = window.LH3.services.stateService.getState();
    state.presencePeriods = (state.presencePeriods || []).filter((p) => p.id !== id);
    window.LH3.services.stateService.notify();
    return { ok: true };
  }

  window.LH3.services.presenceService = {
    listPeriods, getPeriod, tierInfo, ratingForManager, updatePeriodInfo, evaluatePeriod, resetPeriod,
    addPeriod, removePeriod,
  };
})();
