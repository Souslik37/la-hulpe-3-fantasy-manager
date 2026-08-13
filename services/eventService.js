/**
 * La Hulpe 3 Fantasy Manager — Événements du club
 *
 * Bonus ponctuels et purement fun ("Braderie de La Hulpe", "Cadeau du
 * président"...), déclenchés par l'admin quand il veut. Deux formes :
 *  - génériques : alimentent un compteur "Points Fun", totalement séparé
 *    des PE (aucun impact sur classement/attributs — juste du folklore) ;
 *  - ciblées sur un attribut (ex: Troisième mi-temps) : donnent du PE
 *    normal (même monnaie unique que les matchs/l'assiduité), mais ce PE
 *    est "réservé" — il ne compte pas comme dépensable sur les AUTRES
 *    attributs tant qu'il n'est pas investi sur celui visé (voir
 *    playerService.pointsRemaining/pointsRemainingFor). Pas de deuxième
 *    monnaie : juste une règle de côté sur le même total de PE.
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

  function attributeLabel(attrKey) {
    const attr = window.LH3.data.CONFIG.attributes.find((a) => a.key === attrKey);
    return attr ? attr.label : attrKey;
  }

  /** Admin uniquement. `attributeKey` optionnel (une des clés de CONFIG.attributes). */
  async function createEvent({ title, icon, amount, date, attributeKey }) {
    title = (title || '').trim();
    amount = Number(amount);
    attributeKey = attributeKey || null;
    if (!title) return { ok: false, reason: 'Donne un nom à cet événement.' };
    if (!Number.isInteger(amount) || amount <= 0) return { ok: false, reason: 'Le montant doit être un nombre entier positif.' };
    if (!date) return { ok: false, reason: 'Renseigne une date.' };

    const state = window.LH3.services.stateService.getState();
    const managers = Object.values(state.managers);
    const event = {
      id: window.LH3.utils.id.uid('event'),
      title, icon: (icon || '').trim() || '🎉', date, amount, attributeKey,
      recipientIds: managers.map((m) => m.id),
    };

    const ok = await window.LH3.services.storageService.insertClubEvent(event);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };

    for (const manager of managers) {
      if (attributeKey) {
        window.LH3.services.peService.addPe(manager, amount);
        manager.attributeReserved = manager.attributeReserved || {};
        manager.attributeReserved[attributeKey] = (manager.attributeReserved[attributeKey] || 0) + amount;
        await window.LH3.services.storageService.saveManagerProgress(manager.id, manager.pe, manager.history);
        await window.LH3.services.storageService.saveManagerAttributeReserved(manager.id, manager.attributeReserved);
      } else {
        manager.funPoints = (manager.funPoints || 0) + amount;
        await window.LH3.services.storageService.saveManagerFunPoints(manager.id, manager.funPoints);
      }
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
      text: attributeKey
        ? `Petit bonus fun pour tout le monde grâce à "${event.title}" : +${amount} PE, à investir sur ${attributeLabel(attributeKey)} !`
        : `Petit bonus fun pour tout le monde : +${amount} Points Fun grâce à "${event.title}" !`,
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
      if (event.attributeKey) {
        window.LH3.services.peService.addPe(manager, -event.amount);
        manager.attributeReserved = manager.attributeReserved || {};
        manager.attributeReserved[event.attributeKey] = Math.max(0, (manager.attributeReserved[event.attributeKey] || 0) - event.amount);
      } else {
        manager.funPoints = Math.max(0, (manager.funPoints || 0) - event.amount);
      }
      touchedManagers.push(manager);
    });

    const ok = await window.LH3.services.storageService.deleteClubEvent(id);
    if (!ok) return { ok: false, reason: 'Suppression impossible — vérifie ta connexion et réessaie.' };

    for (const manager of touchedManagers) {
      if (event.attributeKey) {
        await window.LH3.services.storageService.saveManagerProgress(manager.id, manager.pe, manager.history);
        await window.LH3.services.storageService.saveManagerAttributeReserved(manager.id, manager.attributeReserved);
      } else {
        await window.LH3.services.storageService.saveManagerFunPoints(manager.id, manager.funPoints);
      }
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

  window.LH3.services.eventService = { listEvents, getEvent, createEvent, removeEvent, attributeLabel };
})();
