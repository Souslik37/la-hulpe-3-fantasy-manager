/**
 * La Hulpe 3 Fantasy Manager — Authentification (nom + code à 4 chiffres)
 *
 * Utilise Supabase Auth (email/mot de passe) en coulisses pour bénéficier
 * d'un vrai système de sessions et pouvoir écrire des règles Row Level
 * Security fiables (auth.uid()) — mais l'utilisateur ne voit jamais les mots
 * "email" ou "mot de passe" : uniquement "ton nom" et "ton code à 4 chiffres".
 *
 * ⚠️ Sécurité légère et assumée : un code à 4 chiffres protège correctement
 * face à "quelqu'un tape un nom au hasard", pas face à une attaque motivée.
 * Adapté à un groupe d'amis, pas à des données sensibles.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.services = window.LH3.services || {};

  const EMAIL_DOMAIN = 'players.lahulpe3.local';
  const PASSWORD_PREFIX = 'LH3';

  let client = null;
  function getClient() {
    if (!client) {
      const cfg = window.LH3.data.SUPABASE_CONFIG;
      client = window.supabase.createClient(cfg.url, cfg.publishableKey);
    }
    return client;
  }

  function slugify(name) {
    return String(name)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function isValidPin(pin) {
    return /^\d{4}$/.test(pin);
  }

  function deriveEmail(name) {
    return `${slugify(name)}@${EMAIL_DOMAIN}`;
  }

  function derivePassword(name, pin) {
    // Déterministe (même nom + même code => même mot de passe recalculé),
    // et assez long pour satisfaire le minimum de Supabase Auth (6 car.)
    // même si l'utilisateur ne tape que 4 chiffres.
    return `${PASSWORD_PREFIX}-${slugify(name)}-${pin}`;
  }

  async function nameIsTaken(name) {
    const { data, error } = await getClient()
      .from('managers')
      .select('id')
      .eq('name', name.trim())
      .maybeSingle();
    if (error) throw error;
    return !!data;
  }

  /**
   * Crée un nouveau profil manager. Renvoie { ok, reason?, session? } —
   * NE REJETTE JAMAIS (try/catch large) : un rejet non attrapé ici laisserait
   * le bouton "Création en cours..." bloqué indéfiniment côté onboarding.js,
   * qui attend un objet en retour, pas une exception.
   */
  async function signUp(name, pin, coach) {
    name = name.trim();
    if (!name) return { ok: false, reason: 'Choisis un nom.' };
    if (!isValidPin(pin)) return { ok: false, reason: 'Le code doit être composé de 4 chiffres.' };

    try {
      if (await nameIsTaken(name)) {
        return { ok: false, reason: 'Ce nom est déjà pris par un autre manager — choisis-en un autre.' };
      }

      const email = deriveEmail(name);
      const password = derivePassword(name, pin);
      const { data, error } = await getClient().auth.signUp({ email, password });
      if (error) return { ok: false, reason: error.message };

      const userId = data.user && data.user.id;
      if (!userId) {
        return { ok: false, reason: 'Compte créé mais session absente — vérifie que "Confirm email" est désactivé dans Supabase (Authentication → Providers → Email).' };
      }
      if (!data.session) {
        return { ok: false, reason: 'Compte créé mais pas encore connecté — vérifie que "Confirm email" est désactivé dans Supabase (Authentication → Providers → Email), puis reconnecte-toi.' };
      }

      // On va chercher le roster RÉEL (pas le fichier statique data/players.js,
      // qui peut être en retard si des joueurs ont été ajoutés/supprimés
      // directement dans Supabase depuis) pour construire l'effectif de départ.
      const { data: playerRows, error: playersError } = await getClient().from('players').select('id');
      const playerIds = playersError || !playerRows ? undefined : playerRows.map((p) => p.id);

      const { error: insertError } = await getClient().from('managers').insert({
        id: userId,
        name,
        role: 'player',
        coach: coach || window.LH3.services.managerService.emptyCoach(),
        player_boosts: {},
        squad: window.LH3.services.managerService.defaultSquad(playerIds),
        pe: 0,
        history: [],
      });
      if (insertError) return { ok: false, reason: insertError.message };

      return { ok: true, session: data.session };
    } catch (e) {
      console.error('[authService] signUp a échoué de façon inattendue', e);
      return { ok: false, reason: 'Connexion au serveur impossible — vérifie ta connexion internet et réessaie.' };
    }
  }

  /** Connecte un manager existant. Renvoie { ok, reason? }. Ne rejette jamais (voir signUp). */
  async function signIn(name, pin) {
    name = name.trim();
    if (!name || !isValidPin(pin)) {
      return { ok: false, reason: 'Renseigne ton nom et ton code à 4 chiffres.' };
    }
    try {
      const email = deriveEmail(name);
      const password = derivePassword(name, pin);
      const { data, error } = await getClient().auth.signInWithPassword({ email, password });
      if (error) return { ok: false, reason: 'Nom ou code incorrect.' };
      return { ok: true, session: data.session };
    } catch (e) {
      console.error('[authService] signIn a échoué de façon inattendue', e);
      return { ok: false, reason: 'Connexion au serveur impossible — vérifie ta connexion internet et réessaie.' };
    }
  }

  async function signOut() {
    await getClient().auth.signOut();
  }

  async function getSession() {
    const { data } = await getClient().auth.getSession();
    return data.session;
  }

  window.LH3.services.authService = { getClient, signUp, signIn, signOut, getSession, isValidPin };
})();
