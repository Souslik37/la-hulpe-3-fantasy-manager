/**
 * La Hulpe 3 Fantasy Manager — Gestion du roster (admin)
 *
 * Ajout/renommage/suppression d'un joueur et changement d'avatar. Réservé à
 * un compte admin côté UI (voir pages/admin.js) ET côté serveur (RLS
 * `players_admin_write` dans supabase/schema.sql — un joueur normal ne peut
 * pas écrire cette table même en bidouillant le JS).
 *
 * Comme storageService, chaque fonction met à jour `state.players` en local
 * ET écrit dans Supabase, pour que l'UI reflète le changement immédiatement
 * sans attendre le réseau.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.services = window.LH3.services || {};

  const COMBINING_MARKS = /[\u0300-\u036f]/g;
  function slugify(name) {
    return name
      .normalize('NFD').replace(COMBINING_MARKS, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function baseAttributes() {
    const base = window.LH3.data.CONFIG.season.baseAttribute;
    const attrs = {};
    window.LH3.data.CONFIG.attributes.forEach((a) => { attrs[a.key] = base; });
    return attrs;
  }

  function state() {
    return window.LH3.services.stateService.getState();
  }

  async function addPlayer(name, avatarUrl) {
    name = (name || '').trim();
    if (!name) return { ok: false, reason: 'Choisis un nom.' };
    const id = slugify(name);
    if (!id) return { ok: false, reason: 'Ce nom ne donne aucun identifiant valide.' };
    if (state().players.some((p) => p.id === id)) {
      return { ok: false, reason: 'Un joueur avec un nom très proche existe déjà.' };
    }

    const player = { id, name, avatarUrl: avatarUrl ? avatarUrl.trim() : null, baseAttributes: baseAttributes() };
    const ok = await window.LH3.services.storageService.insertPlayer(player);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };

    state().players.push(player);
    window.LH3.services.stateService.notify();
    return { ok: true, player };
  }

  async function renamePlayer(id, newName) {
    newName = (newName || '').trim();
    if (!newName) return { ok: false, reason: 'Le nom ne peut pas être vide.' };
    const ok = await window.LH3.services.storageService.updatePlayer(id, { name: newName });
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };

    const p = state().players.find((pl) => pl.id === id);
    if (p) p.name = newName;
    window.LH3.services.stateService.notify();
    return { ok: true };
  }

  async function setPlayerAvatar(id, avatarUrl) {
    const clean = avatarUrl ? avatarUrl.trim() : null;
    const ok = await window.LH3.services.storageService.updatePlayer(id, { avatar_url: clean || null });
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };

    const p = state().players.find((pl) => pl.id === id);
    if (p) p.avatarUrl = clean || null;
    window.LH3.services.stateService.notify();
    return { ok: true };
  }

  async function removePlayer(id) {
    const ok = await window.LH3.services.storageService.deletePlayer(id);
    if (!ok) return { ok: false, reason: 'Suppression impossible — vérifie ta connexion et réessaie.' };

    const st = state();
    st.players = st.players.filter((p) => p.id !== id);
    window.LH3.services.stateService.notify();
    return { ok: true };
  }

  window.LH3.services.rosterService = { addPlayer, renamePlayer, setPlayerAvatar, removePlayer };
})();
