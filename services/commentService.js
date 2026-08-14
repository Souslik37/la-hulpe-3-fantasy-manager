/**
 * La Hulpe 3 Fantasy Manager — Commentaires avant/après-match
 *
 * Petits mots libres et facultatifs, postés par n'importe quel manager sur
 * une journée précise ("avant" ou "après" le match) — purement du folklore,
 * lus par tout le monde, chacun ne gère que les siens (voir RLS
 * match_comments dans schema.sql).
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.services = window.LH3.services || {};

  /** phase optionnel ('pre' | 'post') — omis, renvoie les deux, triés du plus ancien au plus récent. */
  function listComments(matchId, phase) {
    const state = window.LH3.services.stateService.getState();
    return (state.matchComments || [])
      .filter((c) => c.matchId === matchId && (!phase || c.phase === phase))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async function addComment(matchId, phase, text) {
    text = (text || '').trim();
    if (!text) return { ok: false, reason: 'Écris quelque chose avant d\'envoyer.' };

    const manager = window.LH3.services.managerService.getActiveManager();
    const comment = {
      id: window.LH3.utils.id.uuid(),
      matchId, managerId: manager.id, phase, text,
      createdAt: new Date().toISOString(),
    };
    const ok = await window.LH3.services.storageService.insertMatchComment(comment);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };

    const state = window.LH3.services.stateService.getState();
    state.matchComments = state.matchComments || [];
    state.matchComments.push(comment);
    window.LH3.services.stateService.notify();
    return { ok: true, comment };
  }

  /** Chacun ne peut retirer que son propre commentaire (sauf l'admin, voir RLS). */
  async function removeComment(id) {
    const state = window.LH3.services.stateService.getState();
    const comment = (state.matchComments || []).find((c) => c.id === id);
    if (!comment) return { ok: false, reason: 'Commentaire introuvable.' };

    const active = window.LH3.services.managerService.getActiveManager();
    if (comment.managerId !== active.id && active.role !== 'admin') {
      return { ok: false, reason: 'Tu ne peux retirer que tes propres commentaires.' };
    }

    const ok = await window.LH3.services.storageService.deleteMatchComment(id);
    if (!ok) return { ok: false, reason: 'Suppression impossible — vérifie ta connexion et réessaie.' };

    state.matchComments = state.matchComments.filter((c) => c.id !== id);
    window.LH3.services.stateService.notify();
    return { ok: true };
  }

  window.LH3.services.commentService = { listComments, addComment, removeComment };
})();
