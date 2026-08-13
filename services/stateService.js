/**
 * La Hulpe 3 Fantasy Manager — État central de l'application
 *
 * Stratégie : au démarrage (après connexion), on charge tout ce qu'il faut
 * depuis Supabase UNE fois dans un objet `state` en mémoire, avec exactement
 * la même forme qu'avant (quand tout vivait dans LocalStorage). Le reste de
 * l'app (services, pages) lit/écrit cet objet de façon 100% synchrone, sans
 * aucun changement — seul `persist()` a changé : en plus de garder l'état
 * en mémoire à jour, il renvoie les changements vers Supabase en tâche de
 * fond (sans bloquer l'interface).
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.services = window.LH3.services || {};

  let state = null;
  const listeners = [];
  const dirty = new Set();

  async function init(activeManagerId) {
    state = await window.LH3.services.storageService.loadInitialState(activeManagerId);
    return state;
  }

  function getState() {
    return state;
  }

  /** À appeler par un service qui vient de modifier autre chose que le
   *  manager actif (calendrier, journal...), avant persist(). */
  function markDirty(scope) {
    dirty.add(scope);
  }

  /**
   * Met à jour l'état local immédiatement (l'UI ne doit jamais attendre le
   * réseau) puis envoie les changements à Supabase en arrière-plan.
   */
  function persist() {
    notify();

    const activeManager = state.managers[state.activeManagerId];
    if (activeManager) {
      window.LH3.services.storageService.saveManager(activeManager).then((ok) => {
        if (!ok) window.LH3.components.toast.show('Sauvegarde en ligne impossible — vérifie ta connexion.', 'error');
      });
    }

    if (dirty.has('matches')) {
      state.matches.forEach((m) => window.LH3.services.storageService.saveMatch(m));
    }
    dirty.clear();
  }

  function subscribe(fn) {
    listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }

  function notify() {
    listeners.forEach((fn) => {
      try { fn(state); } catch (e) { console.error('[stateService] listener error', e); }
    });
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  window.LH3.services.stateService = {
    init, getState, persist, markDirty, subscribe, notify, deepClone,
  };
})();
