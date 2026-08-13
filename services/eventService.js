/**
 * La Hulpe 3 Fantasy Manager — Événements du club
 *
 * Bonus ponctuels et purement fun ("Braderie de La Hulpe", "Cadeau du
 * président"...), déclenchés par l'admin quand il veut. Alimentent un
 * compteur "Points Fun" totalement séparé des PE : aucun impact sur le
 * classement ni sur le budget d'attributs — juste du folklore.
 *
 * `recipientIds` fige qui était manager au moment de la création (un
 * manager qui rejoint après ne reçoit pas le bonus rétroactivement), ce qui
 * permet une annulation exacte — même idée que resetPeriod/unfinalizeMatch.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.services = window.LH3.services || {};

  function listEvents() {
    const state = window.LH3.services.stateService.getState();
    return (state.clubEvents || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  }

  function getEvent(id) {
    return listEvents().find((e) => e.id === id) || null;
  }

  /** Admin uniquement. */
  async function createEvent({ title, icon, amount, date }) {
    title = (title || '').trim();
    amount = Number(amount);
    if (!title) return { ok: false, reason: 'Donne un nom à cet événement.' };
    if (!Number.isInteger(amount) || amount <= 0) return { ok: false, reason: 'Le montant doit être un nombre entier positif.' };
    if (!date) return { ok: false, reason: 'Renseigne une date.' };

    const state = window.LH3.services.stateService.getState();
    const managers = Object.values(state.managers);
    const event = {
      id: window.LH3.utils.id.uid('event'),
      title, icon: (icon || '').trim() || '🎉', date, amount,
      recipientIds: managers.map((m) => m.id),
    };

    const ok = await window.LH3.services.storageService.insertClubEvent(event);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };

    for (const manager of managers) {
      manager.funPoints = (manager.funPoints || 0) + amount;
      await window.LH3.services.storageService.saveManagerFunPoints(manager.id, manager.funPoints);
    }

    state.clubEvents = state.clubEvents || [];
    state.clubEvents.push(event);

    const entry = {
      id: window.LH3.utils.id.uid('news'),
      generatorId: 'club-event',
      matchId: null,
      matchday: null,
      date: event.date,
      icon: event.icon,
      title: event.title,
      text: `Petit bonus fun pour tout le monde : +${amount} Points Fun grâce à "${event.title}" !`,
      kind: 'fun',
      createdAt: new Date().toISOString(),
    };
    state.journal.unshift(entry);
    await window.LH3.services.storageService.saveJournalEntries([entry]);

    window.LH3.services.stateService.notify();
    return { ok: true, event };
  }

  /** Admin uniquement : reprend le bonus distribué et retire l'événement. */
  async function removeEvent(id) {
    const event = getEvent(id);
    if (!event) return { ok: false, reason: 'Événement introuvable.' };

    const state = window.LH3.services.stateService.getState();
    const touchedManagers = [];
    (event.recipientIds || []).forEach((managerId) => {
      const manager = state.managers[managerId];
      if (!manager) return;
      manager.funPoints = Math.max(0, (manager.funPoints || 0) - event.amount);
      touchedManagers.push(manager);
    });

    const ok = await window.LH3.services.storageService.deleteClubEvent(id);
    if (!ok) return { ok: false, reason: 'Suppression impossible — vérifie ta connexion et réessaie.' };

    for (const manager of touchedManagers) {
      await window.LH3.services.storageService.saveManagerFunPoints(manager.id, manager.funPoints);
    }

    state.clubEvents = (state.clubEvents || []).filter((e) => e.id !== id);

    const toRemove = state.journal.filter((e) => e.generatorId === 'club-event' && e.date === event.date && e.title === event.title);
    if (toRemove.length) {
      state.journal = state.journal.filter((e) => !(e.generatorId === 'club-event' && e.date === event.date && e.title === event.title));
      await window.LH3.services.storageService.deleteJournalEntriesByIds(toRemove.map((e) => e.id));
    }

    window.LH3.services.stateService.notify();
    return { ok: true };
  }

  window.LH3.services.eventService = { listEvents, getEvent, createEvent, removeEvent };
})();
